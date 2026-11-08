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
