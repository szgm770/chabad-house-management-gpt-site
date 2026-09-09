export type SettlementRule = { method: string; mode: "same" | "days" | "monthly" | "next_month" | "manual"; day: number };
export const paymentMethods = ["אשראי", "ביט", "העברה בנקאית", "הוראת קבע", "מזומן", "צ׳ק", "פייבוקס"];
export function rulesFromSettings(settings: Record<string, string>): SettlementRule[] {
  // Single source of truth: the fixed day-of-month fields configured in the
  // finance settings panel. A day of 1-31 credits the money on that day of the
  // month (next occurrence); anything else means no automatic forecast.
  return paymentMethods.map(method => {
    const key = method === "אשראי" ? "credit_settlement_day" : method === "ביט" ? "bit_settlement_day" : method === "הוראת קבע" ? "bank_recurring_day" : "";
    const day = Number(settings[key]);
    return { method, mode: key && day >= 1 && day <= 31 ? "monthly" : "manual", day: day || 1 };
  });
}
export function validDate(date: unknown): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
}
// Coerce stored dates to zero-padded ISO. Imports and legacy rows sometimes hold
// "2026-9-8" or Israeli "8/9/2026"; without this, string range/startsWith checks
// drop them from month/year views while "all" (unfiltered) still shows them.
export function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (m) { const iso = `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`; return validDate(iso) ? iso : null; }
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(trimmed);
  if (m) { const iso = `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`; return validDate(iso) ? iso : null; }
  return validDate(trimmed) ? trimmed : null;
}
export function expectedDate(date: string, method: string, rules: SettlementRule[]): string | null {
  if (!validDate(date)) return null;
  const normalized = (v: string) => v.toLowerCase().replace(/[׳']/g, "").replace(/^bit$/, "ביט");
  const rule = rules.find(r => normalized(r.method) === normalized(method));
  if (!rule || rule.mode === "manual") return null;
  const d = new Date(date + "T12:00:00Z");
  if (rule.mode === "same") return date;
  if (rule.mode === "days") d.setUTCDate(d.getUTCDate() + rule.day);
  else {
    const target = (offset: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+offset, Math.min(rule.day, new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset+1,0)).getUTCDate()),12));
    let result = target(rule.mode === "next_month" ? 1 : 0);
    if (result < d) result = target(1);
    return result.toISOString().slice(0,10);
  }
  return d.toISOString().slice(0,10);
}
export function todayInIsrael() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date()); }
export function settlementFor(t: { date: string; paymentMethod: string; expectedSettlementDate?: string | null; actualSettlementDate?: string | null; settlementReview?: boolean }, rules: SettlementRule[], today = todayInIsrael()) {
  const expected = t.expectedSettlementDate || expectedDate(t.date, t.paymentMethod, rules);
  const confirmed = t.actualSettlementDate || null;
  const automatic = !confirmed && !t.settlementReview && !!expected && expected <= today;
  const actual = confirmed || (automatic ? expected : null);
  const status = t.settlementReview || !expected ? "דורש בדיקה" : confirmed ? "נכנס" : automatic ? "נכנס אוטומטית" : "צפוי";
  return { expected, actual, confirmed, automatic, status };
}
export type BankTransaction = { amount:number; netAmount?:number; feeAmount?:number; currency:string; movementType:string; date:string; paymentMethod:string; expectedSettlementDate?:string|null; actualSettlementDate?:string|null; settlementReview?:boolean };
export function monthlyBankSummary(rows: BankTransaction[], rules: SettlementRule[], month: string, today = todayInIsrael()) {
  const result = { gross:0, planned:0, actual:0, pending:0, overdue:0, unplanned:0 };
  for (const row of rows) {
    const s = settlementFor(row,rules,today), net = Math.round((row.amount-(row.feeAmount||0))*100)/100;
    if (row.date.startsWith(month)) result.gross += row.amount;
    if (s.expected?.startsWith(month)) { result.planned += net; if (!s.actual) { result.pending += net; if (s.expected < today) result.overdue += net; } }
    if (s.actual?.startsWith(month)) result.actual += net;
    if (!s.expected && !s.actual) result.unplanned += net;
  }
  return result;
}

export type FinancePeriod = "month" | "year" | "all";
export function periodContains(date: string | null | undefined, period: FinancePeriod, anchor: string) {
  if (period === "all") return true;
  const normalized = normalizeDate(date);
  if (!normalized) return false;
  return normalized.startsWith(period === "year" ? anchor.slice(0, 4) : anchor.slice(0, 7));
}
export function bankSummaryForPeriod(rows: BankTransaction[], rules: SettlementRule[], period: FinancePeriod, anchor: string, today = todayInIsrael()) {
  const result = { gross:0, net:0, planned:0, actual:0, pending:0, overdue:0, unplanned:0 };
  for (const row of rows) {
    const s=settlementFor(row,rules,today), net=Math.round((row.amount-(row.feeAmount||0))*100)/100;
    // Dashboard summary is one coherent cohort: donations made in the selected
    // period, then split by whether that same money has reached the bank.
    if (!periodContains(row.date,period,anchor)) continue;
    result.gross+=row.amount;
    result.net+=net;
    result.planned+=net;
    if (s.actual && s.actual<=today) result.actual+=net;
    else {
      result.pending+=net;
      if (!s.expected) result.unplanned+=net;
    }
    if ((!s.actual || s.actual>today) && !!s.expected && s.expected<today) result.overdue+=net;
  }
  return result;
}
