import { z } from 'zod'
import { fetchJson } from '../util/http.js'

const ApibayItem = z.object({
  id: z.number(),
  info_hash: z.string(),
  category: z.number(),
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
