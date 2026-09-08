import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";
export async function proxy(request: NextRequest) {
  const token = request.cookies.get("chabad_session")?.value;
  if (token && await verifySessionToken(token)) return NextResponse.next();
  const login = new URL("/login", request.url); login.searchParams.set("return_to", `${request.nextUrl.pathname}${request.nextUrl.search}`); return NextResponse.redirect(login);
}
export const config = { matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.svg).*)"] };
