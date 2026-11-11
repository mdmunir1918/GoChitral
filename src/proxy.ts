import { NextResponse } from "next/server";

// Pages and actions validate sessions themselves. Avoid another database trip here.
export function proxy() {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/account/:path*", "/auth/:path*", "/manager/:path*", "/admin/:path*", "/my-trips/:path*", "/api/trips/:path*", "/api/guides/:path*"] };
