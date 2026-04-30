import { parse } from 'parse-torrent-title'

export interface ParsedTitle {
  cleanTitle: string
  year: number | null
  resolution: string | null
}

export function parseTorrentTitle(name: string): ParsedTitle {
  const r = parse(name)
  return {
    cleanTitle: (r.title || name).trim(),
    year: r.year ?? null,
    resolution: r.resolution ?? null
  }
}
