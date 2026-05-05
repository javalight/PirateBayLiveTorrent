// Unified BitTorrent engine surface used by DownloadManager.
// Backed by a managed transmission-daemon child process — same protocol
// libtorrent uses, so tracker/DHT/peer behavior matches mainstream clients.

import { join } from 'node:path'
import { getRpc, startDaemon, stopDaemon } from './transmission-daemon.js'
import type { TransmissionTorrent } from './transmission-rpc.js'

export type TorrentState = 'metaDL' | 'downloading' | 'uploading' | 'paused'

export interface TorrentInfo {
  hash: string
  name: string
  state: TorrentState
  progress: number
  save_path: string
  content_path: string
  size: number
  dlspeed: number
  upspeed: number
  peers: number
}

const stateOf = (t: TransmissionTorrent): TorrentState => {
  // 0=stopped, 1=check-pending, 2=checking, 3=download-pending,
  // 4=downloading, 5=seed-pending, 6=seeding
  if (t.status === 0) return 'paused'
  if (t.status === 5 || t.status === 6) return 'uploading'
  if (t.metadataPercentComplete < 1 && t.totalSize === 0) return 'metaDL'
  return 'downloading'
}

const contentPathOf = (t: TransmissionTorrent): string => {
  if (!t.downloadDir) return ''
  if (t.files.length === 0) return join(t.downloadDir, t.name)
  if (t.files.length === 1) return join(t.downloadDir, t.files[0]!.name)
  // Multi-file torrents: transmission stores all files under a folder named `t.name`.
  return join(t.downloadDir, t.name)
}

const toInfo = (t: TransmissionTorrent): TorrentInfo => ({
  hash: t.hashString.toLowerCase(),
  name: t.name ?? '',
  state: stateOf(t),
  progress: t.percentDone ?? 0,
  save_path: t.downloadDir ?? '',
  content_path: contentPathOf(t),
  size: t.totalSize ?? 0,
  dlspeed: t.rateDownload ?? 0,
  upspeed: t.rateUpload ?? 0,
  peers: t.peersConnected ?? 0
})

export const torrentEngine = {
  /** Eagerly start the daemon. Safe to call multiple times. */
  async start(): Promise<void> {
    await startDaemon()
  },

  /** Add a magnet (idempotent — duplicates are accepted as success). */
  async addMagnet(
    magnet: string,
    _infoHash: string,
    savePath: string,
    _opts?: unknown
  ): Promise<void> {
    void _infoHash
    void _opts
    const rpc = await getRpc()
    const t = await rpc.addMagnet(magnet, savePath)
    const hash = t.hashString.toLowerCase()
    // Verify pieces against any local files in the download dir so a
    // previously-completed (or partially completed) torrent comes back at
    // its true progress instead of restarting from 0% after the daemon
    // lost its resume state (e.g. after a SIGKILL last session).
    await rpc.verify([hash])
    // Ensure the torrent is active.
    await rpc.start([hash])
  },

  async remove(infoHash: string, deleteFiles: boolean): Promise<void> {
    const rpc = await getRpc()
    await rpc.remove([infoHash.toLowerCase()], deleteFiles)
  },

  async info(hashes: string[]): Promise<TorrentInfo[]> {
    if (hashes.length === 0) return []
    const rpc = await getRpc()
    const torrents = await rpc.info(hashes.map((h) => h.toLowerCase()))
    return torrents.map(toInfo)
  },

  async get(infoHash: string): Promise<TorrentInfo | null> {
    const list = await this.info([infoHash])
    return list[0] ?? null
  },

  /** Force a fresh tracker announce + DHT lookup. */
  async reannounce(infoHash: string): Promise<boolean> {
    const rpc = await getRpc()
    await rpc.reannounce([infoHash.toLowerCase()])
    return true
  },

  /** Stop the daemon child process (called on app quit). Waits for the
   *  daemon to actually exit so its `.resume` files are flushed. */
  async destroy(): Promise<void> {
    await stopDaemon()
  }
}

export const isComplete = (info: TorrentInfo): boolean =>
  info.state === 'uploading' || info.progress >= 1
