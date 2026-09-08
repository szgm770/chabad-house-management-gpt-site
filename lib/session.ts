export type SessionPayload = { email: string; name: string | null; exp: number };
const encoder = new TextEncoder();
const secret = () => process.env.AUTH_SECRET || "";
const encode = (value: string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");
async function signature(value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Buffer.from(await crypto.subtle.sign("HMAC", key, encoder.encode(value))).toString("base64url");
}
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  if (!secret()) throw new Error("חסר מפתח אבטחה של המערכת.");
  const body = encode(JSON.stringify(payload)); return `${body}.${await signature(body)}`;
}
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!secret()) return null;
  const [body, supplied] = token.split(".");
  if (!body || !supplied || (await signature(body)) !== supplied) return null;
  try { const payload = JSON.parse(decode(body)) as SessionPayload; return payload.exp > Date.now() && payload.email ? payload : null; } catch { return null; }
}
export function emailIsAllowed(email: string): boolean {
  const allowed = (process.env.ALLOWED_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return allowed.length > 0 && allowed.includes(email.toLowerCase());
}
