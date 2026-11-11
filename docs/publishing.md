# Module 05 · Administrator publishing

Open the Administrator section of the ignored `docs/development-credentials.local.md`. For local testing, sign in with its email and password and open [the publishing workspace](http://127.0.0.1:3000/admin). Authenticator codes are temporarily disabled locally by AUTH_REQUIRE_ADMIN_MFA=false. Set it to true and restart to enable them again.

## Review a listing

Choose a category queue and open Review listing. The editor loads its latest draft revision when one exists. The status and revision number identify the saved state. Save draft preserves the currently approved public content.

Publish revision validates the source, review date, photograph, parent destination, contact URL and coordinates. A successful publish shows the public URL and saved revision. An existing listing keeps its URL slug and category.

Each change requires a reason. Guide review evidence is private. Choose from the approved photographs already in the catalogue. Photo upload and the manager submission editor arrive in Module 06.

To check a conflict, open the same editor in two tabs. Save a change in the first tab, then save different text from the second tab. The second tab reports a conflict and preserves its text. Copy that text before using Reload saved version.

Suspend a published listing and verify that its detail URL returns 404 and Explore excludes it. Reactivate and publish revision restores it. Audit history records both actions with actor, reason, time and revision. The published catalogue adapter also supplies the future sitemap's path source.

## Database and authorization

Listing writes and revision reads require an active administrator session with MFA when enabled. A database trigger records each moderation change inside the same transaction. Audit rows are append-only for application users. Public readers cannot retrieve draft revisions, audit history or guide evidence.

Version-conditional updates reject concurrent edits. A failed operation rolls back the listing, draft and audit changes together. Trips arrive in Module 08, so this module records zero dependent trips on suspension.

```powershell
npm.cmd run publishing:verify
npm.cmd run auth:verify
npm.cmd run db:verify
npm.cmd run lint
npm.cmd run build
npm.cmd run typecheck
```

The publishing check rolls back its fixtures. It exercises all four listing categories, draft/public separation, conflicts, suspension/reactivation, private evidence, audit order, administrator MFA and tourist denials, and link/coordinate validation.
