// Central webhook verification shared by all payment providers.
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
