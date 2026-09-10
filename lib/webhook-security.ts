const nedarimIps = new Set(["18.196.146.117", "18.194.219.73"]);

function forwardedIp(request: Request) {
  return (request.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((part) => part.trim())
    .find(Boolean);
}

export function requireNedarimSource(request: Request) {
  const ip = forwardedIp(request);
  if (!ip || !nedarimIps.has(ip)) {
    throw new Error("מקור עדכון נדרים פלוס לא מאומת");
  }
}

export function requireSumitToken(request: Request) {
  const expected = process.env.SUMIT_WEBHOOK_TOKEN;
  const supplied = new URL(request.url).searchParams.get("token");
  if (!expected || !supplied || supplied !== expected) {
    throw new Error("עדכון SUMIT לא מאומת");
  }
}

export async function readWebhookPayload(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(await request.text()));
  }
  throw new Error("סוג נתונים לא נתמך");
}

export function normalizeNedarimPayload(payload: Record<string, unknown>) {
  const normalized = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key.trim(), value == null ? "" : String(value).trim()]),
  ) as Record<string, string>;

  // Nedarim has sent both spellings in production. Keep one canonical key.
  normalized.KevaId ||= normalized.Kevald || normalized.kevaid || normalized.kevald || "";
  return normalized;
}

export function normalizeNedarimDateTime(value = "") {
  const raw = value.trim();
  const local = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!local) return raw || new Date().toISOString();
  const [, day, month, year, hour = "00", minute = "00", second = "00"] = local;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:${second}`;
}
