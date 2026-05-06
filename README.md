# PirateBay Live Torrent

![PirateBay Live Torrent — Movies grid view](docs/screenshot.png)

A local desktop app that tracks listings from The Pirate Bay, looks up poster art and plot summaries on demand from Wikipedia (no API key, no signup), and lets you download + watch in one click. Built as a single-window Electron app with a bundled BitTorrent engine — no external client to configure, no web UI to keep open.

> **Status:** personal project, macOS Apple-Silicon (`arm64`) build. The source builds anywhere Electron runs, but the released `.dmg` is single-arch.

> ### ⚠️ macOS users — read this before you double-click the app
>
> The build is **unsigned**, so on first launch macOS will show *"Apple could not verify…"* and refuse to open it. **The app is fine — you just give it permission once:**
>
> 1. Open the **Apple menu → System Settings → Privacy & Security**.
> 2. Scroll to the bottom of that page. You'll see a line like *"PirateBay Live Torrent was blocked from use…"*.
> 3. Click **Open Anyway** next to it, confirm with your password / Touch ID, then click **Open** on the warning that pops up next.
>
> From then on it launches normally. (If you instead see *"App is damaged"*, see [Path B below](#path-b--app-is-damaged-and-cant-be-opened).)

---

## What it does

- **Three Top-100 topics out of the box.** First launch auto-creates 🎬 Top 100 Movies, 📺 Top 100 TV Shows, 🎮 Top 100 Games — no setup. Add your own topics (any apibay category or saved search) anytime.
- **Per-movie state.** Every entry has a status: *unseen / downloading / downloaded / seen / hidden*, plus a favorite flag. Quick-action buttons on every row.
- **List or grid view.** A toggle in the top-right of every page flips between a compact list with side thumbnails and a Netflix-style poster grid.
- **Posters on demand, no key required.** Wikipedia REST API lookup fires the moment a card scrolls into view. The result is cached locally so repeat loads are instant. Toggle off in Settings if you'd rather skip it.
- **One-click download.** The app drives a bundled `transmission-daemon` over its local RPC. No separate qBittorrent / Transmission install required — the daemon binary plus its dylibs ship inside the `.app`.
- **One-click play.** When a download finishes, hit ▶ Play and it opens in your OS default player.
- **Delete-while-keeping-history.** Free up disk by deleting the file but keeping the seen/downloaded record, so you don't accidentally re-download something you've already watched. The Download button reappears on those entries so you can re-grab them later.
- **Live download stats.** A global "All downloads" page shows everything in flight or completed across all topics, with peer counts and live speeds. Each row also has a ↻ button to force a fresh tracker / DHT re-announce when a swarm goes quiet.
- **Local-first.** SQLite database, no accounts, no cloud sync. Everything lives in `~/Library/Application Support/piratebay-live-torrent/`.

---

## Install (end users)

Pre-built `.dmg` from [Releases](https://github.com/javalight/PirateBayLiveTorrent/releases):

1. Download the latest `-arm64.dmg` (Apple Silicon Mac).
2. Open the `.dmg` and drag the app to `/Applications`.

### First launch — macOS will block it. Here's how to allow it.

This build is **unsigned** (no paid $99/yr Apple Developer cert), so the first time you double-click the app, macOS Gatekeeper will refuse to open it and show a warning. **The app is fine — you just have to give it permission once.** Pick the path that matches what you see:

#### Path A — "Apple could not verify…" (the common one)

1. Click **Done** on the warning dialog (do **not** click "Move to Trash").
2. Open the Apple menu → **System Settings** → **Privacy & Security**.
3. Scroll down to the **Security** section. You'll see a line saying:
   > "PirateBay Live Torrent" was blocked from use because it is not from an identified developer.
4. Click the **Open Anyway** button next to it.
5. Confirm with your Mac password / Touch ID.
6. macOS will pop the warning one more time — now click **Open**.

That's it. From now on the app launches normally with a double-click.

#### Path B — "App is damaged and can't be opened"

If you see the "damaged" message instead (depends on browser), open Terminal (⌘+Space → "Terminal") and run:

```bash
xattr -cr "/Applications/PirateBay Live Torrent.app"
```

Then double-click the app.

> The app isn't really damaged — that's just how older macOS phrases the same warning when the browser tagged the download with a `com.apple.quarantine` attribute. The Terminal command strips it.

That's it — no Homebrew install, no separate torrent client, no API key.

---

## Run from source (developers)

Requires:
- macOS (Apple Silicon or Intel)
- Node.js 20+
- [Homebrew](https://brew.sh/)

```bash
git clone https://github.com/javalight/PirateBayLiveTorrent.git
cd PirateBayLiveTorrent
brew install transmission-cli   # provides transmission-daemon
npm install
npm run dev
```

The `transmission-daemon` binary is auto-discovered from `/opt/homebrew/bin` (Apple Silicon brew), `/usr/local/bin` (Intel brew), or `$PATH`. For packaged `.dmg` builds it's bundled inside the app.

### Building a release `.dmg`

```bash
brew install dylibbundler            # one-time, for self-contained binary bundling
npm run package:mac
```

This:

1. Runs `scripts/bundle-transmission.sh` — copies your local `transmission-daemon` plus its non-system dylibs (`libevent`, `libminiupnpc`) into `resources/bin/`, rewriting their rpaths to `@executable_path/libs/...` so the bundle runs on a clean Mac with no Homebrew installed.
2. Builds the Electron app with `electron-vite`.
3. Runs `electron-builder` to produce a `.dmg` and `.zip` in `dist/`.

The result is fully self-contained — no install dependencies for the end user.

See [CLAUDE.md](CLAUDE.md) for the full build / release runbook (including how to cut a new GitHub release).

---

## Architecture

```
┌─────────────────┐      ┌───────────────────┐      ┌──────────────┐
│  Electron       │ IPC  │  main process     │ HTTP │ transmission │
│  renderer       │◄────►│  (Node + SQLite)  │ RPC  │   -daemon    │
│  (React)        │      │                   │◄────►│ (child proc) │
└─────────────────┘      └───────────────────┘      └──────────────┘
         │                        │                         │
         └─ List / grid views,    ├─ DAL (better-sqlite3)   └─ Real BitTorrent
            on-demand Wikipedia   ├─ apibay poller             via libtorrent —
            poster lookup,        ├─ Wikipedia enricher        DHT, trackers,
            settings, downloads   ├─ DownloadManager           uTP, UPnP/NAT-PMP
                                  └─ Engine wrapper
```

**Why not WebTorrent?** It was tried (see git history). The pure-JS implementation couldn't reliably reach traditional BitTorrent swarms on networks where seeders run libtorrent — it found ~0 peers where Transmission finds dozens. So the app embeds Transmission for the heavy lifting and just talks to it over its localhost RPC.

**Why not TMDB?** TMDB requires an API key plus an awkward signup form (application name, address, etc.). Wikipedia is free, requires no auth, and matches well enough for ~85% of mainstream releases. Lookups happen lazily — only when a card scrolls into view — and are cached locally, so the network cost is amortized to one request per movie ever.

---

## Source layout

```
src/
├── main/              Electron main process (Node)
│   ├── db/            SQLite schema, migrations, DAL, first-run seeds
│   ├── enrichment/    Wikipedia client + on-demand enricher + title parser
│   ├── sources/       apibay client + scheduled poller
│   ├── torrents/      Transmission daemon supervisor + RPC + engine wrapper
│   ├── config.ts      Settings persistence
│   └── index.ts       App lifecycle + IPC handlers
├── preload/           contextBridge surface
├── renderer/          React UI
│   └── src/
│       ├── App.tsx          Routing, history (back button), sidebar
│       ├── components/      MovieCard (list row), MoviePosterCard (grid tile), MovieGrid, StatusBadge
│       ├── views/           Top100, Filtered, Search, Master, Settings, NewTopic
│       ├── hooks/           useMovies, useDownloads
│       └── contexts/        DisplayMode (release/title), LayoutMode (list/grid), AppSettings
└── shared/            Types, IPC channel names, settings schema
```

---

## Legal notice

This software is a metadata browser and BitTorrent client. **It does not host or distribute any content.** Listings come from The Pirate Bay's public read-only JSON API ([apibay.org](https://apibay.org)). Poster thumbnails come from [Wikipedia](https://en.wikipedia.org/api/rest_v1/).

Downloading copyrighted material without permission is illegal in most jurisdictions. You are responsible for what you do with this tool. Use it for what's legal where you live: public-domain content, Creative Commons releases, software ISOs, your own backups, etc.

---

## License

This project's source code is licensed under the [GPL-3.0](LICENSE) license.

The bundled `transmission-daemon` binary is itself licensed under [GPL-3.0](https://github.com/transmission/transmission/blob/main/COPYING) by the Transmission project; redistribution of compiled `.dmg` builds is therefore subject to GPL-3.0 terms.

---

## Credits

- [Transmission](https://transmissionbt.com/) — the BitTorrent engine
- The Pirate Bay (via [apibay.org](https://apibay.org)) — listings
- [Wikipedia](https://en.wikipedia.org/) — poster art and plot summaries
- [electron-vite](https://electron-vite.org/), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [parse-torrent-title](https://github.com/clement-escolano/parse-torrent-title)
