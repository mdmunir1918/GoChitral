# Module 03 · Prisma and PostgreSQL preparation

**Preparation completed on 9 November 2026.** The user requested Prisma and chose to connect the database later. Module 03 live database acceptance remains pending.

## Scope

Prisma manages the PostgreSQL catalogue through the existing adapter. The fixture file becomes development seed input. Runtime reads use the database and a restricted public role. Catalogue routes keep their URLs and read at request time. An unavailable database shows a retry screen.

The schema includes catalogue publication, destination relationships, media, rooms, private hotel ownership and private guide verification. The migration adds PostgreSQL constraints, RLS and explicit grants. Runtime and migration connection strings are server-only.

## Connection handoff

Follow [Prisma database setup](database-setup.md). Configure the ignored `.env.local` using `.env.example`, then review and apply the migration, seed the development database and run `db:verify`.

Applying the migration, confirming persisted records after restart, and exercising the live database policies remain pending until a development connection is supplied.

## Verified locally

- Prisma 7.10.1 schema validation and client generation passed without database credentials. The generated client is ignored and recreated during installation and build.
- The initial PostgreSQL SQL was generated from the schema. Reviewed the additional capacity, currency, price and destination constraints, public read policies and private-table denials. These await execution against PostgreSQL.
- Production build, lint and standalone type checking passed. Listing routes are dynamic and require no database during the build.
- Chrome verified that home returned HTTP 200 and that Explore and a detail route showed the safe retry screen without a configured connection. Retry remained available. The visible text exposed no connection strings or Prisma diagnostics, and no fixture listings appeared.
- `.env.local` and generated client files are ignored. `.env.example` is tracked with empty values.
- npm reported eight moderate dependency advisories during installation. No forced dependency upgrades were applied.

## Next action

Connect the development database using the setup guide, then apply the migration, seed and run the database acceptance checks before proceeding to Module 04.

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
