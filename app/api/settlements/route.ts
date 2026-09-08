import { eq, and, or, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { donations, appSettings, auditLog } from "@/db/schema";
import {
  rulesFromSettings,
  bankSummaryForPeriod,
  monthlyBankSummary,
  periodContains,
  settlementFor,
  validDate,
  todayInIsrael,
  type FinancePeriod,
} from "@/app/settlement";
export async function GET(request: Request) {
  try {
    const db = getDb(),
      url = new URL(request.url),
      month = url.searchParams.get("month") || todayInIsrael().slice(0, 7),
      currency = url.searchParams.get("currency") || "ILS",
      type =
        url.searchParams.get("type") === "expense" ? "expense" : "donation",
      period = (url.searchParams.get("period") || "month") as FinancePeriod;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      return Response.json({ error: "חודש לא תקין" }, { status: 400 });
    if (!["month", "year", "all"].includes(period))
      return Response.json({ error: "טווח הסיכום אינו תקין" }, { status: 400 });
    const settings = Object.fromEntries(
        (await db.select().from(appSettings)).map((r) => [r.key, r.value]),
      ),
      rules = rulesFromSettings(settings);
    let condition: any = and(
      eq(donations.currency, currency),
      eq(donations.movementType, type),
    );
    if (period !== "all") {
      const start =
          period === "year" ? `${month.slice(0, 4)}-01-01` : `${month}-01`,
        end =
          period === "year"
            ? `${month.slice(0, 4)}-12-31`
            : `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()).padStart(2, "0")}`;
      const lookback = new Date(`${start}T12:00:00Z`);
      lookback.setUTCDate(lookback.getUTCDate() - 366);
      condition = and(
        condition,
        or(
          and(
            gte(donations.date, lookback.toISOString().slice(0, 10)),
            lte(donations.date, end),
          ),
          and(
            gte(donations.expectedSettlementDate, start),
            lte(donations.expectedSettlementDate, end),
          ),
          and(
            gte(donations.actualSettlementDate, start),
            lte(donations.actualSettlementDate, end),
          ),
        ),
      );
    }
    const rows = await db.select().from(donations).where(condition);
    const summaryOnly = url.searchParams.get("summaryOnly") === "1";
    // The dashboard follows the donation cohort (transaction date). The cashflow
    // calendar follows settlement dates. Keeping these two views explicit avoids
    // dropping end-of-month donations that settle in the following month.
    const summary = summaryOnly
      ? bankSummaryForPeriod(rows, rules, period, month)
      : monthlyBankSummary(rows, rules, month);
    const transactions = summaryOnly
      ? []
      : rows
          .map((r) => ({ ...r, settlement: settlementFor(r, rules) }))
          .filter(
            (r) =>
              periodContains(r.settlement.expected, period, month) ||
              periodContains(r.settlement.actual, period, month) ||
              (!r.settlement.expected &&
                !r.settlement.actual &&
                periodContains(r.date, period, month)),
          );
    return Response.json(
      { transactions, summary, rules, month, currency, period },
      { headers: { "cache-control": "private, max-age=20" } },
    );
  } catch {
    return Response.json(
      { error: "לא ניתן לטעון את הזיכויים כרגע" },
      { status: 500 },
    );
  }
}
export async function PATCH(request: Request) {
  try {
    const p = await request.json(),
      id = Number(p.id);
    if (!Number.isInteger(id) || id < 1)
      return Response.json({ error: "מזהה תנועה לא תקין" }, { status: 400 });
    for (const key of ["expectedSettlementDate", "actualSettlementDate"])
      if (p[key] && !validDate(p[key]))
        return Response.json({ error: "יש להזין תאריך תקין" }, { status: 400 });
    if (p.actualSettlementDate > todayInIsrael())
      return Response.json(
        { error: "לא ניתן לאשר זיכוי בפועל בתאריך עתידי" },
        { status: 400 },
      );
    const db = getDb();
    const [before] = await db
      .select()
      .from(donations)
      .where(eq(donations.id, id));
    if (!before)
      return Response.json({ error: "התנועה לא נמצאה" }, { status: 404 });
    const changes = {
      expectedSettlementDate: p.expectedSettlementDate || null,
      actualSettlementDate: p.actualSettlementDate || null,
      settlementReview: p.settlementReview === true,
    };
    await db.batch([
      db.update(donations).set(changes).where(eq(donations.id, id)),
      db
        .insert(auditLog)
        .values({
          action: "settlement_updated",
          entityType: "movement",
          entityId: String(id),
          details: JSON.stringify({
            before: {
              expectedSettlementDate: before.expectedSettlementDate,
              actualSettlementDate: before.actualSettlementDate,
              settlementReview: before.settlementReview,
            },
            after: changes,
          }),
        }),
    ]);
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "לא ניתן לשמור את פרטי הזיכוי" },
      { status: 500 },
    );
  }
}
