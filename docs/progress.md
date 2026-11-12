# Module 11 · Recommendations and travel assistant

**Module 11 is ready for review.** The recommendations page remains available. The user-facing assistant is a separate chat at `/assistant`; `/plan` remains a manual itinerary builder.

## Recommendations

- `/recommendations` filters published choices by destination and interests, with an optional PKR price target. It uses `rankListings()` to show scores, reasons and missing information. Missing ranking signals are omitted and remaining weights are renormalized. Historical popularity/case signals are not included; Module 12 has not started.
- `recommendations:verify` passed its deterministic examples and checks for stable ties, destination filtering, reasons, no eligible listings and missing prices. It writes no database rows.
- The connected catalogue previously showed 2 destinations, 2 activities, 11 hotels and 10 guides. Many entries are clearly marked demo listings.

## Conversational assistant follow-up

- Added a dedicated `/assistant` page with suggested questions, a free-text chat box, trip dates and traveler controls, follow-up questions, hotel/activity/guide cards and day-by-day itinerary replies. Added “AI Assistant” navigation and separate links from the home page for asking the assistant and planning manually. The manual `/plan` page no longer contains the automatic plan generator.
- The user chose to keep this as a local demo until selecting an AI provider. It makes no external model calls. It matches supported requests against published GoChitral listings with the existing ranking and planning functions; unsupported questions receive a clear limitation message. This gives the conversation shape and catalogue flow, but it is not yet Tripadvisor-level open-ended AI. No model key or data is transmitted externally.
- `POST /api/assistant/chat` validates same-origin JSON, limits messages to 500 characters and request bodies to 4 KiB, rate-limits requests, and reads only published records. Chats stay in page memory and are not written to the database. Prices or availability without current catalogue values are shown as unknown; the assistant does not book or save a trip.
- Browser check on `/assistant`: “Show me family hotels in Bumburet” returned three published hotel cards with prices and match explanations. A request for a 3-day trip with PKR 50,000, four people, Bumburet Valley and nature/culture returned a day-by-day plan from 1–3 December 2026. A separate browser check confirmed `/plan` contains the manual trip controls and no assistant panel.
- `assistant:verify` passed follow-up prompts, extracting multi-turn details, a repeatable three-day plan, hotel suggestions and unsupported-question fallback. `planner:assistant:verify`, TypeScript and targeted ESLint passed. Tests wrote no database rows.
- A production build was not run because the development server owns `.next`; its previous build attempt failed on a Windows file lock. Retry after stopping the development server in the VS Code terminal. The knowledge database models, tables and migrations are retained without a user-facing page or runtime reader to avoid dropping data or disturbing migration history. No Module 12 work has started.

---

# Module 10 · Maps and route estimates

**Implemented on 10 November 2026 and ready for user review.** Open a located destination such as `/destinations/bumburet-valley` or `/plan`, then use its map button. The OSM standard raster tiles are best-effort and stay on-demand; OSRM's public endpoint is a demo with no uptime promise and a one-request-per-second limit. See [map and routing notes](maps.md).

## Scope

- Add a map drawer that loads its map renderer and visible tiles only after opening. Keep names and dated visitor notes available as text if map tiles are blocked.
- Add a fixed-host, driving-only route adapter with validated local-region coordinates, bounded request size, timeouts and a strict per-process/provider quota. Route estimates are estimates, not live road status.
- Test the single-stop path, invalid coordinates, successful route parsing, unreachable route, timeout and quota exhaustion. Keep the existing listing/planner flow usable when routing fails.

## Implementation and observed checks

- Added a lazy-loaded map drawer to listing pages and each saved planner day. It shows mapped stops, their names and visitor notes, visible OpenStreetMap attribution, manual pan/zoom and an optional route estimate. Unmapped stops remain in the text list; selections over eight stops are explained and remain readable. No tile preload, offline storage or untrusted provider URL is used.
- Added three reviewed coordinates for Bumburet Valley, Chitral town and Kalasha Dur Museum. The connected database confirms all three values. Verified coordinate references and provider terms are recorded in [map and routing notes](maps.md).
- Added `POST /api/routes/estimate` with same-origin and JSON checks, streamed 8 KiB body limit, Pakistan-region coordinate validation, maximum eight stops, fixed OSRM driving host, response size/schema bounds, 7-second provider timeout, and per-process one-call-per-1.1-second plus five-per-client-per-minute limits. One stop is handled locally without a provider request. Error responses leave selected place order intact.
- `maps:verify` passed coordinate bounds, stop limits, fixed provider host and coordinate order, single-stop no-call, successful result parsing, no-route, timeout, malformed/failed provider responses, and global/client quota checks. TypeScript passed. Targeted ESLint passed with one expected warning for native `<img>` map tiles; Next image optimization is not appropriate for externally hosted map tiles. The initial check caught a React state-in-effect lint error and two inferred `any` errors; those were fixed and checks rerun successfully.
- Browser review confirmed the public guide directory still renders ten profiles and the Bumburet listing page renders its map trigger and coordinates. The map drawer opening and live external route request could not be confirmed in this run: the shell could not connect to the local app server, and the existing browser view did not show an opened dialog after activation. No live OSRM uptime claim is made. Review the drawer in the running app before starting Module 11.
- A missing request body now produces the normal invalid-JSON response rather than the misleading oversized-body response. No package was added; npm DNS was unavailable and the custom renderer keeps the current dependency set unchanged.

---

# Module 09 · Guide requests

**Completed on 10 November 2026 and ready for user review.** Review the public directory at http://127.0.0.1:3000/guides, the fictional sample at `/guides/sample-bumburet-guide`, and the administrator queue at `/admin/guide-requests`.

## Implementation

- Added public guide profiles to the existing listing and publication flow. Administrators can publish a guide's languages, expertise, service areas, public credential summary and fixed per-group/per-day price. Private verification evidence stays private. Added a clearly fictional sample profile; it creates no accounts or requests.
- Tourists can request a guide for an owned saved trip and inclusive service dates. Server checks the session role, listing/profile publication, saved-trip ownership and date bounds. Requests snapshot the displayed guide name and price. An owner-scoped idempotency key makes safe retries return the original request.
- Added private request status pages and a reasoned admin decision queue. Only pending requests can be confirmed or declined; each decision is audited. Database locking prevents overlapping confirmed bookings for the same guide, while adjacent date ranges remain available. Editing a saved trip cannot remove dates with pending or confirmed guide requests.
- Applied Prisma migrations 202611100010 through 202611100012 after rollback rehearsals. Row policies restrict owner/admin access; public catalogue reads expose only published guide profiles. Guide request details remain private and uncached.
- Added nine more fictional guide profiles for a total of ten published profiles. Each new title, summary, credentials note and visitor note says the profile is demo data; no user accounts or guide requests were created. The reusable idempotent seed is `prisma/seed-demo-guide.ts` (`db:seed-guides`).
- Added an administrator dashboard with total account/trip/listing counts, account roles, listing categories and statuses, pending revisions, hotel/guide queue counts, recent moderation totals, review shortcuts and a role-permissions table. A fixed aggregate-only function in the unexposed `gochitral_private` schema supplies global counts after checking the current administrator session. No emails, credentials or trip contents are returned.

## Observed checks and repairs

- `guides:verify` passed idempotent retries, ownership/date bounds, owner/admin isolation, private reference handling, concurrent overlapping confirmation, adjacent dates, pending-only decisions, audit history, declined history and the eight-per-15-minute limit. Temporary test requests, profile, trips, sessions, accounts and rate-limit rows were removed.
- `planner:verify`, `auth:verify`, `publishing:verify` and `trips:verify` passed after adding guide-related compatibility coverage. `db:validate`, Prisma client generation, TypeScript checking and source lint passed. The demo seed ran and the sample profile was added without creating user accounts or bookings.
- Admin dashboard migration 202611100013 was applied to the connected GoChitral Supabase project and recorded in Prisma migration history. A temporary administrator session inside a rolled-back SQL transaction received metrics; a tourist was denied. Supabase grants confirm the anonymous role cannot access the private schema/function. TypeScript and targeted ESLint checks passed. The sandbox could not reach the direct database URL for the `admin:verify`/`guides:verify` CLI runs (Prisma P1001); equivalent dashboard authorization and live guide counts were checked through the connected Supabase tool.
- The live `/guides` page returned HTTP content with all ten profiles. The first open browser tab showed an old Internal Server Error state; opening the current `127.0.0.1:3000` app loaded the directory successfully. `/admin` correctly returned Access denied to the current non-administrator browser session. The successful administrator dashboard screen still needs review in an administrator session.
- The production build could not complete in this OneDrive workspace: Next.js returned Windows `EPERM` while creating/deleting generated `.next` output. A later Prisma status check stalled at the hosted schema-engine step. Migration deployment and the guide database acceptance check had already succeeded. Browser acceptance was not completed in this final run.

---

# Module 08 · Saved trips and printable summaries

**Completed on 10 November 2026 and ready for user review.** Module 09 has not started. Review at http://127.0.0.1:3000/my-trips after signing in. [Saved-trip review steps](saved-trips.md) cover guest sign-in, retry, edits and browser printing.

## Implementation

- Added private Trip, TripDay, TripItem and TripSave receipt tables through Prisma migration 202611100009_saved_trips. Migration rehearsal rolled back successfully, then deployment and generated-client validation passed. Owner RLS covers parents and children, one day per trip/date is enforced, and the composite day/trip foreign key prevents cross-trip child links. Titles, quantities, units and integer price snapshots survive catalogue withdrawal.
- Save itinerary retains the guest draft through sign-in, refreshes and validates published data, then saves the full itinerary and a unique owner/save-key receipt in one transaction. Concurrent retries use a transaction lock and durable receipt; lost-response retries return the original trip. Updates check the expected revision and atomically replace days/items. Current owner identity comes from Auth.js. Confirmed success clears only the matching device draft; timeouts/conflicts preserve it.
- Added My trips, detail, edit and independently authorized print routes. New accounts see Plan your first trip. A saved trip's detail, edit and print load a consistent database snapshot, mark withdrawn choices unavailable, retain their saved titles/estimates, and offer replacement through the existing planner. Edit drafts use a separate per-trip device key. Guide choices display Not requested; actual requests remain Module 09.
- Private responses/exports are private/no-store and excluded from indexing. Trip data is not sent to external analytics, routing or document services. Print / Save as PDF uses the browser, with escaped text, all calendar days, price units, subtotal, unknown costs and guide status.

## Observed checks and repairs

- trips:verify passed the PKR snapshots, forced rollback before commit, post-commit replay, concurrent retries, optimistic edit conflict, owner/admin/public isolation, day uniqueness and composite foreign key, immutable identity, withdrawn title/price retention and revoked sessions. Its temporary accounts, sessions, trips and catalogue fixtures were removed. planner:verify and auth:verify passed.
- Browser testing confirmed guest sign-in recovery, a simulated lost response after the save committed, same-key replay returning one trip, clearing the confirmed guest draft, My trips reopening, escaped titles, owner-only detail/edit/print, stale-tab edit rejection, explicit reload, withdrawn snapshots, empty state and 360/641px layouts. It caught an early loading boundary returning HTTP 200 for denied private pages; removing that boundary restored correct not-found/redirect responses before rendering. Cross-user content denial was checked again.
- Reloading a saved version now clears stale conflict notices and resets the review step. Discarding an edit draft returns to the saved itinerary; blocked browser storage does not turn an edit into a new trip. Print spacing was tightened after visual review found a short itinerary wasting a mostly empty subtotal page.
- Build, standalone typecheck and lint passed. A Supabase advisor request was unavailable because the connected tool required a link_id; no advisor scan result is claimed. Owner/public/session policies were verified directly by database and browser tests.
- The final browser rerun passed after the fixes, including removal of the stale conflict warning after reload. The actual browser PDF was rendered with Poppler and visually inspected; its three calendar days, PKR 15,000 subtotal, unknown cost and guide status now fit legibly on one A4 page. The mobile saved-trip screenshot was also visually inspected. All browser test trips, sessions and temporary catalogue records were removed. Existing accounts and demo hotels remain. The final app is running at http://127.0.0.1:3000.

---

# Module 07 · Day planner and budget

**Completed on 9 November 2026 and ready for user review.** Module 08 has not started. Open http://127.0.0.1:3000/plan as a guest. [Planner review steps and price units](planner.md) explain the three steps and administrator price fields.

## Implementation

- Added Trip details, Plan your days and Review budget at /plan, plus navigation/account links and Add to trip from Explore and listing pages. Guests choose dates, people, destinations, budget, hotel rooms, activities, stops and an optional guide. Add/replace/remove and quantity editing keep valid choices available after a failed check.
- Calendar days use date-only arithmetic and Asia/Karachi labels. Hotel rows charge the current room rate × rooms × one selected overnight date, with zero nights on checkout day. Unselected nights are explicitly excluded. Activities charge per participant; guide estimates charge once per group per service day. Unknown costs are separate from free services and excluded from the known subtotal. Review reloads current published records and marks unit prices changed since the last review.
- Added nullable nonnegative activity/guide prices through Prisma migration 202611090008_planner_prices. Rehearsal rolled back successfully, migration deployed, and the generated client/build include the field. Administrator price edits follow the existing draft/publish/audit workflow. Existing prices were left unknown rather than invented; hotel prices remain in published rooms. Existing RLS and parent-suspension policies apply to the planner's public-only query.
- Versioned device drafts expire after 24 hours and contain only planning settings, item/room IDs, quantities and previous unit prices. Drafts can be discarded explicitly. Browser storage and submitted snapshots/totals are untrusted. Review recomputes prices, checks publication/capacity/dates/destination membership and bounds days, people, item count and streamed body size. Responses use private/no-store. No account trip, export, guide request or routing integration was added.

## Observed checks and repairs

- planner:verify passed the PKR 15,000 worked example, same-day zero nights, month and leap-year boundaries, unknown versus free, room capacity, guide once/day, date impacts, hidden/unavailable IDs, tampered/stale price snapshots, limits and draft expiry/restore.
- planner:db passed published price reads, private draft price isolation, approved changes, refreshed quotes and withdrawal in a rolled-back transaction. publishing:verify and hotels:verify passed unchanged authorization/publication/hotel behaviors.
- Browser testing found an outside-date restored item was removed when continuing without changing dates. Fixed that: unchanged dates preserve the item and expose a removal control; changed dates show affected items and checkout-night changes before confirmation. Added clear text that only selected hotel nights enter the estimate. A first browser attempt timed out finding a destination; a fresh inspection found both public choices, and subsequent full runs progressed. No persistent destination-permission failure was reproduced.
- The final isolated Chrome run passed the actual 3-day/2-night/2-person PKR 15,000 example, refresh recovery, date confirmation/cancel, capacity failure and repair, current rate changes, simulated 503 price-check recovery without losing choices, outside-date removal, Add to trip, expiry/discard, anonymous API validation, hidden-ID denial, tampering resistance, 64 KB body limit and cross-origin denial. Desktop and 360px planner/budget screens were checked; mobile had no horizontal overflow and screenshots were visually inspected. No browser page errors were reported. Temporary hotel/activity/room records were removed.
- Production build, standalone typecheck, lint and the final planner calculation checks passed. The final app is running at http://127.0.0.1:3000. No new test account or credentials were needed.

---

# Hotel photos, demo hotels, performance and palette · 9 November 2026

Completed the user's Module 06 follow-up. Module 07 has not started. [Observed results and performance measurements](performance-review.md) record the upload investigation, remaining latency and review links.

Reproduced a successful manager WebP upload before changes (8.797 s); the reported universal failure was not reproduced. Removed the R2 write from the database transaction, increased its storage deadline, and added disabled-button instructions, visible progress, JSON errors and file-selection reset. A real PNG upload (5.265 s), decoded private preview and guest denials passed. The timings use different files and are not a controlled upload speed comparison.

Added ten fictional demo hotels assigned to the retained manager, twenty rooms and ten clearly labelled R2 illustrations through the existing submission/approval services. Existing catalogue/user content was preserved. A repeat seed created zero duplicates. Applied the requested Pearl 60%, Aubergine 30%, Terracotta 10% visual balance across shared pages and workspaces, preserving the logo.

Reduced catalogue reads to one joined query with public RLS and request-local metadata/page deduplication. Reused the current account role already read by Auth.js instead of making another account transaction. Role/session checks remain fresh on each request and private operations retain RLS/activity checks. Added navigation loading feedback. Warm Explore content fell from 2.65 s to around 1.05 s; the measured manager-page median fell from 4.63 s to 2.58 s. Remote database round trips of roughly 0.2 s and cold photo retrieval remain visible. No infrastructure was moved.

Build, typecheck, lint, auth:flows, publishing:verify, hotels:verify and db:verify passed. Browser verification passed upload validation/progress/preview, three-account role access, ten editable demo hotels and mobile overflow checks. Desktop/mobile screenshots were visually inspected. Temporary upload fixtures/objects and captured browser sessions were removed. The rebuilt app runs at http://127.0.0.1:3000. Restaurant functionality does not yet exist; no new category/module was added.

---

# Local administrator sign-in · 9 November 2026

At the user's request, local administrators now sign in with email and password without an authenticator code. The ignored .env sets AUTH_REQUIRE_ADMIN_MFA=false. The app accepts this opt-out only for a loopback APP_ORIGIN; missing settings and non-local origins require MFA. Set the flag to true and restart to restore codes. Existing accounts, passwords and enrolled authenticator secrets remain unchanged. Module 07 has not started.

Updated the server role guard, account links, stale MFA-page redirect, trusted operator provisioning and PostgreSQL admin policy together. Sessions retain their real assurance level; password-only sessions are not marked MFA-verified. Migration 202611090007_optional_admin_mfa is applied. Review instructions explain the setting. An accidental documentation text replacement was repaired, and all three original saved passwords were verified against their unchanged database hashes.

Build, typecheck, lint, auth:flows, publishing:verify and hotels:verify passed. Tests cover local and non-local settings, MFA enforcement when enabled, password-only admin writes with audit records, tourist denial and revoked-session denial. Fresh HTTP sign-ins passed for all three saved accounts: admin opened /admin and /admin/hotels with aal1 and a null database MFA timestamp; tourist and manager received Access denied at /admin. The old MFA URL returned to /account and its account link was hidden. Guest and revoked admin sessions returned to sign-in. Captured HTTP test sessions were removed.

Review: refresh http://127.0.0.1:3000/account/sign-in, use the existing administrator credentials in the ignored docs/development-credentials.local.md, and open /admin. The rebuilt app is running at http://127.0.0.1:3000.

---

# Module 06 · Hotel manager workspace

**Completed on 9 November 2026 and ready for user review.** Module 07 has not started. The user selected Cloudflare for images, enabled R2 and supplied the app's bucket-scoped keys in the ignored .env.

## Review Module 06

Use the retained manager account in the ignored docs/development-credentials.local.md and open http://127.0.0.1:3000/manager/hotels. Create a hotel, add rooms, save a draft, upload a photo and submit for review. Sign in as administrator with email and password for local testing and open http://127.0.0.1:3000/admin/hotels. Review and approve the submission, then open its public link. [Hotel workspace review steps](hotel-workspace.md) include edits, archival, photo setup and cleanup.

## Implementation and checks

- Prisma owns separate private hotel, room and photo drafts. Managers cannot change public content or moderation status. Approval publishes the listing, amenities, active rooms and approved photo visibility atomically using the existing audited publishing service. Current public prices stay unchanged while a manager edits a draft. Archived public rooms keep their stable IDs and last approved prices; trip snapshots remain part of the later trip module.
- Added manager list/editor routes, tabs that preserve unsaved inputs, a shared public/preview room-and-amenity component, admin review queues, change-request notes and public hotel links. Existing manager landing content was preserved and linked to the new workspace after automatic review rejected an unconditional replacement.
- Created the private Cloudflare R2 gochitral-media-dev bucket in APAC. The user supplied the scoped S3 access keys; account/bucket values and safe placeholders are in .env/.env.example. Real R2 write/read, signed preview and unsigned-access denial passed. R2 returns HTTP 400 for the unsigned test request. Temporary storage test objects were removed.
- Uploads check owner, shared attempt limits, actual image signature/decoding, 5 MB input, 20 megapixels and bounded dimensions, then re-encode resized WebP without metadata under generated keys. Processed images are limited to 2 MB, eight active photos per hotel and fifty stored photos per manager. Private previews expire after sixty seconds. Public photo requests require an approved photo and visible hotel/parent. Owner-supplied images retain appropriate attribution rather than a Creative Commons claim.
- The hotel migration passed a rolled-back rehearsal and deployed successfully. hotels:verify passed two-manager room/photo isolation, immutable ownership/approval/storage fields, photo overwrite denial, eight-photo quota, pending freeze, stale saves, approval, private draft rates, archive retention, suspension and malformed/oversized/dimension-limited image rejection. Fixtures rolled back. publishing:verify, auth:verify and db:verify passed.
- Automatic approval review blocked cleanup against existing photos. The command now defaults to a dry run; deletion requires an explicit --delete flag. The dry run passed with zero candidates and deleted nothing. Cleanup locks and rechecks each hotel, excluding approved photos and pending submissions.
- The final Chrome browser run passed manager draft creation, validation feedback for an invalid room on a hidden tab, room edits across tabs, real R2 upload, forged and oversized upload denial, cross-owner editor/photo/upload denial, admin MFA approval, public room/photo reads, draft prices staying private, stale-tab text preservation, public suspension with hotel HTTP 404/photo HTTP 403, and a 360px layout without horizontal overflow. The mobile editor screenshot was visually inspected. Fixed oversized-file feedback, approval confirmation disappearing after revalidation, two-decimal PKR display and hidden-tab native validation blocking form feedback. All browser test hotel records, R2 objects, temporary managers and test sessions were removed. A final count found zero test hotels/temporary managers and the three retained user-review accounts.
- One acceptance attempt hit a cold sign-in transaction timeout (P2028). A direct health query responded normally at 200 ms, and the warmed retry passed the entire browser flow. This observed hosted-database timeout remains recorded rather than being treated as a hotel permission failure.
- Final build, standalone type checking and source lint passed. The development server runs at http://127.0.0.1:3000. The guide now records the user's Prisma, Auth.js and Cloudflare R2 choices.

---

# Sign-in speed and eye icon · 9 November 2026

The user confirmed sign-in now works and asked why it is slow, plus an eye icon for password visibility. Measured the running production build before changing the login flow. A warm hosted-database round trip took 218 ms. Three manager login plus Account-page timings were 10.609 s, 8.710 s and 9.378 s.

Removed the redundant proxy database session refresh; private pages and mutations still enforce authentication themselves. Reused the session/MFA state that Auth.js has just validated instead of reading the same session again. Combined the shared rate-limit operation and credential lookup in one transaction. The initial JWT callback now uses the freshly verified account/session returned by Credentials; later requests always revalidate that session in PostgreSQL. Kept password hashing, rate limits, origin checks, database RLS, per-operation session checks and administrator MFA.

Replaced the password visibility text with an inline eye/eye-slash icon inside the input. Kept accessible Show password/Hide password names, keyboard operation and a large click target. The previously prepared pending submit control is now built and shows Signing in… while the request runs.

The final production build measured 7.228 s, 5.226 s and 6.489 s for the same login-plus-Account flow (median 6.489 s versus 9.378 s, about 31 percent lower). The first login includes a cold application database connection. These are local measurements, not a guaranteed response time; hosted-database network latency remains.

Build, standalone type checking, lint, auth:flows, auth:verify and publishing:verify passed. Actual HTTP checks passed tourist/manager role restrictions, administrator MFA with the original cookie (fresh database MFA state), and denied a revoked tourist cookie. HTTP test sessions were removed. The in-app browser verified the eye control changes the input type in both directions, and its desktop layout was visually inspected. No schema change or new module was needed. The final build is running at http://127.0.0.1:3000.

---

# Brave sign-in investigation · 9 November 2026

The user reported the generic failure message while using Brave at http://127.0.0.1:3000 with manager@gochitral.test. Checked all three private saved credentials against the database: account IDs and bcrypt passwords match, confirmation is not required, and the accounts exist. Fresh Chrome sign-ins for tourist and manager both opened /account. The user's Brave failure has not yet been reproduced or explained; requested a retry with clearer feedback.

Separated incorrect-credential errors from temporary service errors and added safe Auth.js error-type/code logging without password, email or token output. Added a Show password control to the existing forms. Normalize surrounding whitespace and case in email addresses while preserving passwords exactly. The private credentials were not changed.

The auth:flows regression passed, including copied-email normalization and existing session, recovery, MFA and limit checks. Build, lint and standalone type checks passed after correcting the logger's Error type guard. In-app browser checks verified password visibility controls and the real incorrect-credential redirect/message. The dummy login counter was removed, and exactly one tourist, manager and administrator remain. The local server is running. Reading the user's Brave window was unavailable because app access timed out. No new module started.

---

# Fresh test accounts · 9 November 2026

At the user's request, removed all six existing application accounts and all three old Supabase Auth accounts. This removed the old stored password hashes, account sessions, confirmation/recovery tokens and MFA factors. Cleared old rate-limit records, the remaining unused provider login flow and old links in the private local outbox. The provider's user, identity, session, refresh-token, MFA-factor, one-time-token and account-audit stores are empty.

Created exactly three fresh test accounts: administrator, tourist and hotel manager. Each has a new random alphanumeric password. The administrator has a new encrypted authenticator setup key and still requires a current code. Their email addresses, passwords and the admin setup key are saved only in the ignored docs/development-credentials.local.md. The old private credentials file was replaced. Existing catalogue content remains available.

Chrome passed sign-in for all three accounts. The tourist Account page and Explore opened, and the manager workspace denied tourist access. The manager's empty hotel workspace opened. The administrator passed MFA and opened the publishing workspace. Removed the browser test sessions and confirmed exactly one account for each role remains. No code change or new module was needed. A separate tourist dashboard has not been built; the current Account page already supports tourist sign-in.

---

# Login and password follow-up · 9 November 2026

The user reported the 15-minute attempt-limit message. The old limiter shared one email bucket across registration, sign-in and recovery and counted successful sign-ins. Cleared the development tourist/manager lockouts, separated the operation buckets and made verified successful sign-ins clear their failed-attempt count. Eight failed attempts still enforce the existing 15-minute limit. Sign-in now displays the specific rate-limit message. Only the trusted auth backend can clear that counter.

New registration and reset passwords now require at least eight characters with a letter and a number. Existing passwords continue to work. The visible hint is exactly “Use at least 8 characters.” The technical maximum remains enforced internally. Updated setup documentation.

The migration passed a rolled-back rehearsal and deployment. auth:flows passed eight-character validation, repeated successful login without lockout, separate operation limits, failed-attempt lockout, confirmation/recovery and revocation checks. An initial standalone test import pulled in the Next.js client runtime; keeping the service error independent of Auth.js fixed that test boundary. A PostgreSQL void return required a non-returning Prisma call; the regression passed after that correction. auth:verify passed and checked that authenticated users cannot invoke the counter-reset helper.

Chrome verified the retained tourist and manager credentials, eight-character registration/sign-in, exact hint at 360px, a cleared successful-login counter and the actual rate-limit error after eight failed attempts. Test accounts, counters and browser test sessions were removed. Build, lint and standalone type checks passed. The app was restarted at http://127.0.0.1:3000. No new module started.

---

# Authentication update · Auth.js

**Completed on 9 November 2026 at the user's request.** This replaces the Module 04 Supabase Auth implementation. Module 06 has not started. The user explicitly chose immediate local sign-in while SMTP is deferred.

## Review the replacement

Open http://127.0.0.1:3000/account/register, create a tourist or manager account, and sign in immediately. Existing development account credentials and the administrator authenticator setup key remain in the ignored docs/development-credentials.local.md. Administrator pages still require the current authenticator code after sign-in.

Submit /account/forgot-password and open the latest matching link in the ignored docs/auth-outbox.local.md. Save a new password, then sign in with it. The local outbox replaces inbox delivery during development. See [Auth setup](auth-setup.md) for optional SMTP settings and confirmation mode. Actual SMTP delivery is deferred and untested.

## Changes and observed checks

- Auth.js v5 Credentials (next-auth 5.0.0-beta.32) replaces the Supabase SDK. Prisma stores bcrypt credentials, database-revocable sessions, hashed single-use email tokens and encrypted TOTP secrets. Supabase remains the PostgreSQL host. No Auth.js adapter is needed for Credentials with JWT sessions.
- The migration passed a rolled-back rehearsal, then deployed successfully. Existing account UUIDs, emails, bcrypt hashes and protected roles were preserved. The retained development administrator's known authenticator key was encrypted into the new store and verified in Chrome. Previous provider sessions require a new sign-in; previous provider email links are retired.
- Replaced provider-dependent RLS helpers and the audit actor lookup with application-owned session identity. Backend-only auth tables deny authenticated-user access. Administrator checks require both the MFA claim and a matching database session with completed MFA. The public catalogue and publishing conventions remain intact.
- The ignored .env has a generated AUTH_SECRET, canonical AUTH_URL, immediate local sign-in, local email preview and SMTP placeholders. Removed unused Supabase public auth keys. Updated .env.example, setup instructions and the ignored development account review notes.
- Added auth:flows. It passed local registration, role allowlisting, wrong-password rejection, optional confirmation, token hashing, one-use confirmation/recovery, expired recovery denial, password replacement, session revocation, tamper-resistant MFA encryption and bcrypt byte limits. Fixtures and their local email previews were removed.
- auth:verify, publishing:verify and db:verify passed. Included private auth-table denial and rejection of an MFA claim without a verified database session. Transaction fixtures rolled back.
- Chrome passed tourist and manager registration/sign-in, manager return paths, tourist/manager admin denial, tourist manager-workspace denial, sign-out and old-cookie replay denial, recovery, changed-password sign-in and consumed-link rejection. The migrated manager password and administrator password/MFA/publishing workspace passed. An idle operator connection reset during browser fixture cleanup; a fresh connection checked cleanup and confirmed no matching test accounts remained.
- A focused Chrome run passed fresh MFA enrollment, current-session MFA, TOTP replay rejection, confirmation callback/replay denial and 360px registration validation with account-type/return-path preservation. The focused fixture was removed.
- Final production build and standalone TypeScript checks passed. The initial build hit a generated-cache Windows lock; clearing the verified .next cache and restarting compilation resolved it. Lint passed. The patched mail dependency is pinned through an override; npm audit reports no high/critical advisories and eight moderate advisories remain in the dependency tree.

---

# Module 05 · Administrator publishing

**Completed on 9 November 2026.** Next module: 06, hotel manager workspace. The user authorized continuing local development while SMTP remains deferred.

## Review Module 05

Use the Administrator section in the ignored `docs/development-credentials.local.md`. Add the setup key to an authenticator app, sign in and open [the publishing workspace](http://127.0.0.1:3000/admin). Verify the current code when prompted. [Publishing review steps](publishing.md) cover creating a listing, editing drafts in two tabs, publishing, suspension, reactivation and audit history.

## Changes and checks

- Added the Prisma publishing migration with versioned private draft revisions, optional public contact/coordinates and append-only moderation audit records. The migration passed a rolled-back rehearsal before deployment to the development database.
- Administrator access and MFA are checked on every moderation action and reinforced by RLS. A database trigger derives the actor and records the action, target, version, timestamp, reason and dependent-trip count in the same transaction. Trips arrive in Module 08, so the current dependent-trip count is zero.
- Save draft preserves the approved public listing. Conditional version updates reject stale saves while the controlled editor preserves unsaved text. Publish returns its public URL and revision. Category and slug stay stable after creation.
- Contact/source links require HTTPS. Coordinate pairs are bounded. Guides have private evidence separate from public descriptions. Photo selection uses the existing approved media. Pending revision state is ready for manager submissions in Module 06.
- `publishing:verify` passed for destinations, activities, hotels and guides. Checked draft visibility, stale saves, parent suspension hiding children, reactivation, audit ordering/actors, private guide evidence, administrator MFA denial, tourist write denial and validation. The test transaction rolled back.
- Existing `auth:verify` and `db:verify` passed after adding the admin write policies. A denied RLS update now returns zero changed rows, and the account check verifies that result.
- Browser acceptance passed creating/publishing a destination, saving an unpublished edit, preserving a stale tab's text, suspension with HTTP 404 and removal from Explore, reactivation with HTTP 200, and the six expected audit entries. A tourist replay of the actual moderation request was denied and the listing version stayed unchanged. Temporary test content and tourist identity were removed.
- The actual `catalogue.paths()` source included a published test record, excluded it while suspended and restored it after reactivation. That record was removed afterward. Public routes remain dynamic and moderation invalidates detail, list, admin and future sitemap paths.
- Desktop queue and 360 px editor screenshots were visually inspected. A misleading legacy draft label was corrected. Lint, build and standalone type checks passed.
- A queue check with 52 temporary hotel drafts verified the 50-record page limit, oversized-page clamping and category retention across navigation. The records were removed. Review dates defaulted to Pakistan time.
- A retained development administrator was created with confirmed identity and verified MFA through the trusted operator. Credentials and its authenticator setup key are stored only in the ignored local credentials file. No administrator is available through public registration.

---

# Module 04 · Accounts and role checks

**Implemented on 9 November 2026.** Live email signup is currently blocked by Supabase's sending limit. The user deferred SMTP configuration while proceeding with confirmed development accounts.

## Registration follow-up on 9 November 2026

### Retained development accounts for user review

At the user's request, a confirmed tourist account and an unconfirmed manager account were created through the trusted database operator. Random passwords and single-use, one-hour confirmation/recovery links are in the ignored `docs/development-credentials.local.md`. The file provides the test sequence and explains that the reserved email addresses have no inbox.

The tourist credentials passed browser sign-in and sign-out. The manager account correctly requires confirmation. The user's links were left unused. These accounts are retained for the user's manual review. Creating accounts through the public registration form and delivering email remain dependent on Supabase SMTP.

No permanent or default accounts were created. The temporary verification identities were deleted. A registration diagnostic returned HTTP 429 with Supabase code `over_email_send_rate_limit` and created no account. Email signup is enabled and confirmation is required.

The app now reports allowlisted registration failures, including email sending limits and SMTP recipient restrictions, instead of using the generic failure message for those errors. Failed registration preserves the selected account type and return path. The form explains the 12-character password requirement before submission.

The provider's email quota must recover, or a custom SMTP provider must be configured in Supabase, before confirmation-based signup can succeed. Default Supabase SMTP also limits delivery to organization team addresses. The previous browser tests verified temporary identities and callback handling, while real signup email delivery remained unverified.

The fix passed the production build, standalone type checking and targeted lint. Chrome at 360 px verified the email-limit and recipient-restriction messages, tourist/manager selection retention, password guidance and layout without sending more emails.

An external-browser follow-up confirmed both registration URLs returned HTTP 200, but submitting from localhost conflicted with the configured 127.0.0.1 origin. A standard Next.js host redirect now sends localhost requests to the configured local origin. Proxy-based redirects were discarded after Next.js normalized them into a loop. External Chrome verified both addresses load registration and submit sign-in without an origin error. The server was restarted after the successful build and type check.

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
