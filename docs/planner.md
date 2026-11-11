# Module 07 · Guest day planner and budget

Open [Plan a trip](http://127.0.0.1:3000/plan). This module does not need sign-in and does not create a booking or saved account trip.

## Review

1. In Trip details, set start/end dates, people, destinations and an optional PKR budget. Continue to days.
2. Choose a calendar day and an item type. Add a published hotel room, activity, destination stop or optional guide. Select room quantity or activity participants. Add a hotel separately to each overnight day that should be priced. A checkout-day hotel choice charges zero nights.
3. Add another hotel or guide to the same day to replace the existing selection. Adding the same activity again updates its selection instead of charging twice. Edit quantities or remove individual items in the day cards.
4. Open Review budget. The server reloads published records and current prices. Unknown costs are listed separately from free items and excluded from the known subtotal. Guide fees are estimates, once per group per selected service day. This does not request a guide.
5. Refresh the browser mid-plan and resume the stored draft. Change dates in Trip details: any removed day items and hotel choices becoming checkout-day choices appear for confirmation. Cancel keeps the original dates/items.
6. Use Add to trip on Explore or a listing page to open the planner and choose a day. For a listing in another destination, include that destination in Trip details first.
7. Discard this draft clears the local copy after confirmation. The guest draft expires after 24 hours. If browser storage is blocked, the current tab remains usable and explains that the draft cannot be saved.

## Pricing

All arithmetic uses integer PKR minor units. Hotel rows use current published room rates × rooms × the charged night (one for each selected overnight day, zero on checkout day). Activities use current per-person price × participants. Guides use one estimated per-group daily fee per selected day. A destination stop has unknown entry fees rather than an invented free admission price. Transport, meals and unselected services are excluded.

Administrators can set an activity's price per person or a guide's estimated price per group per day in the existing listing editor. Blank means unknown; 0 means free. Save draft keeps the new price private; Publish makes it available to the planner. Existing prices are not invented or backfilled. Hotel rates remain managed through the hotel workspace. Published room and service price changes are identified against the draft's last reviewed unit prices.

The worked example uses two people, 10–12 June (three calendar days), a PKR 6,000 room on each of the two overnight dates and one PKR 1,500 activity for both people: PKR 12,000 + PKR 3,000 = PKR 15,000 before any guide estimate. The public sample activities may have unknown prices; the worked calculation uses isolated test data.

## Storage, validation and scope

The version-1 device draft stores dates, group size, destination/item/room IDs, quantities, optional budget, expiry and previous unit prices. It has no traveller-name or contact fields. Browser storage is untrusted: the server never accepts submitted totals or snapshot prices as current prices. All review data comes from published-only database policies, including parent suspension checks.

Module 08 also keeps an optional trip title, a stable save retry key and, for saved-trip edits, the trip ID and revision. It does not collect traveller names or contact fields. See [saved trips](saved-trips.md) for sign-in saving and printing.

Limits are 31 inclusive calendar days, 20 people, 10 destinations and 120 selections. Dates are date-only values labelled in Asia/Karachi; date arithmetic does not depend on the laptop's timezone. Room capacity, activity participation, day membership, availability and one hotel/guide per day are checked again by the server. Invalid selections stay removable while valid selections retain their estimates. Review bodies are bounded to 64 KB, including streamed bodies. Review responses are private/no-store. Nothing is sent to routing, recommendation or third-party tracking services.

Prisma migration `202611090008_planner_prices` adds a nullable nonnegative integer price for activities/guides, preserving existing listing RLS and audit behavior. Guest drafts remain on the device; database trips, sign-in saving and exports are reserved for Module 08.

## Checks

```powershell
npm.cmd run planner:verify
npm.cmd run planner:db
npm.cmd run publishing:verify
npm.cmd run hotels:verify
npm.cmd run lint
npm.cmd run build
npm.cmd run typecheck
```

`planner:verify` covers the worked total, same-day zero nights, month/leap boundaries, unknown versus free, capacity, guide once/day, date impact, unavailable/hidden IDs, price changes/tampering, limits and draft expiry/restore. `planner:db` verifies published service prices, draft price isolation, approved price changes and suspension in a rolled-back transaction.

Observed on 9 November 2026: these checks, publishing/hotel regressions, build, typecheck and lint passed. The isolated browser verified the real worked calculation, draft recovery, date confirmation/cancel, capacity repair, price changes, failed price-check recovery, outside-date removal, Add to trip, expiry/discard and mobile layout. Temporary browser test records were removed. Module 08 has not started.
