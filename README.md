# GoChitral

GoChitral is a tourist guide and itinerary planner for Chitral. The local app includes a branded home page, responsive navigation and an Explore entry point. The [progress record](docs/progress.md) tracks each module.

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
npm.cmd run dev -- --hostname 127.0.0.1
```

Open the local address printed in the terminal, usually [localhost:3000](http://localhost:3000). Press Ctrl+C to stop. Module 00 runs without service accounts or environment variables.

## Verify a production build

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run typecheck
npm.cmd start -- --hostname 127.0.0.1
```

The build generates route types used by the type checker. Open the local URL, enter a place name, and submit the search. Explore displays the query in its shareable URL. The logo returns home. Press Ctrl+C when finished.

## Project files

The App Router entry points and Tailwind styles live in `src/app/`. The supplied artwork is in `public/brand/`. Follow the [build guide](docs/GoChitral_Build_Guide.md) in order and review the result of each module.

The home photograph is [The City of Chitral and Tirich Mir by Emaad Paracha](https://commons.wikimedia.org/wiki/File:The_City_of_Chitral_and_Tirich_Mir.jpg). The local copy was resized and converted to WebP, and its display crop varies with screen width. It is distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
