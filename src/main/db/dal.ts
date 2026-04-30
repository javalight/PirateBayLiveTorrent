import type Database from 'better-sqlite3'
import type { Movie, MovieState, MovieStatus, Torrent } from '../../shared/types.js'

interface TorrentRow {
  info_hash: string
  name: string
  category: number
  size_bytes: number | null
  seeders: number
  leechers: number
  magnet: string
  movie_id: number | null
  imdb: string | null
  enrichment_tried_at: number | null
  first_seen_at: number
  last_seen_at: number
  current_rank: number | null
}

interface MovieRow {
  id: number
  tmdb_id: number | null
  title: string
  year: number | null
  poster_url: string | null
  plot: string | null
  rating: number | null
  runtime_min: number | null
  genres_json: string
}

interface MovieStateRow {
  movie_id: number
  status: MovieStatus
  file_path: string | null
  qbit_hash: string | null
  downloaded_at: number | null
  seen_at: number | null
}

const torrentFromRow = (r: TorrentRow): Torrent => ({
  infoHash: r.info_hash,
  name: r.name,
  category: r.category,
  sizeBytes: r.size_bytes,
  seeders: r.seeders,
  leechers: r.leechers,
  magnet: r.magnet,
  movieId: r.movie_id,
  imdb: r.imdb,
  enrichmentTriedAt: r.enrichment_tried_at,
  firstSeenAt: r.first_seen_at,
  lastSeenAt: r.last_seen_at,
  currentRank: r.current_rank
})

const movieFromRow = (r: MovieRow): Movie => ({
  id: r.id,
  tmdbId: r.tmdb_id,
  title: r.title,
  year: r.year,
  posterUrl: r.poster_url,
  plot: r.plot,
  rating: r.rating,
  runtimeMin: r.runtime_min,
  genres: JSON.parse(r.genres_json) as string[]
})

const stateFromRow = (r: MovieStateRow): MovieState => ({
  movieId: r.movie_id,
  status: r.status,
  filePath: r.file_path,
  qbitHash: r.qbit_hash,
  downloadedAt: r.downloaded_at,
  seenAt: r.seen_at
})

export interface UpsertTorrentInput {
  infoHash: string
  name: string
  category: number
  sizeBytes: number | null
  seeders: number
  leechers: number
  magnet: string
  imdb: string | null
}

export class Dal {
  constructor(private readonly db: Database.Database) {}

  // -- torrents --------------------------------------------------------------

  hasTorrent(infoHash: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM torrents WHERE info_hash = ?').get(infoHash)
  }

  upsertTorrent(input: UpsertTorrentInput, now: number): void {
    this.db
      .prepare(
        `INSERT INTO torrents (info_hash, name, category, size_bytes, seeders, leechers, magnet, imdb, first_seen_at, last_seen_at)
         VALUES (@infoHash, @name, @category, @sizeBytes, @seeders, @leechers, @magnet, @imdb, @now, @now)
         ON CONFLICT(info_hash) DO UPDATE SET
           name = excluded.name,
           seeders = excluded.seeders,
           leechers = excluded.leechers,
           imdb = COALESCE(excluded.imdb, torrents.imdb),
           last_seen_at = excluded.last_seen_at`
      )
      .run({ ...input, now })
  }

  markEnrichmentTried(infoHash: string, now: number): void {
    this.db.prepare('UPDATE torrents SET enrichment_tried_at = ? WHERE info_hash = ?').run(now, infoHash)
  }

  setTopRanks(category: number, hashesInOrder: string[]): void {
    const tx = this.db.transaction(() => {
      this.db
        .prepare('UPDATE torrents SET current_rank = NULL WHERE category = ? AND current_rank IS NOT NULL')
        .run(category)
      const upd = this.db.prepare('UPDATE torrents SET current_rank = ? WHERE info_hash = ?')
      hashesInOrder.forEach((h, i) => upd.run(i + 1, h))
    })
    tx()
  }

  linkTorrentToMovie(infoHash: string, movieId: number): void {
    this.db.prepare('UPDATE torrents SET movie_id = ? WHERE info_hash = ?').run(movieId, infoHash)
  }

  torrentsForMovie(movieId: number): Torrent[] {
    const rows = this.db
      .prepare('SELECT * FROM torrents WHERE movie_id = ? ORDER BY seeders DESC')
      .all(movieId) as TorrentRow[]
    return rows.map(torrentFromRow)
  }

  unlinkedTorrents(limit = 50): Torrent[] {
    const rows = this.db
      .prepare('SELECT * FROM torrents WHERE movie_id IS NULL ORDER BY current_rank ASC NULLS LAST LIMIT ?')
      .all(limit) as TorrentRow[]
    return rows.map(torrentFromRow)
  }

  /** Torrents that need enrichment: no movie linked AND we haven't tried recently. */
  torrentsNeedingEnrichment(retryAfter: number, limit = 50): Torrent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM torrents
         WHERE movie_id IS NULL
           AND (enrichment_tried_at IS NULL OR enrichment_tried_at < ?)
         ORDER BY current_rank ASC NULLS LAST
         LIMIT ?`
      )
      .all(retryAfter, limit) as TorrentRow[]
    return rows.map(torrentFromRow)
  }

  // -- movies ----------------------------------------------------------------

  upsertMovieByTmdbId(m: Omit<Movie, 'id'>): number {
    if (m.tmdbId == null) {
      const info = this.db
        .prepare(
          `INSERT INTO movies (title, year, poster_url, plot, rating, runtime_min, genres_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(m.title, m.year, m.posterUrl, m.plot, m.rating, m.runtimeMin, JSON.stringify(m.genres))
      return Number(info.lastInsertRowid)
    }

    const existing = this.db
      .prepare('SELECT id FROM movies WHERE tmdb_id = ?')
      .get(m.tmdbId) as { id: number } | undefined

    if (existing) {
      this.db
        .prepare(
          `UPDATE movies SET title=?, year=?, poster_url=?, plot=?, rating=?, runtime_min=?, genres_json=?
           WHERE id=?`
        )
        .run(m.title, m.year, m.posterUrl, m.plot, m.rating, m.runtimeMin, JSON.stringify(m.genres), existing.id)
      return existing.id
    }

    const info = this.db
      .prepare(
        `INSERT INTO movies (tmdb_id, title, year, poster_url, plot, rating, runtime_min, genres_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(m.tmdbId, m.title, m.year, m.posterUrl, m.plot, m.rating, m.runtimeMin, JSON.stringify(m.genres))
    return Number(info.lastInsertRowid)
  }

  movieById(id: number): Movie | null {
    const r = this.db.prepare('SELECT * FROM movies WHERE id = ?').get(id) as MovieRow | undefined
    return r ? movieFromRow(r) : null
  }

  // -- state -----------------------------------------------------------------

  ensureState(movieId: number): MovieState {
    const existing = this.db
      .prepare('SELECT * FROM movie_state WHERE movie_id = ?')
      .get(movieId) as MovieStateRow | undefined
    if (existing) return stateFromRow(existing)

    this.db
      .prepare('INSERT INTO movie_state (movie_id, status) VALUES (?, ?)')
      .run(movieId, 'unseen')
    return {
      movieId,
      status: 'unseen',
      filePath: null,
      qbitHash: null,
      downloadedAt: null,
      seenAt: null
    }
  }

  setStatus(
    movieId: number,
    status: MovieStatus,
    extras?: Partial<Pick<MovieState, 'filePath' | 'qbitHash' | 'downloadedAt' | 'seenAt'>>
  ): void {
    this.ensureState(movieId)
    const fields: string[] = ['status = ?']
    const values: unknown[] = [status]
    if (extras?.filePath !== undefined) {
      fields.push('file_path = ?')
      values.push(extras.filePath)
    }
    if (extras?.qbitHash !== undefined) {
      fields.push('qbit_hash = ?')
      values.push(extras.qbitHash)
    }
    if (extras?.downloadedAt !== undefined) {
      fields.push('downloaded_at = ?')
      values.push(extras.downloadedAt)
    }
    if (extras?.seenAt !== undefined) {
      fields.push('seen_at = ?')
      values.push(extras.seenAt)
    }
    values.push(movieId)
    this.db.prepare(`UPDATE movie_state SET ${fields.join(', ')} WHERE movie_id = ?`).run(...values)
  }

  activeDownloadHashes(): string[] {
    const rows = this.db
      .prepare("SELECT qbit_hash FROM movie_state WHERE status = 'downloading' AND qbit_hash IS NOT NULL")
      .all() as Array<{ qbit_hash: string }>
    return rows.map((r) => r.qbit_hash.toLowerCase())
  }

  movieIdByQbitHash(hash: string): number | null {
    const r = this.db
      .prepare('SELECT movie_id FROM movie_state WHERE qbit_hash = ?')
      .get(hash.toLowerCase()) as { movie_id: number } | undefined
    return r?.movie_id ?? null
  }

  // -- snapshots -------------------------------------------------------------

  recordSnapshot(category: number, hashes: string[], now: number): void {
    this.db
      .prepare('INSERT INTO top_snapshots (category, fetched_at, hashes_json) VALUES (?, ?, ?)')
      .run(category, now, JSON.stringify(hashes))
  }

  // -- combined views --------------------------------------------------------

  /**
   * Movies that match arbitrary status filters and have at least one linked torrent.
   * `inTopOnly` restricts to movies with at least one torrent currently in a Top 100.
   * Used by the Unseen / Seen / Library views.
   */
  filterMovies(opts: {
    statuses?: MovieStatus[]
    inTopOnly?: boolean
    excludeStatuses?: MovieStatus[]
    sort?: 'rank' | 'seen_at' | 'downloaded_at' | 'title'
  }): Array<{ movie: Movie; state: MovieState; bestTorrent: Torrent | null; rank: number | null }> {
    const conds: string[] = []
    const params: unknown[] = []

    if (opts.inTopOnly) {
      conds.push(`EXISTS (SELECT 1 FROM torrents t2 WHERE t2.movie_id = m.id AND t2.current_rank IS NOT NULL)`)
    }

    if (opts.statuses && opts.statuses.length > 0) {
      const placeholders = opts.statuses.map(() => '?').join(',')
      conds.push(`COALESCE(ms.status, 'unseen') IN (${placeholders})`)
      params.push(...opts.statuses)
    }

    if (opts.excludeStatuses && opts.excludeStatuses.length > 0) {
      const placeholders = opts.excludeStatuses.map(() => '?').join(',')
      conds.push(`COALESCE(ms.status, 'unseen') NOT IN (${placeholders})`)
      params.push(...opts.excludeStatuses)
    }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''

    let orderBy = 'm.title COLLATE NOCASE ASC'
    if (opts.sort === 'rank') orderBy = '(SELECT MIN(current_rank) FROM torrents WHERE movie_id = m.id) ASC NULLS LAST'
    else if (opts.sort === 'seen_at') orderBy = 'ms.seen_at DESC'
    else if (opts.sort === 'downloaded_at') orderBy = 'ms.downloaded_at DESC'

    const rows = this.db
      .prepare(
        `SELECT m.*,
                COALESCE(ms.status, 'unseen') AS s_status,
                ms.file_path AS s_file_path,
                ms.qbit_hash AS s_qbit_hash,
                ms.downloaded_at AS s_downloaded_at,
                ms.seen_at AS s_seen_at,
                (SELECT MIN(current_rank) FROM torrents WHERE movie_id = m.id AND current_rank IS NOT NULL) AS rank
         FROM movies m
         LEFT JOIN movie_state ms ON ms.movie_id = m.id
         ${where}
         ORDER BY ${orderBy}`
      )
      .all(...params) as Array<MovieRow & {
        s_status: MovieStatus
        s_file_path: string | null
        s_qbit_hash: string | null
        s_downloaded_at: number | null
        s_seen_at: number | null
        rank: number | null
      }>

    return rows.map((r) => {
      const movie = movieFromRow(r)
      const state: MovieState = {
        movieId: r.id,
        status: r.s_status,
        filePath: r.s_file_path,
        qbitHash: r.s_qbit_hash,
        downloadedAt: r.s_downloaded_at,
        seenAt: r.s_seen_at
      }
      const torrents = this.torrentsForMovie(r.id)
      const bestTorrent = torrents[0] ?? null
      return { movie, state, bestTorrent, rank: r.rank }
    })
  }

  /**
   * Movies currently in the Top 100 of the given category, with their state
   * and the top-seeded torrent for each.
   */
  topMovies(category: number): Array<{ movie: Movie; state: MovieState; bestTorrent: Torrent; rank: number }> {
    const rows = this.db
      .prepare(
        `SELECT t.*, m.id AS m_id, m.tmdb_id AS m_tmdb_id, m.title AS m_title, m.year AS m_year,
                m.poster_url AS m_poster_url, m.plot AS m_plot, m.rating AS m_rating,
                m.runtime_min AS m_runtime_min, m.genres_json AS m_genres_json,
                ms.status AS s_status, ms.file_path AS s_file_path, ms.qbit_hash AS s_qbit_hash,
                ms.downloaded_at AS s_downloaded_at, ms.seen_at AS s_seen_at
         FROM torrents t
         LEFT JOIN movies m ON m.id = t.movie_id
         LEFT JOIN movie_state ms ON ms.movie_id = m.id
         WHERE t.category = ? AND t.current_rank IS NOT NULL
         ORDER BY t.current_rank ASC`
      )
      .all(category) as Array<TorrentRow & {
        m_id: number | null
        m_tmdb_id: number | null
        m_title: string | null
        m_year: number | null
        m_poster_url: string | null
        m_plot: string | null
        m_rating: number | null
        m_runtime_min: number | null
        m_genres_json: string | null
        s_status: MovieStatus | null
        s_file_path: string | null
        s_qbit_hash: string | null
        s_downloaded_at: number | null
        s_seen_at: number | null
      }>

    return rows
      .filter((r) => r.m_id !== null)
      .map((r) => ({
        rank: r.current_rank!,
        bestTorrent: torrentFromRow(r),
        movie: {
          id: r.m_id!,
          tmdbId: r.m_tmdb_id,
          title: r.m_title!,
          year: r.m_year,
          posterUrl: r.m_poster_url,
          plot: r.m_plot,
          rating: r.m_rating,
          runtimeMin: r.m_runtime_min,
          genres: JSON.parse(r.m_genres_json ?? '[]') as string[]
        },
        state: {
          movieId: r.m_id!,
          status: r.s_status ?? 'unseen',
          filePath: r.s_file_path,
          qbitHash: r.s_qbit_hash,
          downloadedAt: r.s_downloaded_at,
          seenAt: r.s_seen_at
        }
      }))
  }
}
