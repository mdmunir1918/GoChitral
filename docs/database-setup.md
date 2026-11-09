# Module 03 · Prisma and PostgreSQL

Prisma owns the catalogue schema and migration history. Supabase can provide the PostgreSQL host and later authentication. The app reads through its existing catalogue adapter using a Prisma PostgreSQL driver. The connection is server-only.

## Configure a development database

Create a separate Supabase development project, or select an empty PostgreSQL development database. Copy `.env.example` to `.env` or `.env.local`. Next.js and the Prisma commands load these files, with `.env.local` taking precedence.

Set `DIRECT_URL` to the operator's direct or session-pool connection string. Set `DATABASE_URL` to the runtime connection string, using a restricted login granted membership in `gochitral_public`. Keep both passwords out of chat and Git. Prisma reads migrations from `prisma/migrations/`, so use Prisma commands for schema changes.

Supabase's transaction pooler uses port 6543 and its session pooler uses port 5432. Use the project's database password in each connection URL and percent-encode special characters in the password. PostgreSQL error `28P01` indicates that the server rejected the supplied credentials.

```powershell
npm.cmd run db:generate
npm.cmd run db:validate
npm.cmd run db:status
npm.cmd run db:deploy
npm.cmd run db:seed
npm.cmd run db:verify
```

Review the host and database name in your provider dashboard and the migration SQL before deployment. `db:deploy` applies pending migrations to the configured target. The seed is for the development database and upserts the known fixture IDs in a transaction. Repeating the seed replaces those examples with their checked-in values.

The migration creates the NOLOGIN role `gochitral_public`. An operator creates the runtime LOGIN role with a password using the provider's protected database console, grants it `gochitral_public`, and uses its credentials in `DATABASE_URL`. Grant CONNECT on the selected database if the provider restricts it. The runtime role needs no table ownership, write privileges or BYPASSRLS.

Each public Prisma read switches to `gochitral_public` within a transaction. Policies permit published records and require a published parent destination. Photos are visible only when a visible listing references them. Rooms require published status and a published hotel. Private ownership and verification tables have RLS with no public policies or grants.

On Supabase, the migration also grants published reads to existing `anon` and `authenticated` roles. This supports direct API checks without exposing private tables. Add Supabase Auth packages and session handling with Module 04.

## Verify and recover

`db:verify` checks the seeded development database through the public role, denies a write, denies private-table reads, and checks the room constraints in rolled-back transactions. Run it against an isolated development database after applying migrations and seeding. It does not reset the database.

Restart the Next.js server, then search for Bumburet and open its detail URL. Restart again and repeat. Temporarily point `DATABASE_URL` at an unreachable development endpoint and restart to check the retry screen. Restore the connection and use Try again.

Without a connection, lint, schema validation, generated client checks and the production build can still run. Catalogue routes show a recoverable error and never fall back to local fixtures. Home remains available.

Prisma connection configuration follows the [Prisma 7 config reference](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference) and [connection guidance](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections).
