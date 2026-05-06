import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { IpcChannels } from '../shared/ipc.js'
import { closeDb, getDb } from './db/client.js'
import { Dal } from './db/dal.js'
import { seedDefaultTopics } from './db/seeds.js'
import { Poller } from './sources/poller.js'
import { buildMagnet, searchTorrents as apibaySearch } from './sources/apibay.js'
import { parseTorrentTitle } from './enrichment/titleParser.js'
import { Enricher } from './enrichment/enricher.js'
import { getSettings, updateSettings, type UpdateSettingsInput } from './config.js'
import { DownloadManager } from './torrents/manager.js'
import { openInDefaultApp } from './player.js'
import type { MovieStatus } from '../shared/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let dal: Dal | null = null
let poller: Poller | null = null
let downloads: DownloadManager | null = null
let enricher: Enricher | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(d: Dal, p: Poller, dl: DownloadManager): void {
  ipcMain.handle(IpcChannels.ping, () => {
    const row = getDb().prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number | null }
    return `pong (db schema v${row.v ?? 0})`
  })

  ipcMain.handle(IpcChannels.pollNow, async () => p.tick())
  ipcMain.handle(IpcChannels.pollOneNow, async (_e, topicId: number) => p.refreshOne(topicId))

  ipcMain.handle(IpcChannels.pollerStatus, () => {
    const s = getSettings()
    return {
      intervalMs: s.pollIntervalMin * 60 * 1000,
      categories: s.categories,
      running: true
    }
  })

  ipcMain.handle(IpcChannels.listTopics, () => d.listTopics())
  ipcMain.handle(IpcChannels.createTopic, async (_e, arg: Parameters<Dal['createTopic']>[0]) => {
    const t = d.createTopic(arg)
    // Kick off an immediate fetch so the new topic populates fast.
    void p.refreshOne(t.id)
    return t
  })
  ipcMain.handle(IpcChannels.updateTopic, async (_e, topicId: number, patch: Parameters<Dal['updateTopic']>[1]) => {
    const t = d.updateTopic(topicId, patch)
    if (patch.sourceKind || patch.sourceParam || patch.sourceCategory !== undefined) {
      void p.refreshOne(t.id)
    }
    return t
  })
  ipcMain.handle(IpcChannels.archiveTopic, (_e, topicId: number) => d.archiveTopic(topicId))
  ipcMain.handle(IpcChannels.topicStats, () => {
    const topics = d.listTopics()
    return topics.map((t) => d.topicStats(t))
  })

  ipcMain.handle(IpcChannels.topMovies, (_e, topicId: number) => d.topMovies(topicId))
  ipcMain.handle(IpcChannels.listMovies, (_e, arg: Parameters<Dal['filterMovies']>[0]) => d.filterMovies(arg))

  ipcMain.handle(IpcChannels.enrichMovie, async (_e, movieId: number) => {
    // On-demand single-movie enrichment via Wikipedia, triggered from the
    // renderer when a card scrolls into view. Cached on disk via the
    // movies table so subsequent loads use stored URL.
    return enricher?.enrichOne(movieId) ?? null
  })

  ipcMain.handle(IpcChannels.getSettings, () => getSettings())
  ipcMain.handle(IpcChannels.updateSettings, (_e, patch: UpdateSettingsInput) => {
    const next = updateSettings(patch)
    p.setOptions({
      intervalMs: next.pollIntervalMin * 60 * 1000
    })
    return next
  })

  ipcMain.handle(IpcChannels.download, async (_e, movieId: number) => dl.download(movieId))
  ipcMain.handle(IpcChannels.restartDownload, async (_e, movieId: number) => dl.restart(movieId))
  ipcMain.handle(IpcChannels.cancelDownload, async (_e, movieId: number) => dl.cancel(movieId))
  ipcMain.handle(IpcChannels.deleteFile, async (_e, movieId: number) => dl.deleteFile(movieId))

  ipcMain.handle(IpcChannels.findTorrents, async (_e, query: string, category: number | null) => {
    const items = await apibaySearch(query, category)
    const now = Date.now()
    const results: Array<{
      movie: ReturnType<Dal['movieById']>
      state: ReturnType<Dal['ensureState']>
      bestTorrent: ReturnType<Dal['torrentByHash']>
      rank: null
    }> = []

    for (const it of items) {
      d.upsertTorrent(
        {
          infoHash: it.info_hash,
          name: it.name,
          category: it.category,
          sizeBytes: it.size,
          seeders: it.seeders,
          leechers: it.leechers,
          magnet: buildMagnet(it.info_hash, it.name),
          imdb: it.imdb && it.imdb.length > 0 ? it.imdb : null
        },
        now
      )

      let torrent = d.torrentByHash(it.info_hash)!
      if (!torrent.movieId) {
        const parsed = parseTorrentTitle(it.name)
        const movieId = d.upsertMovieByTmdbId({
          tmdbId: null,
          title: parsed.cleanTitle,
          year: parsed.year,
          posterUrl: null,
          plot: null,
          rating: null,
          runtimeMin: null,
          genres: []
        })
        d.linkTorrentToMovie(it.info_hash, movieId)
        d.ensureState(movieId)
        torrent = d.torrentByHash(it.info_hash)!
      }

      const movie = d.movieById(torrent.movieId!)
      const state = d.ensureState(torrent.movieId!)
      results.push({ movie, state, bestTorrent: torrent, rank: null })
    }

    return results
  })
  ipcMain.handle(IpcChannels.play, async (_e, movieId: number) => {
    const row = getDb()
      .prepare('SELECT file_path FROM movie_state WHERE movie_id = ?')
      .get(movieId) as { file_path: string | null } | undefined
    if (!row?.file_path) throw new Error('No file recorded for this movie')
    await openInDefaultApp(row.file_path)
    d.setStatus(movieId, 'seen', { seenAt: Date.now() })
  })
  ipcMain.handle(IpcChannels.setStatus, (_e, movieId: number, status: MovieStatus) => {
    d.setStatus(movieId, status, status === 'seen' ? { seenAt: Date.now() } : {})
  })
  ipcMain.handle(IpcChannels.setFavorite, (_e, movieId: number, favorite: boolean) => {
    d.setFavorite(movieId, favorite)
  })
  ipcMain.handle(IpcChannels.revealItem, async (_e, movieId: number) => {
    const row = getDb()
      .prepare('SELECT file_path FROM movie_state WHERE movie_id = ?')
      .get(movieId) as { file_path: string | null } | undefined
    if (!row?.file_path) throw new Error('No file recorded for this movie')
    shell.showItemInFolder(row.file_path)
  })
  ipcMain.handle(IpcChannels.openExternal, async (_e, url: string) => {
    if (typeof url !== 'string' || !/^https?:/i.test(url)) {
      throw new Error('openExternal only accepts http/https URLs')
    }
    await shell.openExternal(url)
  })
  ipcMain.handle(IpcChannels.openTrailer, async (_event, url: string, title?: string) => {
    if (typeof url !== 'string' || !/^https?:/i.test(url)) {
      throw new Error('openTrailer only accepts http/https URLs')
    }
    // No `parent`: macOS child windows can't enter native fullscreen,
    // and YouTube's fullscreen button is the whole point of this UX.
    const win = new BrowserWindow({
      width: 1024,
      height: 720,
      title: title ? `Trailer — ${title}` : 'Trailer',
      autoHideMenuBar: true,
      backgroundColor: '#000',
      webPreferences: {
        // No preload / no app API surface — this loads untrusted external content.
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    // Bridge HTML5 Fullscreen API → native window fullscreen so YouTube's
    // fullscreen button actually expands the window (otherwise the <video>
    // just fills the existing 1024×720 frame).
    win.webContents.on('enter-html-full-screen', () => win.setFullScreen(true))
    win.webContents.on('leave-html-full-screen', () => win.setFullScreen(false))
    // Keep navigation contained: any new-window/popup attempts (YouTube
    // sometimes opens share links in a new tab) load in the same window
    // instead of spawning extras.
    win.webContents.setWindowOpenHandler(({ url: target }) => {
      if (/^https?:/i.test(target)) win.loadURL(target)
      return { action: 'deny' }
    })
    await win.loadURL(url)
  })
  ipcMain.handle(IpcChannels.openPath, async (_e, path: string) => {
    if (!path || typeof path !== 'string') throw new Error('Empty path')
    const expanded = path.startsWith('~/') ? path.replace(/^~/, app.getPath('home')) : path
    mkdirSync(expanded, { recursive: true })
    console.log('[openPath] opening:', expanded)
    const err = await shell.openPath(expanded)
    if (!err) return
    console.warn('[openPath] shell.openPath failed:', err, '— falling back to /usr/bin/open')
    if (process.platform === 'darwin') {
      await new Promise<void>((resolve, reject) => {
        const p = spawn('/usr/bin/open', [expanded], { detached: true, stdio: 'ignore' })
        p.on('error', reject)
        p.on('spawn', () => {
          p.unref()
          resolve()
        })
      })
      return
    }
    throw new Error(err)
  })
}

app.whenReady().then(() => {
  dal = new Dal(getDb())
  seedDefaultTopics(dal)
  const settings = getSettings()
  poller = new Poller(dal, {
    intervalMs: settings.pollIntervalMin * 60 * 1000
  })
  downloads = new DownloadManager(dal)
  enricher = new Enricher(dal)

  poller.onResult((r) => {
    // Notify renderer of new torrents; enrichment now happens on-demand
    // when cards scroll into view (no background metadata fetch).
    if (r.newTorrents === 0 && r.unlinkedCount === 0) return
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.topUpdated, { ...r, fetchedAt: Date.now() })
    }
  })

  registerIpc(dal, poller, downloads)
  poller.start()
  downloads.start()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

let shuttingDown = false
app.on('before-quit', (event) => {
  if (shuttingDown) return
  shuttingDown = true
  // Block Electron from exiting until the transmission daemon has flushed
  // its `.resume` files; otherwise downloads restart from 0% next launch.
  event.preventDefault()
  ;(async () => {
    try {
      poller?.stop()
      await downloads?.stopAndWait()
      closeDb()
    } catch (err) {
      console.error('[shutdown] error during graceful stop:', err)
    } finally {
      app.exit(0)
    }
  })()
})

// Catch terminal-driven kills (Ctrl-C from `npm run dev`, SIGTERM from a
// supervisor) so the daemon still gets a chance to flush.
const gracefulSignal = (sig: NodeJS.Signals): void => {
  console.log(`[shutdown] received ${sig}, flushing daemon…`)
  app.quit()
}
process.on('SIGINT', () => gracefulSignal('SIGINT'))
process.on('SIGTERM', () => gracefulSignal('SIGTERM'))
