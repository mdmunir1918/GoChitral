# GoChitral build guide for Codex
AI tourist guidance and itinerary planning for Chitral

Current project choices: Prisma manages PostgreSQL hosted by Supabase. Auth.js handles authentication. Cloudflare R2 stores hotel photos privately, with public access only after admin approval. These user-approved choices replace older provider-specific steps below. Prefer the existing architecture and simple working approaches.

Build GoChitral one working module at a time. A visitor should be able to discover a real place in Chitral, plan a day around it, save the trip, request a guide and track the decision. Hotel managers maintain their listings. Administrators manage the information that travellers see.

## Start here
Keep this Markdown file at `docs/GoChitral_Build_Guide.md` in the project. Give Codex the prompt below for the first session. The Word edition is for reading and review. The implementation starts in Module 00.

> Read the GoChitral build guide and the repository’s AGENTS.md. Work on Module 00 only. Inspect the existing files first. Tell me which prerequisites are present and give me the Windows steps for anything missing. Complete the authorized setup, run its checks and show me the result. Stop before Module 01.

## Brand assets
Use **GoChitral** with this capitalization. Use the supplied flowing G and wordmark at `public/brand/gochitral-logo.png`. Preserve its proportions and original artwork. Follow the user's 60/30/10 visual balance: Pearl `#F5F2F6` for dominant surfaces (60%), Aubergine `#392F48` for structure, primary text and controls (30%), and Terracotta `#9A4A2F` for accents and key actions (10%). Treat the proportions as a visual guide, excluding photographs. Pair status colors with words or icons. Use the mark as a home link with the accessible name “GoChitral home”.

[Open the supplied GoChitral logo](https://chatgpt.com/library?file_id=libfile_8a39542ce28c81919059dd464708825a&account_id=personal)

## How to continue
Each module ends with an observable result. Review that result, then ask for the next numbered module. If a check fails, record the failure, repair it and rerun the check within the same module. Use the handoff template near the end of this guide when starting a new Codex session.

---

# 00  Set up the project on Windows
**Result** — A clean project opens on your laptop and another developer can reproduce the build.

1. Choose a folder on a drive with room for project dependencies, for example `E:\Projects`. Open PowerShell in that folder. If a GoChitral repository already exists, open its root, inspect its README and lockfile, and install with the existing package manager. Use the scaffold below only for a new project.
2. Install **Git for Windows** and a currently supported **Node.js LTS** compatible with Next.js (the checked framework minimum is Node 20.9). npm comes with Node. Use your existing VS Code and browser. Open a fresh terminal and check the installations.
```powershell
git --version
node --version
npm --version
```
3. For a new folder, run the scaffold command from its parent. Inspect the generated settings and record the resolved versions. Start the app and open http://localhost:3000 or the port printed by Next.js.
```powershell
npx create-next-app@latest gochitral --ts --tailwind --eslint --app --src-dir --use-npm --import-alias "@/*"
cd gochitral
npm run dev
```
4. Stop the dev server with Ctrl+C. Add the guide, copy the supplied logo to its specified path and merge the one-module rule into the root AGENTS.md. Preserve existing framework instructions. Initialize Git if needed. Commit the npm lockfile and record the exact Node version in the README and CI configuration.
5. In package.json, set the lint script to `eslint .` and add `typecheck` as `tsc --noEmit`. Run the production build before standalone type checking on a fresh clone if route types are generated during build.
```powershell
npm ci
npm run lint
npm run build
npm run typecheck
npm start
```
If PowerShell blocks npm.ps1, use `npm.cmd` and `npx.cmd` for the same commands. If the terminal cannot find Node or Git, reopen it after installation.

**Security and acceptance** — Check that .env.local is ignored with `git check-ignore .env.local`. Before committing, inspect `git status --short`. Pass when the local production page loads, all three checks pass and the README reproduces the setup. Stop here.

[Node.js LTS downloads](https://nodejs.org/en/download) · [Git for Windows](https://git-scm.com/downloads/win) · [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)

---

# Project requirements and file layout
**Architecture** — Use Next.js App Router, TypeScript and Tailwind CSS. Render public catalogue pages on the server. Use client components for interactions such as the planner and map drawer. Keep ranking, date validation and budget arithmetic in ordinary TypeScript functions so they can be tested separately.

| Add when needed | What to set up | Why it belongs here |
| --- | --- | --- |
| 00–02 | Node, npm, Git and a small reviewed local dataset | The first public pages can run without accounts or service keys. |
| 03–04 | Supabase development project, PostgreSQL, Auth, Storage, SQL migrations and Zod | Persist published content, validate writes and enforce row access. A hosted development project keeps Docker optional on Windows. |
| 04–09 | Vitest for calculations and transitions, Playwright with Chromium for real user flows | Introduce the tools with the first relevant test. Use an isolated test database for permission and concurrency tests. |
| 10 | Leaflet, a permitted tile service and a routing API; PostGIS when spatial queries are needed | Leaflet displays a map. A routing service supplies route estimates. PostGIS supports geographic queries in PostgreSQL. |
| 11–13 | Reviewed knowledge rules, HTTPS hosting, domain, Search Console | A hosted language model is an optional extension. Core trip planning and advice work without a model key. |

At the first automated test, run `npm install -D vitest @playwright/test` and `npx playwright install chromium`. Configure Playwright to start the app against test data. Use a separate data set per parallel worker or run database-changing tests serially.

## Grow the folder tree with the features
```text
AGENTS.md                      Current module and working rules
docs/GoChitral_Build_Guide.md   This guide
docs/progress.md               Last result and next module
public/brand/                  Original logo and approved exports
src/app/                       Route pages, layouts, actions and metadata
src/components/                Shared navigation and form controls
src/features/                  catalogue, planner, guides, assistant
src/lib/                       Server auth, database and provider adapters
src/data/                      Reviewed fixtures for development
supabase/migrations/           Versioned schema, constraints and policies
tests/                         Integration and browser tests
.env.example                   Variable names and safe examples
```
Keep route-specific UI beside its route. Create a shared abstraction when two features genuinely need the same behavior. Use one catalogue interface so Module 03 can replace fixture reads without changing page URLs. Files under public/ can be downloaded by anyone.

---

# Delivery sequence and access rules
The final conceptual presentation supplies the roles and flows. The order below turns them into units small enough to review. PKR estimates, booking conflict rules, testing budgets and hosting choices are implementation defaults in this guide.

| Sequence | Deliverable to demonstrate |
| --- | --- |
| 00 → 01 → 02 | Local project → branded navigation → searchable public catalogue |
| 03 → 04 → 05 | Database and migrations → accounts and roles → editorial publishing |
| 06 → 07 → 08 | Manager hotel workflow → day planner and budget → saved trips and export |
| 09 → 10 → 11 | Guide requests and status → maps and routing → recommendations and assistant |
| 12 → 13 | Usage reports and limited offline access → SEO audit and production release |

## Who can do what
| Actor | Reads | Writes or decisions |
| --- | --- | --- |
| Guest | Published places, activities, hotels and guides | Creates a temporary trip draft and asks supported questions. |
| Tourist | Public content, own trips and own guide requests | Saves or edits own trips, exports a summary and submits a guide request. |
| Hotel manager | Public content and own listings, rooms and submissions | Creates a hotel, edits own details, prices, amenities and photos, submits for publication. |
| Administrator | Moderation queue, guide requests, knowledge and aggregate reports | Publishes or suspends listings, maintains destinations, activities, guides and rules, decides requests. |

Assign a manager account through the manager registration flow. Restrict it to its own records. Provision administrators through a trusted operator action. Guide profiles are managed by administrators in this design. A guide request becomes a booking only after confirmation. Hotels are catalogue listings with room estimates and contact actions.

## Rules for each change
Validate input on the server and authorize both the action and the record. Apply row-level security (RLS) in PostgreSQL as a second layer. Use a user-scoped client for normal requests. Keep secrets and privileged writes server-side. Where a session cookie authorizes a write, require a same-origin mutation with the framework’s protection or an explicit origin/CSRF check. Use bounded inputs and a shared rate limiter for abuse-prone endpoints.

[OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) · [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

# 01  Build the branded navigation
**Depends on 00. Result** — A visitor can use the header on a phone or desktop and reach Explore from the home page.

1. Add brand tokens to src/app/globals.css and the common header and footer to the root layout. Use the original PNG from the first page. Set explicit image dimensions so the header stays still as the image loads.
2. Build a small home page with a search entry and a link to Explore. Use normal HTML links. Place Explore, Plan my trip, Find a guide, My trips, Account and List your hotel in the navigation as each destination becomes available. Keep unfinished entries out of active navigation.
3. Use a menu button with an accessible name, keyboard focus, Escape handling and an expanded state. Close the menu after navigation. Set the document language, a descriptive title and a single visible main heading.
4. Add a local check for the logo file. If a fresh checkout lacks it, identify the expected path and use the text wordmark during development. The supplied artwork is required for the brand review.

**Files to review** — src/app/layout.tsx owns the site frame. src/app/page.tsx owns the home content. Put reusable navigation in src/components/ and the approved tokens in globals.css. Keep the search form as a GET request to /explore with a query parameter so the result URL can be shared.

**Security** — Render menu labels and search text as text. Keep server secrets, session tokens and private contact data out of shared layouts and page props.

**Acceptance** — At 360 px wide the logo and controls fit. Using only the keyboard, open the menu, follow Explore and return home. The active link works with JavaScript disabled. Inspect the initial HTML for the heading and descriptive link.

---

# 02  Build discovery with local data
**Depends on 01. Result** — A visitor can find a place and open its own shareable page.

1. Define typed records for destinations, activities, hotels and guides. Give each a stable ID, unique slug, title, location, summary, status and last-reviewed date. Keep fixture records clearly marked as development data.
2. Create /explore and detail routes /destinations/[slug], /activities/[slug], /hotels/[slug] and /guides/[slug]. Add category, location, search, sort, bounded pagination and a “Clear filters” empty state. Link related records through a destination.
3. Make the page useful before adding a map. Render a local description, practical visitor information, authorised photo with alt text and a source/review date where facts can change. Keep each route shape when data moves to Supabase.

**Example flow** — Create a reviewed development record for Bumburet Valley. Open its detail page from Explore, copy the URL and visit it in another browser. Once Module 07 is ready, the same detail page should let the visitor choose a trip and day. Preserve its URL through that change.

**Security** — Allowlist sort and filter fields, cap page size and query length, and escape supplied text. Exclude draft and suspended records from results and direct URLs.

**Acceptance** — Search a known fixture, follow its link, open an unknown slug and clear a zero-result filter. Check for HTTP 200 and 404 respectively on the known and missing detail URLs. A fixture-only site stays private during development.

---

# 03  Connect the catalogue to PostgreSQL
**Depends on 02. Result** — The public pages read published data from a reproducible development database.

1. Create a separate Supabase development project. From the repo root, install the SDK, validation library and CLI. Log in interactively, initialise the Supabase directory once, then link to the development project. Replace YOUR_DEV_REF before running the command.
```powershell
npm install @supabase/supabase-js @supabase/ssr zod
npm install -D supabase
npx supabase login
npx supabase init
npx supabase link --project-ref YOUR_DEV_REF
npx supabase migration new catalogue_foundation
```
2. Edit the generated SQL. Start with destinations, activities, hotels, rooms, guides and media metadata. Use primary keys, foreign keys, unique slugs and check constraints for positive room capacity, currency and nonnegative prices. Store PKR amounts in integer minor units. Model publication state separately from ownership.
3. Enable RLS and specify database grants and allowed policies in the same migration. Grant anonymous read access to published public fields only. Keep sensitive manager details and guide verification evidence in private tables or buckets. Seed with repeatable development data.
4. Inspect `npx supabase db push --dry-run`, verify the linked development target, then run `npx supabase db push`. Configure the SDK with the project URL and publishable key in .env.local. Use the same variable names in the SDK and .env.example. Restart Next.js, then switch the catalogue reads.
```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```
**Security** — The publishable key is meant for client use with RLS. Never expose a secret/service-role key to the browser. Exercise policies through direct API calls as an anonymous client. Inspect views for invoker privileges or equivalent protection.

**Acceptance** — Apply migrations to an empty test database. A published record survives restart, an anonymous write is denied and direct reads cannot return a draft or its private fields. A database outage produces a recoverable error. Do not silently substitute demo content in production.

[Supabase and Next.js](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) · [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)

---

# 04  Add accounts and role checks
**Depends on 03. Result** — A traveller can register, sign in and resume an action. A manager reaches their own workspace.

1. Configure Supabase Auth with the correct development origin and a narrow callback allowlist. Build registration, email confirmation, sign-in, sign-out and password recovery. Create a manager registration choice with manager-only permissions.
2. Create an account profile keyed by the Auth user ID. Keep privileged role assignments in protected data. Create the initial administrator through a trusted server or database operator operation and enable MFA for administrator access.
3. Implement one server-side session and role check shared by pages and mutations. Recheck ownership when loading or updating a record. Add RLS tests now, including two tourists and two managers.
4. Preserve a validated local return path and a short-lived draft reference across sign-in. Use the provider-supported server-side session verification flow. Configure private responses to bypass shared caches, including responses that refresh cookies.

**Verification setup** — Use an isolated development email inbox or the local Auth email tester for confirmation and recovery links. Record test account roles in the test fixture, keep passwords out of Git and recreate the accounts as part of the integration test setup.

**Security** — Ignore role and owner fields supplied by the browser. Reject cross-site return URLs, expired reset links and disallowed origins. Rate-limit authentication attempts and use generic recovery responses. Redact tokens, emails and reset links from application logs.

**Acceptance** — A guest sent to sign-in resumes a permitted internal path. A tourist gets denied on a direct admin mutation. Manager A cannot read Manager B’s draft by changing its ID. After sign-out, the previous session can no longer open protected pages through the app. Test recovery with an expired link.

---

# 05  Give administrators publishing controls
**Depends on 04. Result** — An administrator can publish a destination and remove it from public discovery.

1. Build /admin with queues for hotels, destinations, activities and guides. Allow administrators to create or edit records, including manually entered hotels. Store a source and review date for access notes and guide credentials.
2. Define draft → published → suspended, plus administrator reactivation. Manager submissions enter pending review. Use a separate draft revision for edits to a published listing so readers see the most recently approved version.
3. On publication or suspension, invalidate affected detail pages, lists, related recommendations and sitemap data. Write an audit entry with actor, target, action, time and reason in the same transaction as the change.

**Publishing contract** — A successful publish returns the public URL and the saved revision. A stale edit returns a conflict and preserves the editor’s unsaved text. On suspension, record whether existing trips depend on that listing so their owners can see an availability notice on their next visit.

**Security** — Require administrator authorization on every moderation endpoint. Validate contact links and coordinates. Store review evidence privately. Reject stale edits using a version field and report conflicts.

**Acceptance** — Publish one destination, edit it in a second browser tab and exercise a stale save. Suspend it and verify its public URL, Explore results and sitemap source all reflect the change. Reactivate it and confirm that the audit history records both actions.

---

# 06  Build the hotel manager workspace
**Depends on 05. Result** — A manager can submit a complete listing, then see the approved public hotel page.

1. Build /manager/hotels with the owner’s listings, review status and actions. The editor collects hotel name, destination, public contact, description, photos and amenities. Keep private account contact details separate.
2. Add room types, occupancy, nightly rate and optional availability notes. Show a preview using the same presentation component as the public page. Save a draft and submit it for administrator review. Keep approval and suspension under administrator control.
3. Upload photos to private staging. Allow a small set of decodable image formats, enforce byte and pixel limits, re-encode images, strip metadata and assign server-generated names. Publish only approved derivatives. Remove abandoned uploads safely.
4. Store room and listing changes transactionally. Archive a room that appears in a historical trip. Preserve the saved price snapshot and label current rates on new plans. Show a useful empty state when a hotel has no published room types.

**Security** — Enforce ownership on the hotel, each child room, upload path and storage policy. Block attempts to change owner or moderation status through a crafted request. Add per-account upload quotas. Use signed, short-lived URLs for private preview assets.

**Acceptance** — With two manager accounts, attempt a cross-owner room update, photo overwrite and direct file read. Try an oversized file and a non-image renamed .jpg. Confirm rejection. A valid owned room and photo appear after approval. A suspended listing is inaccessible through the public application.

**Quality check** — Use responsive image sizes and explicit dimensions. Query room summaries for listing cards and full details only on the hotel page. Confirm that typing a rate or switching tabs does not discard other room edits.

[OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

---

# 07  Build the day planner and budget
**Depends on 06. Result** — A guest can plan a trip and review a reproducible PKR estimate before creating an account.

1. Build /plan as three steps. Collect start and end dates, party size, destinations and optional budget. Generate calendar days in Asia/Karachi. Let users choose hotel rooms, activities and an optional guide for each day, then review the draft.
2. Connect “Add to trip” on a listing to a trip/day chooser. Support adding, replacing and removing items. Revalidate dates, room capacity and published status on the server. If new dates would discard a selected day, show the affected items before applying the change.
3. Define each price unit explicitly. Hotel subtotal = nightly rate × rooms × charged nights. Per-person activity subtotal = unit price × participants. Charge a per-group guide fee once per booked/requested service day and label it estimated. Show unknown prices separately from free items.
4. Keep a short-lived guest draft on the current device, with version and expiry. Store only the data needed to resume. Give the user a clear discard action. Refresh current prices at review and identify changed items.

**Worked test** — Two travellers stay from 10 to 12 June and select one room at PKR 6,000 per night. They each select one activity at PKR 1,500. The planner creates three calendar days, charges two nights and displays PKR 15,000 before any guide estimate. A same-day trip has zero default hotel nights.

**Security** — Bound trip length, participants and item count on both client and server. Treat guest storage as untrusted. Recompute prices from validated records. Reject negative quantities, invalid date ranges and hidden listing IDs. Do not send names or contact details to a routing or recommendation service.

**Acceptance** — Cover the worked calculation, a same-day trip, the last day of a month, an unknown price, an over-capacity room and a changed date range. Refresh mid-plan and recover the draft. A failed check keeps all valid selections editable.

---

# 08  Save trips and export a summary
**Depends on 07. Result** — A signed-in traveller can save, reopen, edit and export their own itinerary.

1. Create trips, trip_days and trip_items with owner, date, quantities, price unit and price snapshot. Enforce one day per trip/date and require every item to point to a day of the same trip. Retain useful titles if a catalogue item is later withdrawn.
2. On “Save itinerary”, preserve the guest draft across sign-in. Validate all selections again. Save parent, days and items in one transaction with a unique idempotency key, so retrying a timed-out save yields the same trip. Clear the draft after confirmed success.
3. Build /my-trips, /my-trips/[id] and an owner-only print view. Show daily choices, estimated breakdown, guide request status and edit action. Offer a print stylesheet and “Print / Save as PDF” using the browser. A new account should see “Plan your first trip”.
4. Add a revision number to updates. If two tabs submit edits against the same revision, keep the newer stored version and invite the user to reload. When a saved listing is withdrawn, show it as unavailable and offer a replacement.

**Security** — Apply owner RLS to parents and children. Reauthorize the export itself and mark all private responses private/no-store. Use a local print view with escaped text. Keep trip IDs, trip contents and exports out of sitemaps and analytics payloads.

**Acceptance** — Sign in from a guest draft and save once. Resend the same request and verify one trip exists. Test loss of connection halfway through save, two-tab conflict and export by a second user. Open the print preview on a multi-day trip and verify every day, subtotal and pending guide status is legible.

---

# 09  Request a guide and track the decision
**Depends on 08. Result** — A tourist receives a booking reference and sees the administrator’s decision in My trips.

1. Build /guides and public profiles showing languages, expertise, public credentials summary, area served and pricing unit. Let the tourist choose an owned saved trip and a requested date range within that trip.
2. Create a guide_requests record with guide, trip, requester, dates, status and a unique reference. New requests start Pending. Only administrators may move Pending to Confirmed or Declined. Display the latest state on the guide-request detail and the trip.
3. Check valid dates and overlaps before submission and again at confirmation. As a V1 default, one guide can serve one confirmed party per day. Enforce that invariant in PostgreSQL with an exclusion constraint on guide and overlapping confirmed date ranges, or equivalent transactional locking. Make the date range inclusive to users.
4. Add idempotency to submission and condition administrator decisions on the current Pending state. Record the decision in the audit trail. Before changing a trip’s dates, identify any request that would fall outside them and require resolution.

**Security** — The server derives the requester from the session, loads the owned trip and checks the guide is published. Restrict status reads to the owner and administrators. A booking reference is a display identifier. It grants no access. Apply a per-account submission limit.

**Acceptance** — Submit twice with the same request token and see one Pending reference. Run two simultaneous confirmations for the same guide and overlapping dates. Exactly one succeeds. Verify adjacent, non-overlapping service dates succeed and another tourist cannot read the request. A declined request remains visible in its owner’s history.

---

# 10  Show places and route estimates
**Depends on 09. Result** — A tourist can open a map from a listing or day plan and still use the trip when routing is unavailable.

1. Install Leaflet and its TypeScript definitions. Add a client-only map drawer. Load map code and tiles only when the drawer opens. Fit to the selected listing or day’s stops; retain keyboard-accessible text details and a close control.
```powershell
npm install leaflet
npm install -D @types/leaflet
```
2. Choose a permitted tile provider with attribution and a routing provider for the operating region. Record their quotas, data terms and allowed cache duration. Keep drawing the map and requesting directions in separate functions. Use PostGIS geography points and a spatial index when nearby searches require them.
3. Send verified coordinates to a server-side route adapter. Return estimated distance, duration, provider and retrieval time. Display dated local access notes separately. If the provider fails, retain stop order and place names and offer retry. Report road status as unknown unless a verified current source supports it.

**Security** — Allowlist the upstream host and route modes. Validate coordinate bounds, stop count and payload size, set timeouts and enforce a request quota. Keep routing secrets on the server. A browser tile token must be provider-designated public and domain-restricted. Obtain permission before using device location.

**Acceptance** — Test valid stops, coordinates outside the valid range, one stop, a timeout, an unreachable route and quota exhaustion. The catalogue remains usable with maps blocked. Check provider attribution on a phone and verify a guessed URL cannot make the server fetch an arbitrary host.

**Performance** — Cache eligible route results using provider, travel mode and rounded coordinates where terms allow. Never prefetch public OpenStreetMap tiles for an offline download. Offline users can still read the local text summary.

[OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)

---

# 11  Rank options and answer local questions
**Depends on 10. Result** — A traveller understands why an option appears and gets a sourced answer or a useful fallback.

1. Filter candidates by publication, destination and hard constraints such as capacity, dates with known restrictions and accessibility needs. Then score eligible options using pure TypeScript. Return IDs, reason labels and a stable tie-breaker. The traveller decides which suggestions enter the plan.
2. Use a transparent starter score. Give interest match 50%, budget fit 30% and destination proximity 20%, each scaled to 0–1. For missing optional signals, renormalise the available weights and disclose missing price or distance. If all signals are missing, use a stable catalogue order. Example: 1.0, 0.5 and 1.0 gives 0.85.
3. Keep the design’s historical travel cases and popularity as bounded signals. At cold start use reviewed sample cases or omit the case signal. Once Module 12 produces sufficient aggregates, compare coarse trip duration, party band and interests against anonymised cases; use case similarity followed by popularity only as tie-breakers in V1. Never expose another tourist’s itinerary.
4. Add a knowledge editor for administrators and an assistant drawer on details and planner days. Store topic, approved answer, matching terms, source, reviewed date, expiry and related published listing IDs. Match supported questions against maintained rules. Offer related questions when no rule matches.
5. For changing road or access conditions, return the verification date and an appropriate official source. Expired facts trigger an “unable to verify” response. An optional hosted model may later rephrase approved facts behind a feature flag with limits and deterministic fallback.

**Security** — Treat questions, context and any model output as untrusted text. Constrain length, frequency and costs. The assistant may suggest published IDs. Saving a trip or booking requires a separate authorised user action. Keep raw questions and personal trip data out of analytics.

**Acceptance** — A small labelled fixture set covers an exact match, tie, missing price, no eligible result, expired advice and an instruction to expose another user’s trip. Check the order, stated reasons and fallback. Run the same inputs twice and obtain the same ranking. Disable any model key and repeat the core demo.

---

# 12  Add analytics and limited offline access
**Depends on 11. Result** — Administrators can inspect aggregate activity, and a visitor on a weak connection can still use previously loaded public information.

1. Record an allowlist of events such as listing_view, call_click and trip_saved. Store event ID, type, allowed public listing ID where relevant, and timestamp. Count a call click as a click. Add an admin-only report with date range, views, call clicks and popular listings.
2. Deduplicate retried events, rate-limit ingestion and cap report ranges. Build daily aggregates with an index on date and listing. Set a short event retention period and document the chosen duration. Feed only eligible aggregates into the Module 11 tie-breaker. Suppress small groups when revealing them could identify a traveller.
3. Add a web manifest and approved app icons. Provide an offline fallback and a small, versioned cache of the shell and explicitly public, low-volatility information. Show when a cached page was saved. Use network-first behaviour or expiry for changing facts.
4. Use a strict cache allowlist. Exclude authenticated HTML, APIs, trip exports, booking decisions, access advisories with short freshness windows, map tiles and third-party responses unless their terms explicitly allow storage. Give the user a way to clear local drafts and cached content.

**Security** — Drop unknown fields, free-text questions, phone numbers and coordinates before event storage. Block direct client access to raw events and reports. A service worker must never cache a response carrying user-specific data or a session cookie. Verify cache contents after account switching.

**Acceptance** — One repeated event ID counts once. A tourist gets denied on the analytics endpoint. Visit a public page, disable the network and reopen it. Verify the offline state, reconnect, and see current data. Sign out of one account and use another on the same device. No first-account trip or export appears.

**Quality** — Measure report time with seeded realistic volume and inspect the query plan. Verify raw events expire while required aggregates remain. Check installability and offline navigation on a real mobile browser.

---

# 13  Make public pages ready for Google
**Depends on 12. Result** — A crawler can discover useful public pages and the team can measure search visibility after launch.

| URL family | Search and response behaviour |
| --- | --- |
| Home, destination, hotel, activity and guide pages | Server-render useful content. Publish one canonical HTTPS URL per entity. Return 200 for an approved page and link it from relevant hubs. |
| Explore and filters | Index the useful main hub. Keep arbitrary query, sort and duplicate filter combinations out of the sitemap. Use noindex for accessible filtered results that should stay out of search. |
| My trips, exports, manager, admin and account | Authenticate private resources, apply noindex where appropriate and exclude them from sitemaps. Keep personal information out of previews and shared caches. |
| Renamed, withdrawn and staging pages | Redirect a moved slug permanently to its equivalent. Return 404 or 410 for a withdrawn page with no replacement. Protect staging with access controls. |

1. Use Next.js metadata per entity for title, description, canonical and sharing image. Add app/sitemap.ts and app/robots.ts under src/. Use a configured production origin. Include only published canonical URLs and set lastmod from a meaningful content change. Google must be able to fetch a public noindex page to see that directive.
2. Write one useful page per search intent. For example, a Bumburet Valley page can answer where it is, what visitors can do, what access details were checked and how to add it to a trip. Link to relevant local guides or stays. Publish reviewed, original local details and photographs with permission.
3. Add breadcrumb structured data matching visible navigation. Validate it with Google’s Rich Results Test. Use genuine business details on hotel pages. Fabricated ratings, repetitive town pages and unsupported claims undermine the catalogue.
4. Test initial HTML with JavaScript disabled. Inspect titles, canonicals, status codes, internal links, robots and sitemap output. After launch, verify the domain in Search Console, submit the sitemap and inspect representative URLs. Monitor impressions, clicks, queries and indexing reasons. Search position depends on Google and competing results.

**Security and acceptance** — Crawl as a signed-out user. Confirm that published listings are discoverable and private trip IDs, contact evidence and drafts never enter metadata, structured data or sitemap output. Suspend a listing and repeat the crawl.

[Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) · [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing)

---

# Production release and performance
Finish these checks as the second part of Module 13. Use a production build on staging with synthetic data and separate credentials.

1. **Measure public routes.** Benchmark home, Explore, one detail page and the planner on a throttled mobile connection. Take three lab runs on the same device profile and record the median. After launch, use field data where available. Aim for LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 at the 75th percentile, assessed separately on mobile and desktop.
2. **Fix the measured cost.** Render public content on the server, paginate lists and select only the fields displayed. Size responsive images and reserve space. Load the top visible image promptly and defer offscreen media, maps and assistant code. Profile a slow request before adding a database index. Cache only published data and invalidate it on moderation.
3. **Run CI on a clean checkout.** Install from the lockfile, lint, build, type-check and run the applicable unit, integration and browser tests. For Vitest/Playwright projects, use npm scripts wrapping `vitest run` and `playwright test`. Install browser binaries once with `npx playwright install chromium`. Block release for broken access checks, leaked secrets or an unrecoverable migration.
4. **Prepare production.** Choose a Next.js-capable host, a separate Supabase production project and HTTPS domain. Set secrets in the hosting dashboard, allowlist the final auth callbacks, restrict storage access and configure provider quotas. Test a Content Security Policy against the actual image, tile and auth domains before enforcing it.
5. **Deploy safely.** Back up the database and rehearse a restore on an isolated project. Apply backwards-compatible migrations first, deploy the app, and smoke-test all three roles. Preserve the previous application release. If a migration breaks data, use the rehearsed restore or a tested forward fix. Keep a record of versions and recovery steps.
6. **Observe the live site.** Track HTTP errors, route timeouts and failed saves with redacted identifiers. Verify the public domain uses the right canonical host and indexability settings. Review Search Console after it has collected data and compare real search queries with the pages intended to answer them.

**Release demonstration** — In one fresh browser, find a destination, plan two nights, sign in, save, request a guide and export. In separate sessions, have the administrator confirm the request and the manager submit a rate change. The tourist sees the guide decision; the public sees the new hotel rate only after approval.

[Core Web Vitals targets](https://web.dev/articles/vitals) · [Google Search Console](https://search.google.com/search-console/about)

---

# Codex handoff and verification record
Use this prompt for any module after setup. Replace NN with the next number and include the last completed result.

> Read AGENTS.md, docs/GoChitral_Build_Guide.md and docs/progress.md. Work only on Module NN. Identify its dependencies and inspect the normal entry points. Implement the smallest complete user flow described there. Check authorization, failure handling, accessibility and any effects on public search pages. Run the module’s acceptance tests and existing relevant checks. Fix failures within scope. Record the results and stop before the next module.

## What Codex records before stopping
| Field | What to put in docs/progress.md |
| --- | --- |
| Module and status | Number, date, completed or blocked, and commit if available. |
| How to review | Entry URL, test role and exact steps to reproduce the user-visible result. |
| Changes and setup | Main files, migrations, packages, new variable names and required services. Record secrets only in the environment. |
| Security evidence | Actor, action, target, expected denial and observed result. Include a direct request when the UI hides the button. |
| Quality evidence | Commands, pass/fail, relevant screenshots or measurements, failure paths, and any check still unverified. |
| Next session | First unfinished item or the next module number. Keep an unresolved blocker visible. |

## Example of a useful module check
For Module 06, create Manager A and Manager B in development. Sign in as B and submit an update for a room owned by A. Verify the server refuses the change, then query the room again as A and verify the stored rate is unchanged. Save the test and the observed result alongside the successful owner edit.

## Traceability to the final presentation
Slides 4–6 define the three user roles. Slides 8–15 define the screen flows implemented in Modules 01–12. Slides 17–21 identify the external routing service and seven data stores: accounts, catalogue, guide profiles, trips/cases, guide bookings, knowledge/rules and usage events. Slides 22–23 define validation, ranking, assembly, persistence and export in Modules 07, 08 and 11.

The first session ends with a working local project. The final session ends with a reproducible demonstration, measured public pages and a tested recovery procedure.
