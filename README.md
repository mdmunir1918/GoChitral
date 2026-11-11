# GoChitral

GoChitral is a tourist guide and itinerary planner for Chitral. Browse the local development catalogue by place, category or location. Destination pages link to related activities, hotels and guides. The [progress record](docs/progress.md) tracks each module.

Module 04 adds Auth.js accounts, manager access and administrator MFA. Follow [Auth setup](docs/auth-setup.md) for local recovery links, optional SMTP and administrator provisioning.

Module 05 adds [administrator publishing](docs/publishing.md), draft revisions, stale-edit protection, suspension/reactivation and audit history.

Module 06 adds the [hotel manager workspace](docs/hotel-workspace.md), private Cloudflare R2 photos, room drafts and admin review.

Module 07 adds the [guest day planner and PKR budget](docs/planner.md). Module 08 adds [saved trips and printable summaries](docs/saved-trips.md), safe save retries, owner-only access and edit conflicts.

Module 09 adds [public guide profiles and private guide requests](docs/guide-requests.md), with administrator decisions, audit history and overlapping-date protection.

## Run on Windows

Use PowerShell in the folder containing `package.json`. This project uses Node.js **24.22.1** and npm **11.19.1**. CI reads the exact Node version from `.nvmrc`.

```powershell
git --version
node --version
npm.cmd --version
```

If Node or npm is missing on an x64 laptop, install the [Node.js 24.22.1 Windows installer](https://nodejs.org/dist/v24.22.1/node-v24.22.1-x64.msi) with npm selected, then reopen PowerShell. For a portable installation, extract the [official Windows ZIP](https://nodejs.org/dist/v24.22.1/node-v24.22.1-win-x64.zip) and add the folder containing `node.exe` and `npm.cmd` to your user Path. If Git is missing, install [Git for Windows](https://git-scm.com/downloads/win) and reopen PowerShell.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the local address printed in the terminal, usually [127.0.0.1:3000](http://127.0.0.1:3000). Press Ctrl+C to stop. The development and production preview scripts bind to loopback. Module 03 reads the catalogue from PostgreSQL through Prisma. Follow [database setup](docs/database-setup.md) to configure the server-only connections, apply migrations and seed development data.

## Verify a production build

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run typecheck
npm.cmd start
```

The build generates route types used by the type checker. Search for Bumburet on the home page and follow the Bumburet Valley link. The detail URL can be reopened directly on the same laptop. The hotel and guide profiles are fictional examples. Press Ctrl+C when finished.

## Project files

The App Router entry points and Tailwind styles live in `src/app/`. The supplied artwork is in `public/brand/`. Follow the [build guide](docs/GoChitral_Build_Guide.md) in order and review the result of each module.

The home photograph is [The City of Chitral and Tirich Mir by Emaad Paracha](https://commons.wikimedia.org/wiki/File:The_City_of_Chitral_and_Tirich_Mir.jpg). The local copy was resized and converted to WebP, and its display crop varies with screen width. It is distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

The catalogue also uses [Bumburet Valley XWJJ9009 by Numan Ali](https://commons.wikimedia.org/wiki/File:Bumburet_Valley_XWJJ9009.jpg) under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and [Chitral Kalash Museum by G.H. Farooqui](https://commons.wikimedia.org/wiki/File:Chitral_Kalash_Museum.jpg) under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The local WebP versions retain the respective licenses. Images are resized and displayed with responsive crops. Each listing credits its photograph.
