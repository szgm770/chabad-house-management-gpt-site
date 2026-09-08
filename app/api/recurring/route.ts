import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, donorCards, people, recurringCommitments } from "@/db/schema";

function endDate(start: string, months?: number | null) {
  if (!months) return null;
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const donorCardId = Number(new URL(request.url).searchParams.get("donorCardId"));
    const db = getDb();
    const rows = await db.select({ commitment: recurringCommitments, cardName: donorCards.cardName, personName: people.fullName }).from(recurringCommitments).leftJoin(donorCards, eq(recurringCommitments.donorCardId, donorCards.id)).leftJoin(people, eq(recurringCommitments.personId, people.id)).orderBy(desc(recurringCommitments.createdAt));
    return Response.json({ recurring: donorCardId ? rows.filter((row) => row.commitment.donorCardId === donorCardId) : rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "שגיאה" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const donorCardId = Number(body.donorCardId), amount = Number(body.amount), expectedDay = Number(body.expectedDay), startDate = String(body.startDate || ""), durationMonths = body.durationMonths ? Number(body.durationMonths) : null;
    if (!donorCardId || amount <= 0 || !startDate || expectedDay < 1 || expectedDay > 31) return Response.json({ error: "חסרים פרטי הוראת קבע תקינים" }, { status: 400 });
    const db = getDb();
    const [item] = await db.insert(recurringCommitments).values({ donorCardId, personId: body.personId ? Number(body.personId) : null, amount, currency: String(body.currency || "ILS"), paymentMethod: String(body.paymentMethod || "אחר"), startDate, durationMonths, expectedDay, endDate: endDate(startDate, durationMonths), status: "active", source: String(body.source || "manual"), externalId: body.externalId ? String(body.externalId) : null, rawPayload: JSON.stringify(body.rawPayload || {}) }).returning();
    await db.update(donorCards).set({ recurringStatus: "ACTIVE", recurringAmount: amount }).where(eq(donorCards.id, donorCardId));
    await db.insert(auditLog).values({ action: "recurring_created", entityType: "recurring", entityId: String(item.id), details: JSON.stringify({ donorCardId }) });
    return Response.json({ recurring: item }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "שגיאה" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>, id = Number(body.id);
    if (!id) return Response.json({ error: "מזהה חסר" }, { status: 400 });
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.status && ["active", "paused", "ended"].includes(String(body.status))) patch.status = String(body.status);
    if (body.amount) patch.amount = Number(body.amount);
    const db=getDb(),[item] = await db.update(recurringCommitments).set(patch).where(eq(recurringCommitments.id, id)).returning();
    if(item) await db.update(donorCards).set({recurringStatus:item.status==="active"?"ACTIVE":item.status.toUpperCase(),recurringAmount:item.status==="active"?item.amount:0}).where(eq(donorCards.id,item.donorCardId));
    return Response.json({ recurring: item });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "שגיאה" }, { status: 500 });
  }
}
