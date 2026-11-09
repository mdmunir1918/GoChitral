# Module 04 · Accounts

The app uses Supabase Auth for identities and Prisma for protected account roles and owned records. The database URLs continue to serve Prisma. The Supabase project URL and publishable key serve the Auth client.

## Environment

The ignored `.env` contains the existing database URLs, the project URL derived from the database connection, the publishable key and `APP_ORIGIN=http://127.0.0.1:3000`. `.env.example` lists the same variable names with safe values.

The project URL identifies your Supabase project. Find the publishable key in the project's Connect dialog or Settings → API Keys. It starts with `sb_publishable_` and is designed for client use. [Supabase key instructions](https://supabase.com/docs/guides/getting-started/api-keys)

## Email configuration and review

In Supabase Authentication → URL Configuration, set Site URL to `http://127.0.0.1:3000` and allow `http://127.0.0.1:3000/auth/confirm` as a redirect URL.

For email links that work across browsers, set the Confirm signup email link to:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

Set the Reset password email link to:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

Use a development inbox permitted by your SMTP provider. Register at `/account/register`, select Tourist or Hotel manager, confirm the email and sign in. Managers can open `/manager`. Use `/account/forgot-password` to request recovery and follow the email to choose a password of at least 12 characters. An invalid or expired link offers a new recovery request.

## Administrator provisioning

Create and confirm your own account, then open `/account/mfa`. Enter the displayed setup key in an authenticator app and verify its six-digit code.

A trusted database operator copies that user's UUID from Supabase Authentication → Users and runs:

```powershell
npm.cmd run auth:admin -- YOUR_USER_UUID
```

This command promotes a confirmed account only after an authenticator is verified. Administrator pages require a current second-factor verification. No public registration choice can create an administrator.

## Verification and access model

```powershell
npm.cmd run auth:verify
npm.cmd run db:verify
npm.cmd run lint
npm.cmd run build
npm.cmd run typecheck
```

`auth:verify` creates two tourists and two managers in a transaction, checks isolation, draft ownership, role escalation denial, session revocation, return paths and shared rate limits, then rolls back.

The server verifies the Supabase user before passing identity claims to a Prisma transaction using the authenticated database role. RLS checks both user identity and the active Supabase session. Private responses bypass shared caching. The public catalogue retains its published-only role.

If you replace the development operator connection with a restricted application login, grant that login membership in both `gochitral_public` and `authenticated`. Keep its table privileges restricted and the operator connection separate.

Sign-out revokes Supabase sessions. Replaying an old session cannot open protected app pages. Password recovery uses a short-lived cookie issued only after the recovery link is verified. Account operations require the configured origin. Authentication attempts use a shared PostgreSQL limit of eight attempts per identity per 15-minute window.

Callback query strings are excluded from Next.js development request logs. Configure hosting and reverse-proxy logs to redact callback tokens at deployment.
