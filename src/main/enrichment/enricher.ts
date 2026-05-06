import { Dal } from '../db/dal.js'
import { lookupMovie, type MediaKind, type WikipediaMovie } from './wikipedia.js'
import type { Movie } from '../../shared/types.js'

/**
 * On-demand single-movie enrichment via Wikipedia. The renderer triggers
 * this when a card scrolls into view, so we never speculatively look up
 * movies the user never sees. Concurrent calls for the same movie are
 * deduplicated.
 */
export class Enricher {
  private inflight = new Map<number, Promise<Movie | null>>()
  /** Movies whose Wikipedia lookup returned nothing this session. We
   * don't persist this (Wikipedia adds articles over time, and a torrent's
   * stored title may improve), but within a session we don't keep retrying
   * the same dead-end lookup every scroll. */
  private nothingFound = new Set<number>()

  constructor(private readonly dal: Dal) {}

  enrichOne(movieId: number): Promise<Movie | null> {
    const existing = this.inflight.get(movieId)
    if (existing) return existing
    const p = this.doEnrich(movieId).finally(() => this.inflight.delete(movieId))
    this.inflight.set(movieId, p)
    return p
  }

  private async doEnrich(movieId: number): Promise<Movie | null> {
    const movie = this.dal.movieById(movieId)
    if (!movie) return null
    // Persistent "already tried successfully" signal: if we have a plot
    // OR a poster, we're done. Plot text comes from any Wikipedia hit,
    // even one without an image, so this catches text-only enrichments
    // and prevents repeated re-fetches across restarts.
    if (movie.posterUrl || movie.plot) return movie
    if (this.nothingFound.has(movieId)) return movie

    const kind = this.inferKind(movieId)

    let result: WikipediaMovie | null
    try {
      result = await lookupMovie(movie.title, movie.year, kind)
    } catch (err) {
      console.warn(`[enricher] lookup failed for "${movie.title}":`, err)
      return movie
    }
    if (!result) {
      this.nothingFound.add(movieId)
      return movie
    }

    this.dal.updateMovieMeta(movieId, {
      tmdbId: movie.tmdbId,
      title: result.title || movie.title,
      year: result.year ?? movie.year,
      posterUrl: result.posterUrl,
      plot: result.plot ?? movie.plot,
      rating: movie.rating,
      runtimeMin: movie.runtimeMin,
      genres: movie.genres
    })
    return this.dal.movieById(movieId)
  }

  /** Infer media kind from the apibay categories of this movie's torrents.
   * 200/207 = movies, 205/208 = TV, 4xx = games. If torrents disagree
   * (e.g. multiple categories), the most common one wins; ties go to
   * film as the safest default. */
  private inferKind(movieId: number): MediaKind | null {
    const torrents = this.dal.torrentsForMovie(movieId)
    if (torrents.length === 0) return null
    const counts: Record<MediaKind, number> = { film: 0, tv: 0, game: 0 }
    for (const t of torrents) {
      const k = kindFromCategory(t.category)
      if (k) counts[k]++
    }
    const best = (Object.entries(counts) as Array<[MediaKind, number]>)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])[0]
    return best ? best[0] : 'film'
  }
}

const kindFromCategory = (cat: number): MediaKind | null => {
  if (cat === 205 || cat === 208) return 'tv'
  if (cat >= 400 && cat < 500) return 'game'
  if (cat >= 200 && cat < 300) return 'film'
  return null
}
