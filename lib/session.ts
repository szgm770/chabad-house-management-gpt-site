export type SessionPayload = { email: string; name: string | null; exp: number };
const encoder = new TextEncoder();
// The Google OAuth secret is stable across Vercel deployments. Prefer an
// explicit session secret when configured, and keep the old AUTH_SECRET as a
// verification fallback so existing sessions can migrate without disruption.
const signingSecret = () => process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_SECRET || "";
const verificationSecrets = () => [...new Set([signingSecret(), process.env.AUTH_SECRET || ""].filter(Boolean))];
const encode = (value: string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");
async function signature(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Buffer.from(await crypto.subtle.sign("HMAC", key, encoder.encode(value))).toString("base64url");
}
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = signingSecret();
  if (!secret) throw new Error("חסר מפתח אבטחה של המערכת.");
  const body = encode(JSON.stringify(payload)); return `${body}.${await signature(body, secret)}`;
}
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const [body, supplied] = token.split(".");
  if (!body || !supplied) return null;
  let valid = false;
  for (const secret of verificationSecrets()) {
    if ((await signature(body, secret)) === supplied) { valid = true; break; }
  }
  if (!valid) return null;
  try { const payload = JSON.parse(decode(body)) as SessionPayload; return payload.exp > Date.now() && payload.email ? payload : null; } catch { return null; }
}
export function emailIsAllowed(email: string): boolean {
  const allowed = (process.env.ALLOWED_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return allowed.length > 0 && allowed.includes(email.toLowerCase());
}
