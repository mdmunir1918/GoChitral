# Module 06 · Hotel manager workspace

Sign in with the hotel manager account from the ignored `docs/development-credentials.local.md`. Open [Your hotels](http://127.0.0.1:3000/manager/hotels).

1. Choose Create a hotel. Enter its name and a published destination. Add a public HTTPS contact website, summary, description, guest notes and comma-separated amenities.
2. Open Rooms and add room types, guest capacity, a PKR nightly rate and availability notes. Switching tabs keeps unsaved edits. Preview uses the same room and amenity component as the public hotel page.
3. Save draft before adding photos. In Photos, choose a JPEG, PNG or WebP under 5 MB and confirm permission to use it. Upload up to eight photos per hotel. The first is the cover. Save a draft first before changing photos on an already submitted or approved hotel.

   Upload photo becomes available after selecting a file and ticking the permission box. Wait for the upload confirmation and preview. Storage can take several seconds on a slow connection. Saving a hotel and uploading its photo are separate steps. A photo stays private until admin approval.
4. Choose Submit for review. Managers cannot approve, suspend or change ownership. The public listing keeps its previously approved content while changes are being reviewed.
5. Sign in as administrator with email and password for local testing and open [Hotel submissions](http://127.0.0.1:3000/admin/hotels). Review the rooms and photos, then approve with a note or request changes. Approval publishes the hotel, amenities, photos and active rooms in one database transaction.
6. Open the public hotel link. Room rates are current estimates, not booking guarantees. Use the publishing workspace to suspend the public hotel; it then disappears from Explore and its public URL returns 404.

Archive a room instead of removing it. Its stable ID and last approved price stay in the database. Trip price snapshots arrive with the trip module; no existing trip functionality was changed here. Stale saves show a conflict and preserve the editor's text.

## Cloudflare photo storage

The Cloudflare account has a private `gochitral-media-dev` R2 bucket. The ignored `.env` contains `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. Keep the access key limited to this bucket. The safe names/placeholders are in `.env.example`.

The app receives uploads on the server, checks ownership and quotas, decodes real JPEG/PNG/WebP data, rejects animation or more than 20 megapixels, resizes to fit 1600×1200, strips metadata and writes WebP under a server-generated key. SVG and original uploaded filenames are not stored. A processed photo must be under 2 MB. The database limits active photos to eight per hotel and total stored photos to fifty per manager. Upload attempts are limited to eight per account per 15 minutes.

The bucket stays private. Owners and authorized administrators receive 60-second signed preview URLs. Public photo requests must match an approved photo on a publicly visible hotel and destination. Public uploaded photos bypass the Next.js image cache so suspension checks remain effective. Existing licensed catalogue photos keep their existing Next.js image handling.

## Checks and cleanup

The user-requested demo set contains ten fictional hotels assigned to manager@gochitral.test, twenty rooms with dummy PKR rates and ten clearly labelled demo illustrations in R2. Names, amenities, descriptions, check-in notes and contact placeholders are for testing only. Browse them under Hotels in Explore or edit them in the manager workspace. The original sample hotel is preserved. `npm.cmd run db:seed-hotels` is local-only and can be repeated without overwriting existing demo edits or other records.

```powershell
npm.cmd run hotels:verify
npm.cmd run publishing:verify
npm.cmd run auth:verify
npm.cmd run db:verify
npm.cmd run lint
npm.cmd run build
npm.cmd run typecheck
```

`hotels:verify` uses two managers and an administrator in a transaction and rolls back the fixtures. It checks ownership/approval guards, private drafts, stale saves, rate isolation, archival, suspension and image validation. The end-to-end acceptance also uses real R2 objects and removes its test content afterward.

Run `npm.cmd run media:cleanup` with the development operator connection to preview up to 100 unapproved photos older than seven days whose hotel is still an abandoned, unchanged draft. This default dry run deletes nothing. After reviewing the result, an operator can run `npm.cmd run media:cleanup -- --delete` to remove that batch. It locks and rechecks each hotel before deleting an object. Pending submissions and approved photos are preserved.
