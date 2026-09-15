import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attentionItems, auditLog, paymentDeclines, donations, appSettings } from "@/db/schema";
import { refreshAttentionItems } from "@/app/attention-engine";
import { expectedDate, normalizePaymentMethod, normalizeSettlementDate, rulesFromSettings, settlementRuleFor } from "@/app/settlement";

export async function GET(request: Request) {
  try {
    const db = getDb();
    await refreshAttentionItems(db);
    const [items, declines, movementRows, settingRows] = await Promise.all([
      db.select().from(attentionItems).orderBy(desc(attentionItems.createdAt)).limit(300),
      db.select().from(paymentDeclines).orderBy(desc(paymentDeclines.occurredAt)).limit(200),
      db.select().from(donations).where(eq(donations.movementType, "donation")),
      db.select().from(appSettings),
    ]);
    const settings = Object.fromEntries(settingRows.map(row => [row.key, row.value]));
    const rules = rulesFromSettings(settings);
    const missing = movementRows.filter(row => !row.expectedSettlementDate && !row.actualSettlementDate && !expectedDate(row.date, row.paymentMethod, rules));
    const requestedMethod = new URL(request.url).searchParams.get("paymentMethod");
    if (requestedMethod) return Response.json({ transactions: missing.filter(row => normalizePaymentMethod(row.paymentMethod) === requestedMethod).map(row => ({ id: row.id, donorId: row.donorId, donorName: row.donorName, amount: row.amount, currency: row.currency, date: row.date, paymentMethod: row.paymentMethod })) });
    const groups = new Map<string, { count: number; amount: number; currency: string; issue:"rule"|"manual"|"date" }>();
    for (const row of missing) {
      const method = normalizePaymentMethod(row.paymentMethod),rule=settlementRuleFor(row.paymentMethod,rules),issue=!normalizeSettlementDate(row.date)?"date":rule?.mode==="manual"?"manual":"rule",key=`${issue}:${method}`,current = groups.get(key) || { count: 0, amount: 0, currency: row.currency,issue };
      current.count += 1; current.amount += row.amount; groups.set(key, current);
    }
    return Response.json({
      items: [
        ...Array.from(groups, ([key, group]) => {const method=key.slice(key.indexOf(":")+1),title=group.issue==="date"?`תאריך התנועה אינו תקין ב״${method}״`:group.issue==="manual"?`נדרש מועד זיכוי ידני ל״${method}״`:`לא הוגדר מועד זיכוי ל״${method}״`;return { id: `settlement:${key}`, kind: group.issue==="rule"?"missing_settlement_rule":"missing_settlement_date", settlementIssue:group.issue, entityType: "payment_method", entityId: method, paymentMethod: method, donorCardId: null, personId: null, title, detail: `${group.count} תנועות · ${new Intl.NumberFormat("he-IL", { style: "currency", currency: group.currency }).format(group.amount)}`, priority: "high", dueDate: null, status: "open", createdAt: null }}),
        ...declines.map((row) => ({
          id: `decline:${row.id}`,
          kind: "payment_decline",
          entityType: "decline",
          entityId: String(row.id),
          donorCardId: null,
          personId: null,
          title: row.donorName ? `סירוב חיוב — ${row.donorName}` : "סירוב חיוב",
          detail: row.message,
          priority: "high",
          dueDate: row.occurredAt,
          status: row.handled ? "resolved" : "open",
          createdAt: row.createdAt,
        })),
        ...items,
      ],
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "שגיאה" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: number | string; status?: string; resolution?: string };
    const db = getDb();
    if (String(body.id).startsWith("decline:")) {
      const id = Number(String(body.id).split(":")[1]);
      await db.update(paymentDeclines).set({ handled: body.status === "resolved", handledAt: body.status === "resolved" ? new Date().toISOString() : null }).where(eq(paymentDeclines.id, id));
      return Response.json({ ok: true });
    }
    const id = Number(body.id);
    if (!id) return Response.json({ error: "מזהה חסר" }, { status: 400 });
    const status = body.status === "resolved" ? "resolved" : "open";
    await db.update(attentionItems).set({ status, resolution: body.resolution || "", resolvedAt: status === "resolved" ? new Date().toISOString() : null, updatedAt: new Date().toISOString() }).where(eq(attentionItems.id, id));
    await db.insert(auditLog).values({ action: status === "resolved" ? "attention_resolved" : "attention_reopened", entityType: "attention_item", entityId: String(id), details: JSON.stringify({ resolution: body.resolution || "" }) });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "שגיאה" }, { status: 500 });
  }
}
