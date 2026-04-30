import { BrowserWindow } from 'electron'
import { mkdirSync } from 'node:fs'
import { Dal } from '../db/dal.js'
import { getSettings } from '../config.js'
import { isComplete, QbitError, QbittorrentClient } from './qbittorrent.js'
import type { Torrent } from '../../shared/types.js'

export interface DownloadProgress {
  movieId: number
  qbitHash: string
  state: string
  progress: number
  dlSpeed: number
  done: boolean
}

const POLL_INTERVAL_MS = 4_000

export class DownloadManager {
  private timer: NodeJS.Timeout | null = null
  private active = new Set<string>()

  constructor(private readonly dal: Dal) {}

  start(): void {
    if (this.timer) return
    for (const h of this.dal.activeDownloadHashes()) this.active.add(h)
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Submit the best torrent for a movie to qBittorrent. */
  async download(movieId: number): Promise<void> {
    const torrents = this.dal.torrentsForMovie(movieId)
    const best = pickBest(torrents)
    if (!best) throw new Error(`No torrent linked to movie ${movieId}`)

    const settings = getSettings()
    if (!settings.qbit.password) {
      throw new Error('qBittorrent password not configured. Open Settings and add it.')
    }

    mkdirSync(settings.downloadDir, { recursive: true })

    const qbit = new QbittorrentClient(settings.qbit.host, settings.qbit.username, settings.qbit.password)
    await qbit.addMagnet(best.magnet, settings.downloadDir)

    const lowerHash = best.infoHash.toLowerCase()
    this.dal.setStatus(movieId, 'downloading', { qbitHash: lowerHash })
    this.active.add(lowerHash)
    this.broadcast({
      movieId,
      qbitHash: lowerHash,
      state: 'metaDL',
      progress: 0,
      dlSpeed: 0,
      done: false
    })
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const settings = getSettings()
    if (!settings.qbit.password) return { ok: false, message: 'No password configured' }
    const qbit = new QbittorrentClient(settings.qbit.host, settings.qbit.username, settings.qbit.password)
    try {
      await qbit.test()
      return { ok: true, message: 'Connected' }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  private async tick(): Promise<void> {
    if (this.active.size === 0) return
    const settings = getSettings()
    if (!settings.qbit.password) return

    const qbit = new QbittorrentClient(settings.qbit.host, settings.qbit.username, settings.qbit.password)
    let infos
    try {
      infos = await qbit.info([...this.active])
    } catch (err) {
      if (err instanceof QbitError) console.warn('[downloads]', err.message)
      else console.error('[downloads] tick failed:', err)
      return
    }

    for (const info of infos) {
      const hash = info.hash.toLowerCase()
      const movieId = this.dal.movieIdByQbitHash(hash)
      if (movieId == null) continue

      const done = isComplete(info)
      this.broadcast({
        movieId,
        qbitHash: hash,
        state: info.state,
        progress: info.progress,
        dlSpeed: info.dlspeed,
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
