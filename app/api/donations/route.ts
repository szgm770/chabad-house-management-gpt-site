import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appSettings,
  auditLog,
  donations,
  donorCards,
  people,
} from "@/db/schema";
import { ingestMovement } from "@/app/api/movements/ingest";
import { netAmount } from "@/app/finance";
import { todayInIsrael } from "@/app/settlement";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      db = getDb();
    const limit = Math.min(
      100,
      Math.max(20, Number(url.searchParams.get("limit") || 50)),
    );
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
    const type = url.searchParams.get("type") || "all";
    const query = (url.searchParams.get("q") || "").trim();
    const sort = url.searchParams.get("sort") || "date-desc";
    const conditions = [
      type === "donation" || type === "expense"
        ? eq(donations.movementType, type)
        : undefined,
      query
        ? or(
            like(donations.donorName, `%${query}%`),
            like(donations.purpose, `%${query}%`),
            like(donations.department, `%${query}%`),
            like(donations.paymentMethod, `%${query}%`),
          )
        : undefined,
    ].filter(Boolean);
    const where = conditions.length
      ? and(...(conditions as Parameters<typeof and>))
      : undefined;
    const order =
      sort === "date-asc"
        ? asc(donations.date)
        : sort === "amount-desc"
          ? desc(donations.amount)
          : sort === "amount-asc"
            ? asc(donations.amount)
            : desc(donations.date);
    const currentMonth = todayInIsrael().slice(0, 7);
    const [rows, countRows, summaryRows] = await Promise.all([
      db
        .select({
          donation: donations,
          personName: people.fullName,
          cardName: donorCards.cardName,
        })
        .from(donations)
        .leftJoin(people, eq(donations.personId, people.id))
        .leftJoin(donorCards, eq(donations.donorId, donorCards.id))
        .where(where)
        .orderBy(order, desc(donations.id))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(donations)
        .where(where),
      db
        .select({
          gross: sql<number>`coalesce(sum(case when ${donations.movementType}='donation' and ${donations.currency}='ILS' and substr(${donations.date},1,7)=${currentMonth} then ${donations.amount} else 0 end),0)`,
          net: sql<number>`coalesce(sum(case when ${donations.movementType}='donation' and ${donations.currency}='ILS' and substr(${donations.date},1,7)=${currentMonth} then (${donations.amount}-coalesce(${donations.feeAmount},0)) else 0 end),0)`,
          expenses: sql<number>`coalesce(sum(case when ${donations.movementType}='expense' and ${donations.currency}='ILS' and substr(${donations.date},1,7)=${currentMonth} then (${donations.amount}+coalesce(${donations.feeAmount},0)) else 0 end),0)`,
          donationCount: sql<number>`coalesce(sum(case when ${donations.movementType}='donation' and substr(${donations.date},1,7)=${currentMonth} then 1 else 0 end),0)`,
          expenseCount: sql<number>`coalesce(sum(case when ${donations.movementType}='expense' and substr(${donations.date},1,7)=${currentMonth} then 1 else 0 end),0)`,
        })
        .from(donations),
    ]);
    return Response.json({
      donations: rows.map((row) => ({
        ...row.donation,
        personName: row.personName,
        donorName: row.cardName || row.donation.donorName,
      })),
      total: countRows[0]?.count || 0,
      hasMore: offset + rows.length < (countRows[0]?.count || 0),
      summary: summaryRows[0],
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const result = await ingestMovement({
      ...(await request.json()),
      source: "manual",
    });
    return Response.json(result, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 400 },
    );
  }
}
export async function PATCH(request: Request) {
  try {
    const p = (await request.json()) as Record<string, unknown>;
    const id = Number(p.id),
      amount = Number(p.amount),
      name = String(p.donorName || "").trim(),
      date = String(p.date || "");
    if (!id || !name || !amount || !date)
      return Response.json({ error: "חסרים פרטי חובה" }, { status: 400 });
    const db = getDb(),
      settings = Object.fromEntries(
        (await db.select().from(appSettings)).map((row) => [
          row.key,
          row.value,
        ]),
      ),
      method = String(p.paymentMethod || "לא צוין"),
      kind = String(p.movementType || "donation"),
      calculated =
        kind === "donation"
          ? netAmount(amount, method, settings)
          : { rate: 0, fee: 0, net: amount },
      [linked] =
        kind === "donation"
          ? await db
              .select({ id: donorCards.id, cardName: donorCards.cardName })
              .from(donorCards)
              .where(eq(donorCards.cardName, name))
              .limit(1)
          : [];
    const [movement] = await db
      .update(donations)
      .set({
        donorId: linked?.id || null,
        personId: p.personId ? Number(p.personId) : null,
        donorName: linked?.cardName || name,
        amount,
        date,
        paymentMethod: method,
        purpose: String(p.purpose || ""),
        reason: String(p.reason || ""),
        movementType: kind,
        department: String(p.department || ""),
        subcategory: String(p.subcategory || ""),
        isRecurring: !!p.isRecurring,
        feePercentage: calculated.rate,
        feeAmount: calculated.fee,
        netAmount: calculated.net,
      })
      .where(eq(donations.id, id))
      .returning();
    if (!movement)
      return Response.json({ error: "התנועה לא נמצאה" }, { status: 404 });
    await db.insert(auditLog).values({
      action: "movement_updated",
      entityType: "movement",
      entityId: String(id),
      details: "{}",
    });
    return Response.json({ movement });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "מזהה חסר" }, { status: 400 });
    const db = getDb();
    const [deleted] = await db
      .delete(donations)
      .where(eq(donations.id, id))
      .returning();
    if (!deleted)
      return Response.json({ error: "התנועה לא נמצאה" }, { status: 404 });
    await db.insert(auditLog).values({
      action: "movement_deleted",
      entityType: "movement",
      entityId: String(id),
      details: "{}",
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 500 },
    );
  }
}
