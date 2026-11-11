import NextAuth, { AuthError, CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { checkCredentials, SignInRateLimited } from "@/lib/auth/credentials";
import { authDatabase } from "@/lib/auth/store";
import { emailVerificationRequired } from "@/lib/auth/security";

class RateLimitedCredentials extends CredentialsSignin { code = "rate_limit"; }

export const { handlers, auth, signIn: authSignIn, signOut: authSignOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 7 * 86400 },
  pages: { signIn: "/account/sign-in", error: "/account/sign-in" },
  providers: [Credentials({
    credentials: { email: { type: "email" }, password: { type: "password" } },
    async authorize(input) {
      try { return await checkCredentials(input); }
      catch (error) {
        if (error instanceof SignInRateLimited) throw new RateLimitedCredentials();
        throw error;
      }
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.sid) {
        // Credentials just verified the account and created this session.
        // Later requests still validate it against the database below.
        token.sid = user.sid;
        token.sub = user.id;
        token.email = user.email;
        token.accountRole = user.accountRole;
        token.aal = "aal1";
        return token;
      }
      if (typeof token.sid !== "string") return null;
      const record = await authDatabase((tx) => tx.authSession.findUnique({
        where: { id: token.sid as string },
        include: { account: { select: { email: true, emailVerified: true, role: true } } },
      }));
      if (!record || record.revokedAt || record.expiresAt <= new Date() ||
        (emailVerificationRequired() && !record.account.emailVerified)) return null;
      token.sub = record.accountId;
      token.email = record.account.email;
      token.accountRole = record.account.role;
      token.aal = record.mfaVerifiedAt ? "aal2" : "aal1";
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.email = token.email!;
      session.sid = token.sid as string;
      session.aal = token.aal ?? "aal1";
      session.accountRole = token.accountRole;
      return session;
    },
  },
  events: {
    async signOut(message) {
      if ("token" in message && typeof message.token?.sid === "string") {
        await authDatabase((tx) => tx.authSession.updateMany({
          where: { id: message.token!.sid as string }, data: { revokedAt: new Date() },
        }));
      }
    },
  },
  logger: {
    error(error) {
      const cause = error instanceof AuthError ? error.cause?.err : undefined;
      const code = cause && typeof cause === "object" && "code" in cause &&
        typeof cause.code === "string" && /^[A-Za-z0-9_]{1,40}$/.test(cause.code) ? cause.code : undefined;
      console.error("Authentication request failed.", { type: error instanceof AuthError ? error.type : error.name, code });
    },
  },
});
