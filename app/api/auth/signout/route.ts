import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) { const response = NextResponse.redirect(new URL("/login", process.env.APP_URL || request.nextUrl.origin)); response.cookies.delete("chabad_session"); return response; }
