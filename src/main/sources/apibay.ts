import { z } from 'zod'
import { fetchJson } from '../util/http.js'

const ApibayItem = z.object({
  id: z.coerce.number(),
  info_hash: z.string(),
  category: z.coerce.number(),
  name: z.string(),
  status: z.string(),
  num_files: z.coerce.number(),
  size: z.coerce.number(),
  seeders: z.coerce.number(),
  leechers: z.coerce.number(),
  username: z.string().nullable().optional(),
  added: z.coerce.number(),
  anon: z.number().optional(),
  imdb: z.string().nullable().optional()
})

const ApibayResponse = z.array(ApibayItem)

export type ApibayTorrent = z.infer<typeof ApibayItem>

// Tracker mix used in every magnet we build. Three classes:
//   - UDP: fastest when the network allows it.
//   - WSS (WebSocket): peers found this way are browser-based WebTorrent
//     clients that speak WebRTC. Critical fallback on networks where ISP /
//     router DPI quietly drops BitTorrent UDP. WebRTC rides over TCP/443.
//   - HTTPS: standard TCP/443 trackers.
// WSS trackers won't find peers for releases that are only seeded by
// traditional BT clients (qBittorrent etc), but they're the only thing that
// works at all on UDP-filtered connections.
const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.dev',
  'https://tracker1.520.jp:443/announce'
]

export function buildMagnet(infoHash: string, name: string): string {
  // `xt=urn:btih:HASH` must be left unencoded — magnet-uri (used by WebTorrent)
  // won't parse the percent-encoded form `urn%3Abtih%3A...`. Only `dn` / `tr`
  // values are percent-encoded.
  const parts = [
    `xt=urn:btih:${infoHash.toLowerCase()}`,
    `dn=${encodeURIComponent(name)}`,
    ...TRACKERS.map((tr) => `tr=${encodeURIComponent(tr)}`)
  ]
  return `magnet:?${parts.join('&')}`
}

export interface FetchOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export async function fetchTop100(category: number, opts: FetchOptions = {}): Promise<ApibayTorrent[]> {
  const url = `https://apibay.org/precompiled/data_top100_${category}.json`
  const json = await fetchJson(url, {
    signal: opts.signal,
    timeoutMs: opts.timeoutMs ?? 15_000,
    retries: 2
  })
  return ApibayResponse.parse(json)
}

export async function searchTorrents(
  query: string,
  category: number | null,
  opts: FetchOptions = {}
): Promise<ApibayTorrent[]> {
  const params = new URLSearchParams({ q: query })
  if (category != null) params.set('cat', String(category))
  const url = `https://apibay.org/q.php?${params.toString()}`
  const json = await fetchJson(url, {
    signal: opts.signal,
    timeoutMs: opts.timeoutMs ?? 20_000,
    retries: 2
  })
  const arr = ApibayResponse.parse(json)
  // apibay returns [{id:'0', name:'No results returned', ...}] when there are zero hits.
  if (arr.length === 1 && arr[0]!.id === 0) return []
  return arr
}
