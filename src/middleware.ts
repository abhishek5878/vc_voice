import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PASSCODE_COOKIE = "robin_passcode_verified";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/app")) {
    return NextResponse.next();
  }
  if (request.cookies.get(PASSCODE_COOKIE)?.value === "1") {
    return NextResponse.next();
  }
  const url = new URL("/auth", request.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*"],
};
