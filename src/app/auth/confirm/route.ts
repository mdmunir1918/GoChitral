import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { authClient } from "@/lib/auth/supabase";
import { returnPath } from "@/lib/auth/return-path";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const jar = await cookies();
  const origin = process.env.APP_ORIGIN!;
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const supabase = await authClient();
  let verified = false;
  let recovery = false;
  if (token_hash && token_hash.length < 512 && (type === "email" || type === "recovery")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    verified = !error;
    recovery = verified && type === "recovery";
  } else if (code && code.length < 512) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
    if (data.session) {
      const claims = JSON.parse(Buffer.from(data.session.access_token.split(".")[1], "base64url").toString());
      recovery = verified && claims.amr?.some((entry: { method: string }) => entry.method === "recovery");
    }
  }
  let target = "/account/sign-in?message=expired";
  if (verified) {
    target = returnPath(jar.get("gochitral-return")?.value);
    if (recovery) {
      jar.set("gochitral-recovery", "verified", { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https:"), maxAge: 600, path: "/" });
      target = "/account/reset-password";
    }
    jar.delete("gochitral-return");
  }
  const response = NextResponse.redirect(new URL(target, origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
