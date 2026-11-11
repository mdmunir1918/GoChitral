# Module 08 · Saved trips and printable summaries

Open [Plan a trip](http://127.0.0.1:3000/plan), review a draft, and choose **Save itinerary**. A guest is asked to sign in; the draft stays on the device. After sign-in, continue to the review and save. Saved itineraries appear in [My trips](http://127.0.0.1:3000/my-trips).

## Review steps

1. As a guest, choose dates, destinations and daily items. Give the trip an optional name. Review the estimate and choose Save itinerary.
2. Sign in using an existing account. The planner restores the guest draft. Continue to the budget, then save. The server checks current published choices, prices and capacity again.
3. Open My trips and reopen the itinerary. Every calendar day is retained, including days with no selected items. Titles, quantities, units and price estimates are saved snapshots. Changing a catalogue price does not silently change an existing saved estimate.
4. Choose Edit itinerary. Make changes, review current prices and save a new revision. To test a conflict, open the same itinerary in two tabs before editing. Save in one tab, then try saving the older tab. Its edits remain available and the newer saved version is preserved. The reload control explicitly discards that tab's old draft before reopening the saved version.
5. Choose Print / Save as PDF, then the button on the print page. Use the browser's printer or Save as PDF destination. The print layout includes all days, saved prices, subtotal, unknown costs and guide status, and hides navigation. The print URL checks ownership independently.
6. If a saved listing or room is withdrawn, its saved title and estimate remain visible with Unavailable and a replacement/edit link. Editing refreshes current catalogue choices; unavailable items must be removed or replaced before saving again.

New accounts see **Plan your first trip**. Saved trips are private to their owner, including when the other account is an administrator. The list displays up to the fifty most recently updated itineraries. A guide choice says **Not requested** and remains an estimate; guide requests and decisions are part of Module 09.

## Persistence and retries

Prisma migration `202611100009_saved_trips` creates Trip, TripDay, TripItem and immutable TripSave receipts. Trips own their days/items, one day is allowed per trip/date, and the composite day/trip foreign key prevents an item from pointing to another trip's day. Snapshots intentionally retain listing/room identifiers and titles without requiring withdrawn catalogue content to remain public.

Save derives the owner from the verified Auth.js session. It reads current published data under the public role, validates through the existing planner, then writes the trip, all days/items and a receipt in one authenticated transaction. Integer minor-unit amounts are stored as integers/bigints; API responses contain only the saved ID/revision and replay result.

The device draft carries a stable random save key. The server serializes retries for that owner/key and records a unique receipt in the same transaction as the itinerary. If a response is lost after commit, retrying the same request returns the original trip instead of inserting another. A failed transaction leaves neither a partial trip nor a receipt. Reusing a completed key for different details returns a conflict with the owner's saved version; it does not create a second trip.

Updates require the current revision. Concurrent edits with different keys condition the parent update on that revision, so exactly one wins. The previous parent/days/items remain intact if the update fails. Detail, edit and print reads use a consistent database snapshot. Owner policies apply to all four tables; active-session checks and private/no-store responses apply to private reads and exports.

The guest draft is cleared only after a confirmed save, and only if another tab has not changed it meanwhile. Unsaved edits to saved trips use a separate device key per trip, keep the 24-hour expiry, and do not overwrite an unrelated guest draft. Discarding an edit draft returns to its saved trip. A timeout keeps the draft and its retry key. Browser storage failure is explained; the user can sign in in another tab while keeping an unsaved draft open.

No trip data is sent to third-party routing, analytics, email or document services. Private routes are excluded from indexing and are not added to a sitemap. Text is rendered as escaped React text. Provider bookings, guide requests and administrative decisions are outside this module.

## Checks

```powershell
npm.cmd run trips:verify
npm.cmd run planner:verify
npm.cmd run auth:verify
npm.cmd run lint
npm.cmd run build
npm.cmd run typecheck
```

The trip database check covers snapshots, interrupted transaction rollback, post-commit replay, concurrent retries, different-key edit conflicts, owner/admin/public isolation, day uniqueness, composite child keys, revision enforcement, withdrawn titles/estimates and revoked sessions. Its temporary accounts, sessions, trips and catalogue records are removed after the check.

Observed on 10 November 2026: the database checks, planner and account regressions, build, typecheck and lint passed. The final isolated Chrome run passed guest sign-in resume, one saved trip after a simulated lost response and retry, confirmed draft clearing, owner-only detail/edit/print, correct denied-access responses, escaped text, browser PDF export, two-tab conflict/reload, withdrawn snapshots, new-account empty state and responsive layouts. The actual three-day PDF was rendered and visually inspected on A4. Temporary trips, sessions and catalogue fixtures were removed. Module 09 has not started.
