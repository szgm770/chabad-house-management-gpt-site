import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";
export async function proxy(request: NextRequest) {
  // Keep authentication endpoints and the login screen public. This explicit
  // guard is intentional: relying only on a negative matcher caused a redirect
  // loop on some Vercel deployments.
  const pathname = request.nextUrl.pathname;
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) return NextResponse.next();
  const token = request.cookies.get("chabad_session")?.value;
  if (token && await verifySessionToken(token)) return NextResponse.next();
  const login = new URL("/login", request.url); login.searchParams.set("return_to", `${request.nextUrl.pathname}${request.nextUrl.search}`); return NextResponse.redirect(login);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"] };
