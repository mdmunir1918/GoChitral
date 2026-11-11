# Guide profiles and requests · Module 09

## Local review

The sample guide is fictional and does not represent a real person, credential or guiding offer. Use it only to test the screens.

1. Sign in with the tourist account in the ignored `docs/development-credentials.local.md` file. Open [Plan a trip](http://127.0.0.1:3000/plan), choose a future trip with Bumburet as a destination, and save it.
2. Open the [guide directory](http://127.0.0.1:3000/guides), then the **Sample Bumburet guide** profile. Select your saved trip and inclusive service dates inside that trip. Submit once and note the reference.
3. Open [My trips](http://127.0.0.1:3000/my-trips) to see the Pending request. The reference opens its private status page. It is not a confirmed booking.
4. Sign in as the administrator from the same ignored credentials file and open [Guide requests](http://127.0.0.1:3000/admin/guide-requests). Add a reason and confirm or decline the request. The tourist sees the decision in My trips and on the request page. A declined request remains in history.
5. Return to the same tourist account and check the saved trip. A pending or confirmed request outside a proposed new trip date range is shown with its reference, and the date change is blocked until that request is resolved.

## Rules

- Only signed-in tourist accounts can request a guide. The server uses the signed-in account and an owned saved trip; submitted owner IDs and prices are ignored.
- Service dates are inclusive, must fit inside the saved trip and can span up to 31 calendar days. The database checks the same rules.
- A guide request starts Pending. Only an administrator can decide a pending request. Decisions require a reason and are written to an append-only audit table.
- Per guide, the database serializes confirmations and prevents overlapping confirmed date ranges. Adjacent non-overlapping dates remain available. A reference is for display only and does not grant access.
- Submissions are idempotent and limited to eight per account in 15 minutes. A retry with the same request key returns the original reference.
- Private guide credential evidence is not shown on public profiles. Public credential summaries, languages, expertise, service areas and the estimated per-group per-day price unit are maintained through the existing administrator publishing screen.

## Verification

`npm.cmd run guides:verify` uses temporary accounts, trips and a guide profile. It checks request retries, ownership, date bounds, concurrent overlapping confirmations, adjacent dates, audit records, declined history and rate limiting. All temporary rows are deleted after the check.
