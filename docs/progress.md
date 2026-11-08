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
