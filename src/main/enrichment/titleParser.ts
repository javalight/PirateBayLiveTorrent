import { parse } from 'parse-torrent-title'

export interface ParsedTitle {
  cleanTitle: string
  year: number | null
  resolution: string | null
}

const stripBracketTags = (s: string): string =>
  s
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\.+/g, ' ')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function parseTorrentTitle(name: string): ParsedTitle {
  const r = parse(name)
  const ptt = (r.title || '').trim()
  const stripped = stripBracketTags(name)
  // parse-torrent-title eagerly strips season/episode tokens like `S4`,
  // which destroys real titles such as "S4: The Bob Lazar Story". If
  // the PTT result is much shorter than the raw bracket-stripped name,
  // prefer the raw — it's more likely the user-recognizable title.
  const cleanTitle = ptt && ptt.length >= stripped.length * 0.6 ? ptt : stripped || ptt || name
  return {
    cleanTitle,
    year: r.year ?? null,
    resolution: r.resolution ?? null
  }
}
