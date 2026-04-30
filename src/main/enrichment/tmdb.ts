import { z } from 'zod'
import { fetchJson, HttpError } from '../util/http.js'

const SearchResultSchema = z.object({
  id: z.number(),
  title: z.string(),
  release_date: z.string().optional().nullable(),
  poster_path: z.string().optional().nullable(),
  overview: z.string().optional().nullable(),
  vote_average: z.number().optional().nullable()
})

const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema)
})

const FindResponseSchema = z.object({
  movie_results: z.array(SearchResultSchema)
})

const DetailsSchema = z.object({
  id: z.number(),
  title: z.string(),
  release_date: z.string().optional().nullable(),
  poster_path: z.string().optional().nullable(),
  overview: z.string().optional().nullable(),
  vote_average: z.number().optional().nullable(),
  runtime: z.number().optional().nullable(),
  genres: z.array(z.object({ id: z.number(), name: z.string() }))
})

export interface TmdbBasic {
  tmdbId: number
  title: string
  year: number | null
  posterUrl: string | null
  plot: string | null
  rating: number | null
}

export interface TmdbFull extends TmdbBasic {
  runtimeMin: number | null
  genres: string[]
}

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500'
const API_BASE = 'https://api.themoviedb.org/3'

const yearFromReleaseDate = (s: string | null | undefined): number | null => {
  if (!s) return null
  const y = parseInt(s.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

const posterUrl = (path: string | null | undefined): string | null =>
  path ? `${POSTER_BASE}${path}` : null

export class TmdbClient {
  constructor(private readonly apiKey: string) {}

  async searchByImdbId(imdbId: string): Promise<TmdbBasic | null> {
    try {
      const json = await fetchJson(`${API_BASE}/find/${imdbId}`, {
        searchParams: { api_key: this.apiKey, external_source: 'imdb_id' }
      })
      const parsed = FindResponseSchema.parse(json)
      const m = parsed.movie_results[0]
      if (!m) return null
      return {
        tmdbId: m.id,
        title: m.title,
        year: yearFromReleaseDate(m.release_date),
        posterUrl: posterUrl(m.poster_path),
        plot: m.overview ?? null,
        rating: m.vote_average ?? null
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null
      throw err
    }
  }

  async searchByTitle(title: string, year: number | null): Promise<TmdbBasic | null> {
    const params: Record<string, string> = { api_key: this.apiKey, query: title }
    if (year != null) params.year = String(year)
    const json = await fetchJson(`${API_BASE}/search/movie`, { searchParams: params })
    const parsed = SearchResponseSchema.parse(json)
    const m = parsed.results[0]
    if (!m) return null
    return {
      tmdbId: m.id,
      title: m.title,
      year: yearFromReleaseDate(m.release_date),
      posterUrl: posterUrl(m.poster_path),
      plot: m.overview ?? null,
      rating: m.vote_average ?? null
    }
  }

  async details(tmdbId: number): Promise<TmdbFull | null> {
    try {
      const json = await fetchJson(`${API_BASE}/movie/${tmdbId}`, {
        searchParams: { api_key: this.apiKey }
      })
      const d = DetailsSchema.parse(json)
      return {
        tmdbId: d.id,
        title: d.title,
        year: yearFromReleaseDate(d.release_date),
        posterUrl: posterUrl(d.poster_path),
        plot: d.overview ?? null,
        rating: d.vote_average ?? null,
        runtimeMin: d.runtime ?? null,
        genres: d.genres.map((g) => g.name)
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null
      throw err
    }
  }
}
