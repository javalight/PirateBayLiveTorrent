import { z } from 'zod'
import { fetchJson } from '../util/http.js'

const ApibayItem = z.object({
  id: z.coerce.number(),
  info_hash: z.string(),
  category: z.coerce.number(),
  name: z.string(),
  status: z.string(),
  num_files: z.number(),
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

// Public trackers used by TPB / apibay magnets.
const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce'
]

export function buildMagnet(infoHash: string, name: string): string {
  const params = new URLSearchParams()
  params.set('xt', `urn:btih:${infoHash.toLowerCase()}`)
  params.set('dn', name)
  for (const tr of TRACKERS) params.append('tr', tr)
  return `magnet:?${params.toString()}`
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
