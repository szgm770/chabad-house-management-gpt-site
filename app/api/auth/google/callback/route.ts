import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/session";
import { isEmailAllowedToSignIn } from "@/lib/access-control";

export async function GET(request: NextRequest) {
  const jar = await cookies(), state = request.nextUrl.searchParams.get("state"), code = request.nextUrl.searchParams.get("code"), origin = process.env.APP_URL || request.nextUrl.origin;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
  if (!state || state !== jar.get("oauth_state")?.value || !code) return fail("oauth");
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code" }) });
    if (!tokenResponse.ok) return fail("oauth");
    const token = await tokenResponse.json() as { access_token?: string };
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json() as { email?: string; name?: string; email_verified?: boolean };
    if (!profile.email || !profile.email_verified || !(await isEmailAllowedToSignIn(profile.email))) return fail("not_allowed");
    const session = await createSessionToken({ email: profile.email, name: profile.name || null, exp: Date.now() + 604800000 });
    const storedReturnTo = jar.get("oauth_return")?.value || "/";
    const response = NextResponse.redirect(new URL(storedReturnTo.startsWith("/") && !storedReturnTo.startsWith("//") && !storedReturnTo.startsWith("/login") ? storedReturnTo : "/", origin));
    response.cookies.set("chabad_session", session, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 604800, path: "/" });
    response.cookies.delete("oauth_state"); response.cookies.delete("oauth_return"); return response;
  } catch { return fail("oauth"); }
}
