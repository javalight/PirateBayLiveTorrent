import { BrowserWindow } from 'electron'
import { Dal } from '../db/dal.js'
import type { Topic } from '../../shared/types.js'
import { buildMagnet, fetchTop100, searchTorrents } from './apibay.js'

export interface PollerOptions {
  intervalMs: number
}

export interface PollResult {
  topicId: number
  topicName: string
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
      const topics = this.dal.listTopics()
      for (const topic of topics) {
        try {
          const r = await this.refreshTopic(topic)
          results.push(r)
          this.broadcast(r)
        } catch (err) {
          console.error(`[poller] topic "${topic.name}" failed:`, err)
        }
      }
      return results
    } finally {
      this.running = false
    }
  }

  /** Refresh a specific topic on demand (e.g. when user clicks Refresh). */
  async refreshOne(topicId: number): Promise<PollResult | null> {
    const topic = this.dal.topicById(topicId)
    if (!topic || topic.archivedAt != null) return null
    const r = await this.refreshTopic(topic)
    this.broadcast(r)
    return r
  }

  private async refreshTopic(topic: Topic): Promise<PollResult> {
    const items =
      topic.sourceKind === 'top100'
        ? await fetchTop100(parseInt(topic.sourceParam, 10))
        : await searchTorrents(topic.sourceParam, topic.sourceCategory)

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

    this.dal.setTopicTorrents(
      topic.id,
      items.map((i) => i.info_hash)
    )
    this.dal.recordSnapshot(
      topic.sourceCategory ?? 0,
      items.map((i) => i.info_hash),
      now
    )

    const unlinked = this.dal.unlinkedTorrents(1000).length
    return {
      topicId: topic.id,
      topicName: topic.name,
      fetched: items.length,
      newTorrents: newCount,
      unlinkedCount: unlinked,
      fetchedAt: now
    }
  }

  private broadcast(r: PollResult): void {
    for (const fn of this.listeners) fn(r)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('top:updated', r)
    }
  }
}
