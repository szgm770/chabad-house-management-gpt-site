import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "חסרה הגדרת Google לכניסה למערכת." }, { status: 503 });
  const state = crypto.randomUUID(), requestedReturnTo = request.nextUrl.searchParams.get("return_to") || "/", returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") && !requestedReturnTo.startsWith("/login") ? requestedReturnTo : "/", origin = process.env.APP_URL || request.nextUrl.origin, jar = await cookies();
  jar.set("oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  jar.set("oauth_return", returnTo, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  Object.entries({ client_id: clientId, redirect_uri: `${origin}/api/auth/google/callback`, response_type: "code", scope: "openid email profile", state, prompt: "select_account" }).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}
