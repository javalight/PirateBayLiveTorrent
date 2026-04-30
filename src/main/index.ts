import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
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
  ipcMain.handle(IpcChannels.archiveTopic, (_e, topicId: number) => d.archiveTopic(topicId))
  ipcMain.handle(IpcChannels.topicStats, () => {
    const topics = d.listTopics()
    return topics.map((t) => d.topicStats(t))
  })

  ipcMain.handle(IpcChannels.topMovies, (_e, topicId: number) => d.topMovies(topicId))
  ipcMain.handle(IpcChannels.listMovies, (_e, arg: Parameters<Dal['filterMovies']>[0]) => d.filterMovies(arg))

  ipcMain.handle(IpcChannels.enrichNow, async () => buildEnricher(d).enrichPending())

  ipcMain.handle(IpcChannels.getSettings, () => getSettings())
  ipcMain.handle(IpcChannels.updateSettings, (_e, patch: UpdateSettingsInput) => {
    const next = updateSettings(patch)
    p.setOptions({
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
  ipcMain.handle(IpcChannels.setFavorite, (_e, movieId: number, favorite: boolean) => {
    d.setFavorite(movieId, favorite)
  })
  ipcMain.handle(IpcChannels.testQbit, () => dl.testConnection())
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
  const settings = getSettings()
  poller = new Poller(dal, {
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
