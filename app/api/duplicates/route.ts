import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, donations, donorCards, duplicateDecisions, engagements, mergeEvents, people, recurringCommitments, specialDates } from "@/db/schema";
import { syncDonorCardPeople } from "@/app/donor-model";

const clean = (value = "") => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const pairKey = (a: number, b: number) => [a, b].sort((x, y) => x - y).join(":");
const nameScore = (a: string, b: string) => {
  const words = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const left = new Set(words(a)), right = new Set(words(b));
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / Math.max(left.size, right.size);
};

export async function GET() {
  try {
    const db = getDb();
    const [cards, decisions] = await Promise.all([db.select().from(donorCards).where(ne(donorCards.status, "merged")), db.select().from(duplicateDecisions)]);
    const decided = new Set(decisions.map((item) => item.pairKey));
    const pairs = cards.flatMap((left, index) => cards.slice(index + 1).flatMap((right) => {
      const reasons: string[] = [];
      if (clean(left.idNumber) && clean(left.idNumber) === clean(right.idNumber)) reasons.push("ת״ז / ח״פ זהים");
      if (clean(left.phone) && clean(left.phone) === clean(right.phone)) reasons.push("טלפון זהה");
      if (clean(left.email) && clean(left.email) === clean(right.email)) reasons.push("דוא״ל זהה");
      const similar = nameScore(left.cardName, right.cardName);
      if (!reasons.length && similar >= .65) reasons.push("שמות דומים");
      const key = pairKey(left.id, right.id);
      return reasons.length && !decided.has(key) ? [{ key, left, right, reasons, confidence: reasons.some((r) => r.includes("ת״ז")) ? 100 : reasons.length > 1 ? 95 : reasons[0] === "שמות דומים" ? 65 : 88 }] : [];
    }));
    return Response.json({ pairs: pairs.sort((a, b) => b.confidence - a.confidence).slice(0, 100) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "שגיאה" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { leftId?: number; rightId?: number; decision?: string };
    const leftId = Number(body.leftId), rightId = Number(body.rightId), decision = String(body.decision || "");
    if (!leftId || !rightId || leftId === rightId || !["merge", "link", "separate", "later"].includes(decision)) return Response.json({ error: "פעולה לא תקינה" }, { status: 400 });
    const db = getDb(), key = pairKey(leftId, rightId);
    if (decision === "later") return Response.json({ ok: true });
    if (decision === "separate") {
      await db.insert(duplicateDecisions).values({ pairKey: key, leftDonorCardId: leftId, rightDonorCardId: rightId, decision }).onConflictDoUpdate({ target: duplicateDecisions.pairKey, set: { decision } });
      await db.insert(auditLog).values({ action: "duplicate_kept_separate", entityType: "donor_card_pair", entityId: key, details: "{}" });
      return Response.json({ ok: true });
    }
    const [left, right, rightPeople] = await Promise.all([db.select().from(donorCards).where(eq(donorCards.id, leftId)).limit(1), db.select().from(donorCards).where(eq(donorCards.id, rightId)).limit(1), db.select().from(people).where(eq(people.donorCardId, rightId))]);
    if (!left[0] || !right[0]) return Response.json({ error: "אחד הכרטיסים לא נמצא" }, { status: 404 });
    const snapshot = { left: left[0], right: right[0], rightPeople };
    await db.insert(mergeEvents).values({ targetDonorCardId: leftId, snapshotJson: JSON.stringify(snapshot), status: "applied" });
    await db.update(people).set({ donorCardId: leftId }).where(eq(people.donorCardId, rightId));
    await db.update(donations).set({ donorId: leftId, donorName: left[0].cardName }).where(eq(donations.donorId, rightId));
    await db.update(engagements).set({ donorCardId: leftId }).where(eq(engagements.donorCardId, rightId));
    await db.update(specialDates).set({ donorCardId: leftId }).where(eq(specialDates.donorCardId, rightId));
    await db.update(recurringCommitments).set({ donorCardId: leftId }).where(eq(recurringCommitments.donorCardId, rightId));
    await db.update(donorCards).set({ status: "merged", notes: `${right[0].notes}\nאוחד לכרטיס ${leftId}`.trim() }).where(eq(donorCards.id, rightId));
    if (decision === "merge") await db.update(donorCards).set({ alias: [left[0].alias, right[0].cardName, right[0].alias].filter(Boolean).join(", ") }).where(eq(donorCards.id, leftId));
    await syncDonorCardPeople(db, leftId);
    await db.insert(duplicateDecisions).values({ pairKey: key, leftDonorCardId: leftId, rightDonorCardId: rightId, decision, details: JSON.stringify({ mergeEvent: true }) }).onConflictDoUpdate({ target: duplicateDecisions.pairKey, set: { decision } });
    await db.insert(auditLog).values({ action: decision === "merge" ? "duplicate_merged" : "cards_linked", entityType: "donor_card_pair", entityId: key, details: JSON.stringify({ survivor: leftId, merged: rightId }) });
    return Response.json({ ok: true, donorCardId: leftId });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "שגיאה" }, { status: 500 }); }
}
