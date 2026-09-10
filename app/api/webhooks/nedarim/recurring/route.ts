import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { donorCards, people, recurringCommitments } from "@/db/schema";
import { syncDonorCardPeople } from "@/app/donor-model";
import { normalizeAppDate } from "@/app/hebrew-date";
import { normalizeNedarimPayload, readWebhookPayload, requireNedarimSource } from "@/lib/webhook-security";

export async function POST(request: Request) {
  try {
    requireNedarimSource(request);
    const body = normalizeNedarimPayload(await readWebhookPayload(request));
    const amount = Number(body.Amount), start = normalizeAppDate(body.NextDate);
    if (!body.KevaId || !body.ClientName || !Number.isFinite(amount) || amount <= 0 || !start) return Response.json({ error: "חסרים שדות חובה של הוראת קבע" }, { status: 400 });
    const db = getDb();
    const existing = await db.select().from(recurringCommitments).where(and(eq(recurringCommitments.source, "nedarim-plus"), eq(recurringCommitments.externalId, body.KevaId))).limit(1);
    if (existing.length) return Response.json({ ok: true, duplicate: true, recurring: existing[0], WEBDocID: existing[0].id });
    const matches = await db.select().from(donorCards).where(or(
      body.Zeout ? eq(donorCards.idNumber, body.Zeout.replace(/\D/g, "")) : eq(donorCards.id, -1),
      body.Phone ? eq(donorCards.phone, body.Phone.replace(/\D/g, "").replace(/^9720?/, "0")) : eq(donorCards.id, -1),
      body.Mail ? eq(donorCards.email, body.Mail.trim().toLowerCase()) : eq(donorCards.id, -1),
    )).limit(3);
    let donorCardId = matches.length === 1 ? matches[0].id : 0;
    if (!donorCardId && matches.length > 1) return Response.json({ ok: true, requiresReview: true, reason: "נמצאו כמה כרטיסים תואמים" }, { status: 202 });
    if (!donorCardId) {
      const [card] = await db.insert(donorCards).values({ cardName: body.ClientName.trim(), cardNameMode: "AUTO", phone: (body.Phone || "").replace(/\D/g, "").replace(/^9720?/, "0"), email: (body.Mail || "").trim().toLowerCase(), idNumber: (body.Zeout || "").replace(/\D/g, ""), address: body.Adresse || "" }).returning();
      const [person] = await db.insert(people).values({ donorCardId: card.id, fullName: body.ClientName.trim(), phone: card.phone, email: card.email, idNumber: card.idNumber, postalAddress: card.address }).returning();
      await syncDonorCardPeople(db, card.id);
      donorCardId = card.id;
    }
    const linkedPeople = await db.select({ id: people.id }).from(people).where(eq(people.donorCardId, donorCardId));
    const months = Number(body.Tashloumim || 0) || null;
    const end = months ? (() => { const date = new Date(`${start}T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + months); return date.toISOString().slice(0, 10); })() : null;
    const [recurring] = await db.insert(recurringCommitments).values({ donorCardId, personId: linkedPeople.length === 1 ? linkedPeople[0].id : null, amount, currency: body.Currency === "2" ? "USD" : "ILS", paymentMethod: "אשראי", startDate: start, durationMonths: months, expectedDay: Number(start.slice(8, 10)), endDate: end, status: "active", source: "nedarim-plus", externalId: body.KevaId, rawPayload: JSON.stringify(Object.fromEntries(Object.entries(body).filter(([key]) => !["Tokef"].includes(key)))) }).returning();
    await db.update(donorCards).set({ recurringStatus: "ACTIVE", recurringAmount: amount, recurringDay: Number(start.slice(8, 10)), recurringStartDate: start, recurringEndDate: end }).where(eq(donorCards.id, donorCardId));
    return Response.json({ ok: true, recurring, WEBDocID: recurring.id }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "שגיאה" }, { status: 400 }); }
}
