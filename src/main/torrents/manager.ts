import { BrowserWindow } from 'electron'
import { mkdirSync, rmSync, statSync } from 'node:fs'
import { Dal } from '../db/dal.js'
import { getSettings } from '../config.js'
import { buildMagnet } from '../sources/apibay.js'
import { isComplete, torrentEngine } from './engine.js'
import type { Torrent } from '../../shared/types.js'

export interface DownloadProgress {
  movieId: number
  qbitHash: string
  state: string
  progress: number
  dlSpeed: number
  upSpeed: number
  peers: number
  done: boolean
}

const POLL_INTERVAL_MS = 2_000

export class DownloadManager {
  private timer: NodeJS.Timeout | null = null
  private active = new Set<string>()

  constructor(private readonly dal: Dal) {}

  start(): void {
    if (this.timer) return
    void torrentEngine
      .start()
      .then(() => this.resumeActive())
      .catch((err) => {
        console.error('[downloads] engine failed to start:', err)
      })
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    void torrentEngine.destroy()
  }

  /** Async variant — awaits the daemon's graceful shutdown so its `.resume`
   *  files are flushed before the process exits. Use from `before-quit`. */
  async stopAndWait(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    await torrentEngine.destroy()
  }

  /** Begin downloading the best torrent for a movie. */
  async download(movieId: number): Promise<void> {
    const torrents = this.dal.torrentsForMovie(movieId)
    const best = pickBest(torrents)
    if (!best) throw new Error(`No torrent linked to movie ${movieId}`)

    const settings = getSettings()
    mkdirSync(settings.downloadDir, { recursive: true })

    const lowerHash = best.infoHash.toLowerCase()
    const magnet = buildMagnet(best.infoHash, best.name)
    await torrentEngine.addMagnet(magnet, lowerHash, settings.downloadDir)

    this.dal.setStatus(movieId, 'downloading', { qbitHash: lowerHash })
    this.active.add(lowerHash)
    this.broadcast({
      movieId,
      qbitHash: lowerHash,
      state: 'metaDL',
      progress: 0,
      dlSpeed: 0,
      upSpeed: 0,
      peers: 0,
      done: false
    })
  }

  /**
   * Re-announce an in-progress torrent so it discovers peers freshly. If the
   * torrent isn't in the engine yet (e.g. app was restarted and resumeActive
   * hasn't run), fall back to adding it. Avoids destroy/re-add which races
   * with in-flight UDP responses and surfaces as `getsockname EBADF`.
   */
  async restart(movieId: number): Promise<void> {
    const torrents = this.dal.torrentsForMovie(movieId)
    const best = pickBest(torrents)
    if (!best) throw new Error(`No torrent linked to movie ${movieId}`)

    const settings = getSettings()
    const lowerHash = best.infoHash.toLowerCase()

    const reannounced = await torrentEngine.reannounce(lowerHash)
    if (!reannounced) {
      mkdirSync(settings.downloadDir, { recursive: true })
      const magnet = buildMagnet(best.infoHash, best.name)
      await torrentEngine.addMagnet(magnet, lowerHash, settings.downloadDir)
    }

    this.active.add(lowerHash)
    this.broadcast({
      movieId,
      qbitHash: lowerHash,
      state: 'metaDL',
      progress: 0,
      dlSpeed: 0,
      upSpeed: 0,
      peers: 0,
      done: false
    })
  }

  /**
   * Cancel an in-progress download: yank the torrent from the engine
   * (with data), reset status to 'unseen' so the Download button comes
   * back, and drop it from the active set. Used when a torrent is stuck
   * in metaDL or otherwise not making progress and the user wants out.
   */
  async cancel(movieId: number): Promise<void> {
    const row = this.dbRow(movieId)
    if (row?.qbit_hash) {
      try {
        await torrentEngine.remove(row.qbit_hash, true)
      } catch (err) {
        console.warn('[downloads] engine cancel failed:', err)
      }
      this.active.delete(row.qbit_hash.toLowerCase())
    }
    if (row?.file_path) {
      try {
        const stat = statSync(row.file_path)
        rmSync(row.file_path, { recursive: stat.isDirectory(), force: true })
      } catch {
        /* file may already be gone or never landed — fine */
      }
    }
    this.dal.setStatus(movieId, 'unseen', { filePath: null, qbitHash: null })
  }

  /**
   * Delete the downloaded file(s) for a movie to reclaim disk space.
   * Keeps the seen/status state and history intact — only the file_path and
   * qbit_hash are cleared so the UI knows the file is gone.
   */
  async deleteFile(movieId: number): Promise<void> {
    const row = this.dbRow(movieId)
    if (!row?.file_path && !row?.qbit_hash) {
      throw new Error('Nothing to delete — no file recorded for this movie')
    }

    let engineDeleted = false
    if (row.qbit_hash) {
      try {
        await torrentEngine.remove(row.qbit_hash, true)
        engineDeleted = true
      } catch (err) {
        console.warn('[downloads] engine delete failed, falling back to fs:', err)
      }
    }

    if (!engineDeleted && row.file_path) {
      try {
        const stat = statSync(row.file_path)
        rmSync(row.file_path, { recursive: stat.isDirectory(), force: true })
      } catch (err) {
        console.warn('[downloads] fs delete failed:', err)
      }
    }

    this.dal.clearFile(movieId)
    this.active.delete((row.qbit_hash ?? '').toLowerCase())
  }

  private dbRow(movieId: number): { file_path: string | null; qbit_hash: string | null } | undefined {
    return (this.dal as unknown as { db: import('better-sqlite3').Database }).db
      .prepare('SELECT file_path, qbit_hash FROM movie_state WHERE movie_id = ?')
      .get(movieId) as { file_path: string | null; qbit_hash: string | null } | undefined
  }

  /** On startup, re-add any torrents that were 'downloading' when the app last quit. */
  private async resumeActive(): Promise<void> {
    const hashes = this.dal.activeDownloadHashes()
    if (hashes.length === 0) return
    const settings = getSettings()
    mkdirSync(settings.downloadDir, { recursive: true })

    for (const hash of hashes) {
      const movieId = this.dal.movieIdByQbitHash(hash)
      if (movieId == null) continue
      const torrents = this.dal.torrentsForMovie(movieId)
      const best = pickBest(torrents)
      if (!best) continue
      try {
        const magnet = buildMagnet(best.infoHash, best.name)
        await torrentEngine.addMagnet(magnet, hash, settings.downloadDir)
        this.active.add(hash)
      } catch (err) {
        console.warn(`[downloads] could not resume ${hash}:`, err)
      }
    }
  }

  private async tick(): Promise<void> {
    if (this.active.size === 0) return

    const settings = getSettings()
    let infos
    try {
      infos = await torrentEngine.info([...this.active])
    } catch (err) {
      console.error('[downloads] tick failed:', err)
      return
    }

    for (const info of infos) {
      const hash = info.hash.toLowerCase()
      const movieId = this.dal.movieIdByQbitHash(hash)
      if (movieId == null) continue

      console.log(
        `[downloads] ${hash.substring(0, 8)} state=${info.state} progress=${(info.progress * 100).toFixed(1)}% peers=${info.peers} ↓${info.dlspeed}B/s`
      )

      const done = isComplete(info)
      const livePath = info.content_path || info.save_path
      if (livePath) this.dal.setFilePath(movieId, livePath)

      this.broadcast({
        movieId,
        qbitHash: hash,
        state: info.state,
        progress: info.progress,
        dlSpeed: info.dlspeed,
        upSpeed: info.upspeed,
        peers: info.peers,
        done
      })

      if (done) {
        const filePath = info.content_path || info.save_path
        const newStatus = settings.autoMarkSeenOnDownload ? 'seen' : 'downloaded'
        const now = Date.now()
        this.dal.setStatus(movieId, newStatus, {
          filePath,
          downloadedAt: now,
          seenAt: settings.autoMarkSeenOnDownload ? now : null
        })
        this.active.delete(hash)
      }
    }
  }

  private broadcast(p: DownloadProgress): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('download:progress', p)
    }
  }
}

function pickBest(torrents: Torrent[]): Torrent | null {
  if (torrents.length === 0) return null
  const score = (t: Torrent): number => {
    let s = t.seeders
    if (/\b(1080p|2160p|4k)\b/i.test(t.name)) s += 10_000
    else if (/\b720p\b/i.test(t.name)) s += 5_000
    return s
  }
  return [...torrents].sort((a, b) => score(b) - score(a))[0]!
}
