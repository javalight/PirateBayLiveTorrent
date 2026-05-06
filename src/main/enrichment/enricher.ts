import { Dal } from '../db/dal.js'
import { lookupMovie, type WikipediaMovie } from './wikipedia.js'
import type { Movie } from '../../shared/types.js'

/**
 * On-demand single-movie enrichment via Wikipedia. The renderer triggers
 * this when a card scrolls into view, so we never speculatively look up
 * movies the user never sees. Concurrent calls for the same movie are
 * deduplicated.
 */
export class Enricher {
  private inflight = new Map<number, Promise<Movie | null>>()

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
    if (movie.posterUrl) return movie // already enriched

    let result: WikipediaMovie | null
    try {
      result = await lookupMovie(movie.title, movie.year)
    } catch (err) {
      console.warn(`[enricher] lookup failed for "${movie.title}":`, err)
      return movie
    }
    if (!result) return movie

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
}
