// Free metadata + poster lookup via Wikipedia. No API key, no signup.
// Two-step: full-text search → REST page summary.

const SEARCH_URL = 'https://en.wikipedia.org/w/api.php'
const SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
const UA = 'PirateBayLiveTorrent/0.1 (https://github.com/javalight/PirateBayLiveTorrent)'

export type MediaKind = 'film' | 'tv' | 'game'

export interface WikipediaMovie {
  title: string
  year: number | null
  posterUrl: string | null
  plot: string | null
}

interface SearchResp {
  query?: { search?: Array<{ title: string }> }
}

interface SummaryResp {
  title?: string
  extract?: string
  description?: string
  type?: string
  thumbnail?: { source?: string }
  originalimage?: { source?: string }
}

const fetchJson = async <T>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' }
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

const searchTitle = async (query: string): Promise<string | null> => {
  const url = new URL(SEARCH_URL)
  url.searchParams.set('action', 'query')
  url.searchParams.set('list', 'search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('srlimit', '1')
  url.searchParams.set('srprop', '')
  url.searchParams.set('srsearch', query)
  const data = await fetchJson<SearchResp>(url.toString())
  return data?.query?.search?.[0]?.title ?? null
}

const fetchSummary = async (pageTitle: string): Promise<SummaryResp | null> => {
  const slug = encodeURIComponent(pageTitle.replace(/ /g, '_'))
  return fetchJson<SummaryResp>(SUMMARY_URL + slug)
}

const yearFromDescription = (desc: string | null | undefined): number | null => {
  if (!desc) return null
  const m = /\b(19|20)\d{2}\b/.exec(desc)
  return m ? parseInt(m[0], 10) : null
}

// Strip release-group / platform / encoding tags that often leak into
// the stored movie title (e.g. "Left 4 Dead 2 [CX2] [MAC]"). Wikipedia
// search tolerates extra words, but bracketed cruft pulls it off-target.
const stripSearchNoise = (title: string): string =>
  title
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(720p|1080p|2160p|4k|x264|x265|hevc|bluray|web[- ]?dl|webrip|hdrip|dvdrip|mac|win|linux)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const SUFFIXES_BY_KIND: Record<MediaKind, string[]> = {
  film: ['film', 'movie', 'documentary'],
  tv: ['TV series', 'TV show', 'television series', 'miniseries'],
  game: ['video game', 'game']
}

const KIND_DESCRIPTORS: Record<MediaKind, RegExp> = {
  film: /\b(film|movie|documentary|anime film)\b/i,
  tv: /\b(tv series|television series|tv show|miniseries|anime|web series)\b/i,
  game: /\b(video game|game series|game)\b/i
}

const MEDIA_DESCRIPTOR =
  /\b(film|movie|documentary|tv series|television series|tv show|miniseries|anime|web series|video game|game series)\b/i

const isAcceptablePage = (s: SummaryResp, kind: MediaKind | null): boolean => {
  if (s.type === 'disambiguation') return false
  const desc = s.description ?? ''
  // If we know the kind, prefer pages whose description matches; if the
  // description is empty or generic, fall through and accept (Wikipedia
  // descriptions are sometimes terse).
  if (kind && desc) {
    if (KIND_DESCRIPTORS[kind].test(desc)) return true
    // Reject obviously-wrong matches when we have a strong signal.
    if (MEDIA_DESCRIPTOR.test(desc)) return false
    return true
  }
  return true
}

/**
 * Look up a media entry on Wikipedia. Tries kind-appropriate suffixes
 * first ("Title KIND film", "Title film", …), then falls back to the
 * bare title. Returns the first non-disambiguation, kind-matching page,
 * even if it has no poster image — the plot text alone is useful and
 * acts as our persistent "already-enriched" signal.
 */
export async function lookupMovie(
  title: string,
  year: number | null,
  kind: MediaKind | null = 'film'
): Promise<WikipediaMovie | null> {
  const base = stripSearchNoise(title) || title
  const suffixes = kind ? SUFFIXES_BY_KIND[kind] : ['film', 'TV series', 'video game']
  const queries: string[] = []
  if (year) {
    for (const sfx of suffixes) queries.push(`${base} ${year} ${sfx}`)
    queries.push(`${base} ${year}`)
  }
  for (const sfx of suffixes) queries.push(`${base} ${sfx}`)
  queries.push(base)

  for (const q of queries) {
    const pageTitle = await searchTitle(q)
    if (!pageTitle) continue
    const summary = await fetchSummary(pageTitle)
    if (!summary) continue
    if (!isAcceptablePage(summary, kind)) continue

    return {
      title: summary.title ?? pageTitle,
      year: yearFromDescription(summary.description) ?? year,
      posterUrl: summary.originalimage?.source ?? summary.thumbnail?.source ?? null,
      plot: summary.extract ?? null
    }
  }
  return null
}
