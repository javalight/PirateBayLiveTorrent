// Free metadata + poster lookup via Wikipedia. No API key, no signup.
// Two-step: full-text search → REST page summary.

const SEARCH_URL = 'https://en.wikipedia.org/w/api.php'
const SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
const UA = 'PirateBayLiveTorrent/0.1 (https://github.com/javalight/PirateBayLiveTorrent)'

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

/**
 * Look up a movie on Wikipedia. Tries `<title> <year> film` then `<title> film`.
 * Returns null if no acceptable match (or no poster image).
 */
export async function lookupMovie(
  title: string,
  year: number | null
): Promise<WikipediaMovie | null> {
  const queries = year ? [`${title} ${year} film`, `${title} film`] : [`${title} film`]

  for (const q of queries) {
    const pageTitle = await searchTitle(q)
    if (!pageTitle) continue
    const summary = await fetchSummary(pageTitle)
    if (!summary) continue
    if (summary.type === 'disambiguation') continue
    const poster = summary.originalimage?.source ?? summary.thumbnail?.source ?? null
    if (!poster) continue

    return {
      title: summary.title ?? pageTitle,
      year: yearFromDescription(summary.description) ?? year,
      posterUrl: poster,
      plot: summary.extract ?? null
    }
  }
  return null
}
