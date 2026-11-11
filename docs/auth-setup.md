# Accounts with Auth.js

Auth.js Credentials handles email/password sign-in. Prisma stores accounts, bcrypt password hashes, revocable sessions, hashed single-use email tokens and encrypted authenticator secrets. Supabase hosts PostgreSQL. Its Auth service and public API keys are no longer used by the application.

## Local review

The ignored .env already contains the database connections, generated AUTH_SECRET, APP_ORIGIN and AUTH_URL. Keep AUTH_SECRET stable so existing sessions and encrypted authenticator secrets continue to work. .env.example lists the placeholders without credentials.

AUTH_REQUIRE_EMAIL_VERIFICATION=false lets new local tourist and manager accounts sign in immediately. Registration returns to the sign-in form. Existing account emails, passwords and roles were migrated. Existing provider sessions require a fresh sign-in. The retained administrator keeps the authenticator setup key in the ignored docs/development-credentials.local.md.

Open /account/register, create an account using a password of at least 8 characters, including a letter and a number, then sign in. Managers can open /manager. Public registration cannot assign the administrator role.

With AUTH_EMAIL_MODE=local, recovery links appear in the ignored docs/auth-outbox.local.md. Submit /account/forgot-password, open the latest link for that address, and choose a new password. Local email preview requires a loopback APP_ORIGIN. No inbox delivery is attempted. Links expire after one hour and can be consumed once. Password changes revoke all sessions. Old links from Supabase Auth no longer apply.

## SMTP later

Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM using your mail provider's SMTP settings. Set AUTH_EMAIL_MODE=smtp and restart the app. Port 465 uses TLS immediately; other ports use STARTTLS. These settings belong in the application's ignored .env. Supabase Authentication email settings are no longer involved.

Set AUTH_REQUIRE_EMAIL_VERIFICATION=true to require confirmation before sign-in. Configure mail first and test delivery with your own address. Registering an existing unconfirmed address sends a fresh confirmation link. Use matching deployed HTTPS addresses for APP_ORIGIN and AUTH_URL.

## Administrator provisioning

For local testing, AUTH_REQUIRE_ADMIN_MFA=false lets administrators sign in with email and password. The app accepts this setting only with a loopback APP_ORIGIN. Set it to true and restart to require authenticator codes again. Existing authenticator setup keys remain available. With MFA enabled, sign in, open /account/mfa and verify a code before provisioning. A trusted operator finds the account UUID in Prisma Studio or the public Account table, then runs:

```powershell
npm.cmd run auth:admin -- YOUR_USER_UUID
```

The command requires a verified authenticator when MFA is enabled and a confirmed email when email confirmation is enabled. Administrator pages and database policies use the same MFA setting. Non-local deployments always require MFA.

## Checks and access

```powershell
npm.cmd run auth:verify
npm.cmd run auth:flows
npm.cmd run publishing:verify
npm.cmd run db:verify
npm.cmd run lint
npm.cmd run build
npm.cmd run typecheck
```

Auth.js uses a signed/encrypted JWT cookie backed by a revocable database session. Every private operation checks the current database session. Normal account and content requests use the authenticated PostgreSQL role with RLS. Credentials, tokens and session storage are accessible only through the server's gochitral_auth role. The public catalogue keeps its published-only role. A restricted runtime login needs membership in gochitral_public, authenticated and gochitral_auth; keep the operator connection separate.

Account mutations check APP_ORIGIN, and separate PostgreSQL rate limits bound sign-in, registration, recovery and MFA attempts. Successful sign-ins clear their failed-attempt count. Sign-out revokes sessions, including old-cookie replay. Administrator MFA is checked in both the server and database policies. Callback query strings are excluded from development request logs; deployment logs should redact them too.
