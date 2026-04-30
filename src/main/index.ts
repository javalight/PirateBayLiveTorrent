import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { IpcChannels } from '../shared/ipc.js'
import { closeDb, getDb } from './db/client.js'
import { Dal } from './db/dal.js'
import { Poller } from './sources/poller.js'
import { Enricher } from './enrichment/enricher.js'
import { TmdbClient } from './enrichment/tmdb.js'
import { getSettings, updateSettings, type UpdateSettingsInput } from './config.js'
import { DownloadManager } from './torrents/manager.js'
import { openInDefaultApp } from './player.js'
import type { MovieStatus } from '../shared/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let dal: Dal | null = null
let poller: Poller | null = null
let downloads: DownloadManager | null = null

const buildEnricher = (d: Dal): Enricher => {
  const settings = getSettings()
  const tmdb = settings.tmdb.apiKey ? new TmdbClient(settings.tmdb.apiKey) : null
  return new Enricher(d, tmdb)
}

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

  ipcMain.handle(IpcChannels.pollerStatus, () => {
    const s = getSettings()
    return {
      intervalMs: s.pollIntervalMin * 60 * 1000,
      categories: s.categories,
      running: true
    }
  })

  ipcMain.handle(IpcChannels.topMovies, (_e, category: number) => d.topMovies(category))
  ipcMain.handle(IpcChannels.listMovies, (_e, arg: Parameters<Dal['filterMovies']>[0]) => d.filterMovies(arg))

  ipcMain.handle(IpcChannels.enrichNow, async () => buildEnricher(d).enrichPending())

  ipcMain.handle(IpcChannels.getSettings, () => getSettings())
  ipcMain.handle(IpcChannels.updateSettings, (_e, patch: UpdateSettingsInput) => {
    const next = updateSettings(patch)
    p.setOptions({
      categories: next.categories,
      intervalMs: next.pollIntervalMin * 60 * 1000
    })
    return next
  })

  ipcMain.handle(IpcChannels.download, async (_e, movieId: number) => dl.download(movieId))
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
  ipcMain.handle(IpcChannels.testQbit, () => dl.testConnection())
}

app.whenReady().then(() => {
  dal = new Dal(getDb())
  const settings = getSettings()
  poller = new Poller(dal, {
    categories: settings.categories,
    intervalMs: settings.pollIntervalMin * 60 * 1000
  })
  downloads = new DownloadManager(dal)

  poller.onResult(async (r) => {
    if (r.newTorrents === 0 && r.unlinkedCount === 0) return
    try {
      const result = await buildEnricher(dal!).enrichPending()
      console.log('[enricher]', result)
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(IpcChannels.topUpdated, { ...r, fetchedAt: Date.now() })
      }
    } catch (err) {
      console.error('[enricher] error:', err)
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
  poller?.stop()
  downloads?.stop()
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  poller?.stop()
  downloads?.stop()
  closeDb()
})
