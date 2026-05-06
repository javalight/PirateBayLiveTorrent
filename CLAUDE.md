# CLAUDE.md — Working notes for this repo

This file is loaded automatically as context. It documents how to build,
package, and release the app, plus the architecture quirks that bit us
and that future sessions need to know.

## TL;DR build & ship cheat sheet

```bash
# Quick dev loop — main + preload + renderer all watched. Renderer
# hot-reloads; main process changes need a Cmd-Q + relaunch of the dev
# Electron window.
npm run dev

# Typecheck both sides (main = Node, renderer = web).
npm run typecheck

# Production build of the .js bundles into out/. Doesn't make a .dmg.
npm run build

# Run the prod build (no dmg) — useful for sanity checking the bundle.
npm run start

# FULL release pipeline → produces a self-contained .dmg + .zip in dist/.
# This is what gets uploaded to a GitHub release.
npm run package:mac
```

`package:mac` is an alias for: `bundle-transmission.sh → electron-vite build → electron-builder --mac`. It runs all three steps in order; never run electron-builder alone.

## What's in `npm run package:mac`

1. **`scripts/bundle-transmission.sh`** copies the local `transmission-daemon` binary into `resources/bin/`, then runs `dylibbundler` to:
   - copy the daemon's non-system dylibs (`libevent`, `libminiupnpc`) into `resources/bin/libs/`,
   - rewrite the daemon's load paths to `@executable_path/libs/...`,
   - re-codesign the dylibs and the daemon (ad-hoc).
   The output is a fully self-contained ~3.4 MB folder. End users do NOT need Homebrew or any external Transmission install.

2. **`electron-vite build`** compiles `src/main`, `src/preload`, `src/renderer` into `out/`.

3. **`electron-builder --mac --config electron-builder.yml`** packages everything into `dist/PirateBay Live Torrent-{version}-arm64.dmg` and `.zip`.
   - `extraResources: resources/bin → bin` ships the bundled daemon inside `Contents/Resources/bin/` of the `.app`.
   - `mac.identity: '-'` tells electron-builder to **ad-hoc sign**. Without that, Apple Silicon shows the misleading "App is damaged" Gatekeeper error instead of the milder "developer cannot be verified" prompt.

## Versioning + releases

Releases are pinned to a `vX.Y.Z` git tag and a GitHub Release that hosts the `.dmg`/`.zip`. Process for a new release:

```bash
# 1. Bump version in package.json (matters because the .dmg filename
#    contains the version).
# 2. Commit + push everything.
git add -A && git commit -m "..."
git push

# 3. Build the artifacts.
rm -rf dist && npm run package:mac

# 4a. NEW release for a new version:
gh release create v0.1.1 \
  "dist/PirateBay Live Torrent-0.1.1-arm64.dmg" \
  "dist/PirateBay Live Torrent-0.1.1-arm64-mac.zip" \
  --title "v0.1.1 — short headline" \
  --notes "$(cat <<'EOF'
## What's new
- ...

## Install
1. Download the .dmg.
2. Drag to /Applications.
3. First launch: Apple menu → System Settings → Privacy & Security →
   click 'Open Anyway' next to the app.
EOF
)"

# 4b. Or REFRESH assets on an existing release (use --clobber):
gh release upload v0.1.1 \
  "dist/PirateBay Live Torrent-0.1.1-arm64.dmg" \
  "dist/PirateBay Live Torrent-0.1.1-arm64-mac.zip" \
  --clobber --repo javalight/PirateBayLiveTorrent
```

A "release" in this repo means: a tagged commit, a GitHub Release page with both `.dmg` (preferred user download) and `.zip` (alternate), plus release notes. `v0.1.0` is preserved as the first public build; subsequent releases bump the patch number.

## Repo layout (quick reference)

```
src/
├── main/                       # Electron main process (Node)
│   ├── index.ts                # App lifecycle + IPC handler registration
│   ├── config.ts               # AppSettings persistence (electron safeStorage)
│   ├── db/
│   │   ├── client.ts           # better-sqlite3 connection
│   │   ├── schema.ts           # CREATE TABLE statements
│   │   ├── migrations.ts       # versioned migrations
│   │   ├── dal.ts              # all queries (DALs)
│   │   └── seeds.ts            # default Top-100 topics on first launch
│   ├── enrichment/
│   │   ├── wikipedia.ts        # Wikipedia REST API client (no key)
│   │   ├── enricher.ts         # on-demand single-movie enrichment + dedupe
│   │   └── titleParser.ts      # parse-torrent-title wrapper
│   ├── sources/
│   │   ├── apibay.ts           # apibay.org client + magnet builder
│   │   └── poller.ts           # periodic top-100 / search refresh
│   ├── torrents/
│   │   ├── transmission-rpc.ts # HTTP RPC client for transmission-daemon
│   │   ├── transmission-daemon.ts # spawns + supervises the child process
│   │   ├── engine.ts           # unified torrentEngine surface used by manager
│   │   └── manager.ts          # DownloadManager — start/stop/restart/poll
│   └── player.ts               # OS default-app file open
├── preload/index.ts            # contextBridge surface
├── renderer/src/               # React UI
│   ├── App.tsx                 # routing + history (back button) + sidebar
│   ├── components/             # MovieCard (list), MoviePosterCard (grid), MovieGrid, StatusBadge
│   ├── views/                  # Top100, Filtered, Search, Master, Settings, NewTopic
│   ├── hooks/useMovies.ts, useDownloads.ts
│   ├── contexts/               # DisplayMode (release/title), LayoutMode (list/grid), AppSettings
│   ├── categories.ts           # apibay category id list (UI-side)
│   └── index.css
└── shared/                     # types + IPC channels + AppSettings shape
```

## Architecture decisions worth remembering

**BitTorrent engine: bundled `transmission-daemon` as a child process**, talked to over its HTTP RPC on a random localhost port (with auth disabled via `-T`). We tried WebTorrent first (pure JS), but it can't reach traditional BitTorrent peers reliably on networks where seeders run libtorrent — found ~0 peers where Transmission finds dozens. See git history of `src/main/torrents/`.

**Daemon ports**: random for both RPC (`-p`) and peer (`-P`) so orphaned daemons from a crashed prior run never block a new launch. Detection of orphans: just spawn a fresh one; the new RPC port differs.

**Graceful shutdown**: `app.on('before-quit')` calls `event.preventDefault()`, awaits `downloads.stopAndWait()` which SIGTERMs the daemon and waits for its `exit` event (with an 8s timeout fallback to SIGKILL), then calls `app.exit(0)`. Without this, Electron exits before Transmission flushes `.resume` files and progress is lost on next launch. Hard kills (`pkill -9`, Force Quit) bypass this — recovered by re-verify on add.

**Re-verify on add** (`engine.addMagnet` calls `torrent-verify` after `torrent-add`): if a torrent's resume state was lost but the file is intact on disk, Transmission rehashes pieces and resumes from where they match instead of starting over.

**Metadata (posters, plots)** comes from the **Wikipedia REST API** (no key, no signup). Two-step: search → REST page summary endpoint. Fetched **on demand** when a `MovieCard` scrolls into view via IntersectionObserver, then cached in the `movies` table so subsequent renders are instant. The user explicitly rejected TMDB because it requires a key + an annoying signup form.

**Settings persistence**: encrypted-at-rest via `safeStorage` for secrets (currently nothing — TMDB key was removed); plain JSON for the rest. File lives at `~/Library/Application Support/piratebay-live-torrent/settings.json`. Loader tolerates legacy keys (`qbitHost`, `tmdbApiKey`, `secrets.*`) so older installs upgrade cleanly.

**SQLite DB**: `pbl.sqlite` in the userData dir. Migrations in `src/main/db/migrations.ts` are versioned and applied on connect. The `tmdb_id` and `enrichment_tried_at` columns are leftover from the TMDB era — kept to avoid a schema-touching migration; their DAL helpers are dead code now but harmless.

**First-run seed**: `seedDefaultTopics()` creates Top 100 Movies / TV Shows / Games **only if the topics table is completely empty** (counting archived). Existing installs are never disturbed.

## Mac Gatekeeper notes (write these in every release-notes block)

The build is unsigned (no $99/yr Apple Developer cert). On first launch the user sees one of two warnings:

- **"App is damaged and can't be opened"** → Terminal: `xattr -cr "/Applications/PirateBay Live Torrent.app"`
- **"Apple could not verify…"** → System Settings → Privacy & Security → scroll down → click *Open Anyway* next to the app's name.

Ad-hoc signing (`identity: '-'`) makes the second message far more common than the first.

## Environment quirks

- The user has `ELECTRON_RUN_AS_NODE=1` set in their login shell. The `dev` and `start` npm scripts neutralize it with a `ELECTRON_RUN_AS_NODE=` prefix. Don't drop that prefix.
- `dylibbundler` and `transmission-cli` are installed via Homebrew on the dev machine (`/opt/homebrew/...`). For other devs, `bundle-transmission.sh` will print a clear "install with brew install …" error if missing.
- `resources/bin/transmission-daemon` and `resources/bin/libs/` are gitignored. They're rebuilt every `npm run package:mac`.

## Things to NOT do

- **Don't drop the `:where()` wrapper** around `[data-tooltip] { position: relative }` in `index.css`. Without it, the rule ties on specificity with absolutely-positioned tooltip-bearing elements (e.g., `.poster-card-fav`) and clobbers their corner placement.
- **Don't put `overflow: hidden` on `.poster-card`**. The image clips itself via its own `border-radius`. Card-level overflow:hidden re-introduces the tooltip-clipping bug for buttons sitting near the card edges.
- **Don't shell out to `git rebase -i` or `git add -i`** in this repo via Bash — interactive flags hang. Use `git filter-branch --msg-filter` for non-interactive history rewrites.
- **Don't unilaterally force-push to main**. The repo is public; rewriting history is a destructive action. Always confirm with the user first even when they've asked for a commit-message cleanup.
