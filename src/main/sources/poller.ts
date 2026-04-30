import { BrowserWindow } from 'electron'
import { Dal } from '../db/dal.js'
import { buildMagnet, fetchTop100 } from './apibay.js'

export interface PollerOptions {
  categories: number[]
  intervalMs: number
}

export interface PollResult {
  category: number
  fetched: number
  newTorrents: number
  unlinkedCount: number
  fetchedAt: number
}

export class Poller {
  private timer: NodeJS.Timeout | null = null
  private running = false
  private opts: PollerOptions
  private readonly listeners = new Set<(r: PollResult) => void>()

  constructor(private readonly dal: Dal, opts: PollerOptions) {
    this.opts = opts
  }

  start(): void {
    if (this.timer) return
    void this.tick()
    this.timer = setInterval(() => void this.tick(), this.opts.intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  setOptions(opts: Partial<PollerOptions>): void {
    const wasRunning = this.timer !== null
    this.stop()
    this.opts = { ...this.opts, ...opts }
    if (wasRunning) this.start()
  }

  onResult(fn: (r: PollResult) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  async tick(): Promise<PollResult[]> {
    if (this.running) return []
    this.running = true
    try {
      const results: PollResult[] = []
      for (const cat of this.opts.categories) {
        try {
          const r = await this.refreshCategory(cat)
          results.push(r)
          this.broadcast(r)
        } catch (err) {
          console.error(`[poller] category ${cat} failed:`, err)
        }
      }
      return results
    } finally {
      this.running = false
    }
  }

  private async refreshCategory(category: number): Promise<PollResult> {
    const items = await fetchTop100(category)
    const now = Date.now()
    let newCount = 0

    for (const it of items) {
      const exists = this.dal.hasTorrent(it.info_hash)
      this.dal.upsertTorrent(
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
      if (!exists) newCount++
    }

    this.dal.setTopRanks(
      category,
      items.map((i) => i.info_hash)
    )
    this.dal.recordSnapshot(category, items.map((i) => i.info_hash), now)

    const unlinked = this.dal.unlinkedTorrents(1000).length

    return { category, fetched: items.length, newTorrents: newCount, unlinkedCount: unlinked, fetchedAt: now }
  }

  private broadcast(r: PollResult): void {
    for (const fn of this.listeners) fn(r)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('top:updated', r)
    }
  }
}
