# Photo, demo data and performance review · 9 November 2026

Module 06 follow-up. Module 07 has not started.

## What was observed

The manager Photos tab successfully uploaded an existing WebP image to R2 before the changes, but the request took 8.797 seconds. A universal upload failure was not reproduced. Uploads required a saved draft, a selected supported file and confirmation of permission; disabled controls did not explain all these conditions. The server also performed the R2 write inside a database transaction, exposing uploads to transaction timeouts when storage was slow. This was a reliability risk, not a proven explanation for the user's particular failed attempt.

The upload now writes to R2 before opening the database write transaction. The database trigger still checks ownership, draft status and quotas at insertion; a failed insertion removes the newly uploaded object. The R2 upload deadline is twenty seconds rather than eight. The interface explains disabled controls, displays progress and useful errors, resets the file selection after success, and handles non-JSON server errors. Unauthenticated uploads return a clear sign-in message. An actual PNG upload and private image preview passed after the changes; that PNG request took 5.265 seconds. The two upload files differ, so these timings are not a controlled speed comparison.

## Loading measurements

Isolated headless Chrome, production `next start`, 1366 × 900, local app with the existing remote development database. No mobile network/CPU throttling. Before measurements used the smaller catalogue; after measurements include the ten new demo hotels. These are lab observations, not a field Core Web Vitals result or a Lighthouse score.

| Measurement | Before | After |
| --- | --- | --- |
| Explore content, warm load | 2.65 s | 1.05 s |
| Explore first measured database load | 5.75 s | 2.39 s |
| Manager hotel list, three loads | 4.63 / 4.86 / 3.98 s | 2.39 / 2.58 / 3.79 s |
| Manager sign-in plus Account | 5.73 s | 4.17 s |
| Explore largest contentful paint, warm loads | 2.73 s on hotel filter | 2.24–2.32 s |
| Layout shift, Explore | 0 on original filter sample | 0.017 |

After the changes, the first measured Explore image paint was still 5.22 seconds; content arrived earlier. Cold connections and private R2 image retrieval remain noticeable. No broken images were found in the measured pages. Home stayed fast: subsequent measured largest paints were 0.10–0.26 seconds.

## Why it was slow and what changed

- A single PostgreSQL round trip measured around 180–230 ms in most samples; connection setup took around 0.75–1.25 s. One outlier query took 465 ms. Several queries in sequence accumulate seconds even when the database itself does little work.
- Catalogue listing, media, room minimum and room count reads now use one joined query under the existing public RLS role. Metadata and the detail page share a read during one React render. Data is not cached across requests, so publishing and suspension remain fresh.
- Auth.js already fetched the active session and account. It now also returns the current protected role from that lookup, avoiding a second account transaction. Every request still revalidates the database session; every private data operation keeps its activity check and RLS. The request-local React cache does not persist permissions between requests.
- Explore, manager and admin navigation now show a loading message while the database responds. This improves feedback; it does not remove network latency.
- Existing static home images were not the cause of multi-second database waits. No image CDN, infrastructure deployment, paid service or database-region change was introduced.

For a later deployment, placing the app server near its database is the next practical way to reduce the measured network delay. Assess that with deployment measurements before changing infrastructure. Public hotel photos currently check database publication permissions on every request, which adds latency but keeps suspension effective. Private pages and user data remain uncached.

## Demo hotels and palette

Added ten clearly named `Demo - ...` hotels to the retained manager account, with twenty room types, PKR prices, amenities, descriptions, guest/check-in notes, placeholder contacts and ten original R2 illustrations labelled as fictional. They were published through the existing manager submission/admin approval service, including audit records. The original sample hotel and user-created content were preserved. Repeating `npm.cmd run db:seed-hotels` created zero duplicates and did not overwrite edits.

Applied Pearl #F5F2F6 to dominant surfaces, Aubergine #392F48 to text/structure/controls, and Terracotta #9A4A2F to selected actions, links and accents. The user's 60/30/10 proportions guide the visual balance; photographs are excluded. The supplied logo is preserved. Desktop and 360px mobile screenshots were visually checked.

There is no restaurant category or restaurant editor in the current schema. This work tests and improves the existing hotel flow without starting another module.

## Validation

Build, typecheck, lint, auth:flows, publishing:verify, hotels:verify and db:verify passed. Browser checks passed invalid-image rejection, disabled-button instructions, visible upload progress, real PNG upload, decoded private preview, guest upload/private-photo denial, ten manager demo entries, administrator password-only access, tourist/manager access restrictions, and 360px layout without horizontal overflow. Temporary upload records, test objects and captured browser sessions were removed.

Review [Hotels in Explore](http://127.0.0.1:3000/explore?category=hotels) and [Your hotel workspace](http://127.0.0.1:3000/manager/hotels). Existing account credentials are unchanged.
