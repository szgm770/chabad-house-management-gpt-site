export type SettlementRule = { method: string; mode: "same" | "days" | "monthly" | "next_month" | "manual"; day: number };
export const paymentMethods = ["אשראי", "ביט", "העברה בנקאית", "הוראת קבע בנקאית", "הוראת קבע", "מזומן", "צ׳ק", "פייבוקס"];
export function normalizePaymentMethod(value: string) {
  const raw = String(value || "").trim().toLowerCase().replace(/[׳'״\"]/g, "").replace(/[_–—-]+/g, " ").replace(/\s+/g, " ");
  if (!raw) return "לא צוין אמצעי תשלום";
  if (/credit|card|כרטיס/.test(raw) || raw.includes("אשראי")) return "אשראי";
  if (/paybox|פייבוקס/.test(raw)) return "פייבוקס";
  if (/^bit$/.test(raw) || raw.includes("ביט")) return "ביט";
  if (raw.includes("הוראת קבע") && /בנק|bank/.test(raw)) return "הוראת קבע בנקאית";
  if (raw.includes("הוראת קבע")) return "הוראת קבע";
  if (/bank transfer|העברה בנקאית/.test(raw)) return "העברה בנקאית";
  if (/cash|מזומן/.test(raw)) return "מזומן";
  if (/cheque|check|צק/.test(raw)) return "צ׳ק";
  return String(value || "").trim() || "לא צוין אמצעי תשלום";
}
export function rulesFromSettings(settings: Record<string, string>): SettlementRule[] {
  if (settings.settlement_rules) { try { return JSON.parse(settings.settlement_rules); } catch {} }
  // No assumed settlement dates: only migrate explicit existing configuration.
  return paymentMethods.map(method => {
    const key = method === "אשראי" ? "credit_settlement_day" : method === "ביט" ? "bit_settlement_day" : method.includes("הוראת קבע") ? "bank_recurring_day" : "";
    const day = Number(settings[key]);
    return { method, mode: key && day >= 1 && day <= 31 ? "monthly" : "manual", day: day || 1 };
  });
}
export function settlementRuleFor(method: string, rules: SettlementRule[]) {
  const normalizedMethod = normalizePaymentMethod(method);
  return rules.find(rule => normalizePaymentMethod(rule.method) === normalizedMethod) || null;
}
export function normalizeSettlementDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text=value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !isNaN(Date.parse(text))) return text;
  const iso=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if(iso){const candidate=`${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`;return validDate(candidate)?candidate:null}
  const local=text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if(local){const candidate=`${local[3]}-${local[2].padStart(2,"0")}-${local[1].padStart(2,"0")}`;return validDate(candidate)?candidate:null}
  const serial=Number(text);
  if(Number.isFinite(serial)&&serial>20000&&serial<100000)return new Date(Date.UTC(1899,11,30)+serial*86400000).toISOString().slice(0,10);
  return null;
}
export function validDate(date: unknown): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
}
export function expectedDate(date: string, method: string, rules: SettlementRule[]): string | null {
  const normalizedDate=normalizeSettlementDate(date);
  if (!normalizedDate) return null;
  const rule = settlementRuleFor(method,rules);
  if (!rule || rule.mode === "manual") return null;
  const d = new Date(normalizedDate + "T12:00:00Z");
  if (rule.mode === "same") return normalizedDate;
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
    if (normalizeSettlementDate(row.date)?.startsWith(month)) result.gross += row.amount;
    if (s.expected?.startsWith(month)) { result.planned += net; if (!s.actual) { result.pending += net; if (s.expected < today) result.overdue += net; } }
    if (s.actual?.startsWith(month)) result.actual += net;
    if (!s.expected && !s.actual) result.unplanned += net;
  }
  return result;
}

export type FinancePeriod = "month" | "year" | "all";
export function periodContains(date: string | null | undefined, period: FinancePeriod, anchor: string) {
  if (!date) return false;
  date=normalizeSettlementDate(date)||date;
  if (period === "all") return true;
  return date.startsWith(period === "year" ? anchor.slice(0, 4) : anchor.slice(0, 7));
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
