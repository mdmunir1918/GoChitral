import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { confirmEmail, recoveryToken } from "@/lib/auth/tokens";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  let target = "/account/sign-in?message=expired";
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    if (type === "email" && await confirmEmail(token)) target = "/account/sign-in?message=email-confirmed";
    if (type === "recovery" && await recoveryToken(token)) {
      (await cookies()).set("gochitral-recovery", token, {
        httpOnly: true, sameSite: "lax", secure: process.env.APP_ORIGIN?.startsWith("https:"), maxAge: 600, path: "/",
      });
      target = "/account/reset-password";
    }
  }
  const response = NextResponse.redirect(new URL(target, process.env.APP_ORIGIN));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
