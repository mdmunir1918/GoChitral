# Module 04 · Accounts and role checks

**Completed on 9 November 2026.** Next module: 05, administrator publishing.

## Review

Open [Account](http://127.0.0.1:3000/account). Create a tourist or hotel manager account, confirm its email and sign in. A guest requesting the manager workspace returns there after sign-in. Sign out from Account. Use the recovery link to change a password. [Auth setup](auth-setup.md) records email templates, callback configuration and trusted administrator provisioning.

The ignored `.env` now contains the existing database connections, derived Supabase project URL, configured publishable key and local app origin. The safe placeholders are in `.env.example`.

## Implementation

- Supabase Auth handles registration, confirmation, sign-in, sign-out, recovery and TOTP MFA. Prisma stores protected account roles. Manager registration is allowlisted, and administrator assignment requires the operator command and a confirmed account with a verified authenticator.
- Server checks verify the Supabase user, then run Prisma transactions with authenticated identity claims. PostgreSQL policies enforce active sessions, own profiles and own hotel drafts. Private pages and refreshed-cookie responses use private/no-store caching.
- Local return paths and bounded guest draft references survive authentication. Mutations check the configured origin. PostgreSQL supplies a shared, atomic limit of eight attempts per identity per 15-minute window. Callback tokens are excluded from development request logs.

## Verification

- The account migration was applied to the development database. An initial reserved-word SQL error rolled back the transaction. Quoting the column, rehearsing a rollback and retrying deployment succeeded.
- `auth:verify` passed with two tourists and two managers. Checked profile isolation, manager draft ownership, attempted administrator escalation, denied listing writes, revoked-session reads, external-return rejection and shared rate limits. The fixtures rolled back.
- Browser tests used temporary confirmed development identities and then deleted them. Passed provider-backed sign-in, return to the manager workspace, MFA enrollment and verification, administrator MFA access, sign-out, old-cookie replay denial and tourist denial.
- Separate temporary token fixtures passed provider-backed email confirmation, expired recovery rejection, valid recovery, password change and sign-in with the changed password. These tests exercised the callbacks without sending email to an inbox. Actual inbox delivery and dashboard email-template settings still need review with your own address.
- Build, lint and standalone type checking passed. Account screens and redirects were checked at 360 px. Prisma connection acquisition was increased to a bounded ten seconds after a cold hosted-pooler connection exceeded its default wait.
- Your permanent administrator account has not been chosen. Use the trusted provisioning command in the setup guide after enrolling its authenticator.

---

# Module 03 · Prisma and PostgreSQL preparation

**Completed on 9 November 2026.** The user supplied corrected development pooler credentials after the initial preparation.

## Scope

Prisma manages the PostgreSQL catalogue through the existing adapter. The fixture file becomes development seed input. Runtime reads use the database and a restricted public role. Catalogue routes keep their URLs and read at request time. An unavailable database shows a retry screen.

The schema includes catalogue publication, destination relationships, media, rooms, private hotel ownership and private guide verification. The migration adds PostgreSQL constraints, RLS and explicit grants. Runtime and migration connection strings are server-only.

## Connection handoff

Follow [Prisma database setup](database-setup.md). Configure the ignored `.env.local` using `.env.example`, then review and apply the migration, seed the development database and run `db:verify`.

The migration and repeatable development seed were applied successfully to the configured Supabase development database.

## Verified locally

- Prisma 7.10.1 schema validation and client generation passed without database credentials. The generated client is ignored and recreated during installation and build.
- The initial PostgreSQL SQL was generated from the schema. Reviewed the additional capacity, currency, price and destination constraints, public read policies and private-table denials. These await execution against PostgreSQL.
- Production build, lint and standalone type checking passed. Listing routes are dynamic and require no database during the build.
- Chrome verified that home returned HTTP 200 and that Explore and a detail route showed the safe retry screen without a configured connection. Retry remained available. The visible text exposed no connection strings or Prisma diagnostics, and no fixture listings appeared.
- `.env.local` and generated client files are ignored. `.env.example` is tracked with empty values.
- npm reported eight moderate dependency advisories during installation. No forced dependency upgrades were applied.

## Next action

Module 03 acceptance passed. Both pooler connections authenticated. `db:verify` passed published reads, hidden records, parent suspension, write denial, private-table denials and capacity/currency/price checks. Database-backed catalogue pages returned 200 after restart, while unknown, draft and suspended detail URLs returned 404.

## Connection attempt on 9 November 2026

The user supplied the transaction and session pooler URLs in ignored `.env`. Prisma configuration, seed and verification scripts now load `.env.local` followed by `.env`, matching the app's precedence.

The first attempt reached both endpoints but rejected credentials with PostgreSQL code `28P01`. The user corrected the passwords and both endpoints then authenticated. No secrets were printed. Migration, seed and acceptance checks subsequently succeeded.

---

# Module 02 · Discovery with local data

**Completed on 9 November 2026.** Next module: 03, PostgreSQL catalogue.

## Review Module 02

1. Open [Explore](http://127.0.0.1:3000/explore), or search for Bumburet from home.
2. Open [Bumburet Valley](http://127.0.0.1:3000/destinations/bumburet-valley) and copy its URL into another browser on the same laptop. Follow its related museum or sample guide link.
3. Filter activities to Bumburet and apply the filters. Search for an unknown term and use Clear filters. Sort the full catalogue by name and follow Next and Previous.

## Implementation and verification

- Six published development fixtures cover two destinations, two museums, a fictional hotel and a fictional guide. Each has a stable ID, slug, publication state and review date. Sources and photograph credits appear on details. The hotel and guide examples have no booking or contact actions.
- The shared catalogue adapter owns search, filtering, sorting, publication checks and detail reads. Three items appear per page, page numbers are bounded, query text is capped at 100 characters, and category, location and sort fields are allowlisted.
- Six detail URLs returned HTTP 200. Unknown destinations, mismatched categories, the draft hotel and the suspended guide returned HTTP 404. Neither hidden record appeared in search.
- Browser checks passed in Chrome at 1366 px with JavaScript and 360 px without JavaScript. Checked home search, a fresh browser opening the copied URL, related links, combined filters, both pagination directions, alphabetical sorting, zero results and clear filters.
- Invalid filter names fell back to valid defaults. Oversized page numbers clamped to the final page and a supplied page-size parameter could not change the three-item limit. HTML-shaped query text rendered as text, with no injected image. Long queries remained within the input bound without horizontal overflow.
- The first browser check exposed ambiguous wrapped select labels. Explicit label associations fixed the controls. Navigation checks subsequently waited for the destination page before asserting its content.
- Lint, production build and standalone type checking passed. The build generated six public listing pages. Desktop and mobile Explore screenshots were visually inspected.
- No dependencies or services were added. npm scripts bind to loopback, and metadata marks the fixture build noindex. Keep the catalogue local during development.

---

# Module 01 · Branded navigation

**Completed on 9 November 2026.** Next module: 02, discovery with local data.

## Review Module 01

1. Open [the local home page](http://127.0.0.1:3000/) as a guest. On desktop, use Explore in the header or the link below the search box.
2. Set the viewport to 360 px wide. Tab to Menu, press Enter, then Escape. Focus returns to Menu. Reopen it, tab to Explore and press Enter. Use the GoChitral logo to return home.
3. Search for `Bumburet`. Copy the [result URL](http://127.0.0.1:3000/explore?q=Bumburet) into another tab and clear the search. Module 02 supplies the first catalogue listings.

## Implementation and verification

- The shared layout includes the original logo, Home and Explore navigation, skip link and footer. A native mobile disclosure supports keyboard navigation without JavaScript. The home page includes an attributed photograph and a labelled GET search form. No packages, services or environment variables were added.
- The initial production HTML contained the home heading and Explore link. Browser checks passed in Chrome at 360 and 1366 px, with JavaScript on and off. Both widths fit without horizontal scrolling. Navigation, return via the logo, search, and clear all worked. Escape closed the enhanced menu and restored focus.
- A first browser run found that partial prerendering left the query response hidden with JavaScript disabled. Explore now renders the query on the server and home stays static. All four browser configurations passed on the rebuilt app.
- A guest submitted literal HTML brackets and an ampersand through the search form. The URL round-tripped the text, the heading showed the literal query and the browser created no injected element.
- Temporarily omitting the logo produced the text home link on Explore. The server identified the expected asset path. The original file was restored and its Git diff was empty.
- `npm run lint`, `npm run build` and `npm run typecheck` passed.

---

# Module 00 · Windows project setup

**Status on 9 November 2026** — Completed. Git checkpoint title: `Set up GoChitral Windows project (Module 00)`.

## Review

Open the project root in PowerShell and follow the [Windows setup and verification steps](../README.md). Open the printed local URL as a guest. The home page should display the supplied GoChitral artwork and a short description of the project.

## Setup

The workspace began with an empty Git repository. The app uses the npm-based Next.js App Router scaffold, strict TypeScript, Tailwind CSS and the `@/*` source alias. The lockfile records Next.js 16.4.5, React 19.3.0, Tailwind CSS 4.3.5, TypeScript 5.9.3 and ESLint 9.39.5. CI uses the Node version in `.nvmrc` and runs the clean install, lint, build and type check on Windows.

Git 2.56.0.windows.4, Node 24.22.1, VS Code and browsers were available to the setup session. npm was missing from its initial PATH. The official Node 24.22.1 Windows ZIP was checked against the release SHA-256 and supplied npm 11.19.1 for this build.

The Markdown guide was copied from the supplied file. Its companion Word edition embedded JPEG data under a PNG filename. The supplied artwork was saved as a true PNG at `public/brand/gochitral-logo.png`. This module requires no accounts, environment variables, migrations or external services at runtime.

## Verification

- `git check-ignore -v .env.local` identified the scaffold's `.env*` rule.
- The workspace guide and supplied guide had matching SHA-256 hashes.
- The 1536 × 630 logo and its source had matching SHA-256 hashes of the decoded pixels.
- `npm ci` installed 358 packages from the lockfile. npm warned that the scaffold's pinned ESLint 9 release is deprecated.
- The dev home page returned HTTP 200 on loopback port 3100. The network-isolated server was unreachable from the health check. Running both on the host resolved it.
- `npm run lint` passed after switching the logo's internal home link to Next.js Link.
- `npm run build` generated a static home page. The first build failed to connect to the CSS worker under sandboxing. Running the build on the host with a fresh generated Next.js cache passed.
- `npm run typecheck` passed after the build.
- `npm start -- --hostname 127.0.0.1 --port 3000` served the production home page, compiled stylesheet and logo with HTTP 200. The HTML contained the page title, home link and description. The CSS included the Tailwind layout utility, and the served logo matched the project file byte for byte.

## Next module

Module 01 adds branded navigation, an Explore entry point and a keyboard-accessible mobile menu.
