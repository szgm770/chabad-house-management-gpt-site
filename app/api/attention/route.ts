import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attentionItems, auditLog, paymentDeclines } from "@/db/schema";
import { refreshAttentionItems } from "@/app/attention-engine";

export async function GET() {
  try {
    const db = getDb();
    await refreshAttentionItems(db);
    const [items, declines] = await Promise.all([
      db.select().from(attentionItems).orderBy(desc(attentionItems.createdAt)).limit(300),
      db.select().from(paymentDeclines).orderBy(desc(paymentDeclines.occurredAt)).limit(200),
    ]);
    return Response.json({
      items: [
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
