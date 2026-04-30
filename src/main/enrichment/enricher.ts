import { Dal } from '../db/dal.js'
import { parseTorrentTitle } from './titleParser.js'
import { TmdbClient, type TmdbBasic } from './tmdb.js'

const RETRY_AFTER_MS = 24 * 60 * 60 * 1000 // 24h between retries for unmatched torrents
const SLEEP_BETWEEN_LOOKUPS_MS = 200

export interface EnrichmentResult {
  attempted: number
  linkedToTmdb: number
  linkedFallback: number
  failed: number
}

export class Enricher {
  constructor(
    private readonly dal: Dal,
    private readonly tmdb: TmdbClient | null
  ) {}

  async enrichPending(limit = 100): Promise<EnrichmentResult> {
    const now = Date.now()
    const cutoff = now - RETRY_AFTER_MS
    const torrents = this.dal.torrentsNeedingEnrichment(cutoff, limit)

    const result: EnrichmentResult = { attempted: 0, linkedToTmdb: 0, linkedFallback: 0, failed: 0 }

    for (const t of torrents) {
      result.attempted++
      try {
        const parsed = parseTorrentTitle(t.name)
        let basic: TmdbBasic | null = null

        if (this.tmdb) {
          if (t.imdb && /^tt\d+$/.test(t.imdb)) {
            basic = await this.tmdb.searchByImdbId(t.imdb)
          }
          if (!basic) {
            basic = await this.tmdb.searchByTitle(parsed.cleanTitle, parsed.year)
          }
        }

        if (basic && this.tmdb) {
          // Promote to full details for richer metadata.
          const full = await this.tmdb.details(basic.tmdbId)
          const movieId = this.dal.upsertMovieByTmdbId({
            tmdbId: basic.tmdbId,
            title: full?.title ?? basic.title,
            year: full?.year ?? basic.year,
            posterUrl: full?.posterUrl ?? basic.posterUrl,
            plot: full?.plot ?? basic.plot,
            rating: full?.rating ?? basic.rating,
            runtimeMin: full?.runtimeMin ?? null,
            genres: full?.genres ?? []
          })
          this.dal.linkTorrentToMovie(t.infoHash, movieId)
          this.dal.ensureState(movieId)
          result.linkedToTmdb++
        } else {
          // Fallback: create lightweight movie record from parsed title alone.
          const movieId = this.dal.upsertMovieByTmdbId({
            tmdbId: null,
            title: parsed.cleanTitle,
            year: parsed.year,
            posterUrl: null,
            plot: null,
            rating: null,
            runtimeMin: null,
            genres: []
          })
          this.dal.linkTorrentToMovie(t.infoHash, movieId)
          this.dal.ensureState(movieId)
          result.linkedFallback++
        }
      } catch (err) {
        console.error('[enricher] failed for', t.infoHash, t.name, err)
        result.failed++
      } finally {
        this.dal.markEnrichmentTried(t.infoHash, now)
        if (this.tmdb) await sleep(SLEEP_BETWEEN_LOOKUPS_MS)
      }
    }

    return result
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
