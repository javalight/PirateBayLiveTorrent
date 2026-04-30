import type Database from 'better-sqlite3'
import type {
  Movie,
  MovieState,
  MovieStatus,
  Topic,
  TopicSourceKind,
  TopicStats,
  Torrent
} from '../../shared/types.js'

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
  favorite: number
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
  seenAt: r.seen_at,
  favorite: r.favorite === 1
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

interface TopicRow {
  id: number
  name: string
  icon: string | null
  source_kind: TopicSourceKind
  source_param: string
  source_category: number | null
  created_at: number
  archived_at: number | null
}

const topicFromRow = (r: TopicRow): Topic => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  sourceKind: r.source_kind,
  sourceParam: r.source_param,
  sourceCategory: r.source_category,
  createdAt: r.created_at,
  archivedAt: r.archived_at
})

export interface CreateTopicInput {
  name: string
  icon?: string | null
  sourceKind: TopicSourceKind
  sourceParam: string
  sourceCategory?: number | null
}

export class Dal {
  constructor(private readonly db: Database.Database) {}

  // -- topics ----------------------------------------------------------------

  listTopics(includeArchived = false): Topic[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM topics ${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY id ASC`
      )
      .all() as TopicRow[]
    return rows.map(topicFromRow)
  }

  topicById(id: number): Topic | null {
    const r = this.db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as TopicRow | undefined
    return r ? topicFromRow(r) : null
  }

  createTopic(input: CreateTopicInput): Topic {
    const info = this.db
      .prepare(
        `INSERT INTO topics (name, icon, source_kind, source_param, source_category, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.name,
        input.icon ?? null,
        input.sourceKind,
        input.sourceParam,
        input.sourceCategory ?? null,
        Date.now()
      )
    return this.topicById(Number(info.lastInsertRowid))!
  }

  archiveTopic(id: number): void {
    this.db.prepare('UPDATE topics SET archived_at = ? WHERE id = ?').run(Date.now(), id)
  }

  topicStats(topic: Topic): TopicStats {
    const total = (
      this.db.prepare('SELECT COUNT(DISTINCT t.movie_id) AS n FROM topic_torrents tt JOIN torrents t ON t.info_hash = tt.info_hash WHERE tt.topic_id = ? AND t.movie_id IS NOT NULL').get(topic.id) as { n: number }
    ).n
    const inTop = (
      this.db.prepare('SELECT COUNT(DISTINCT t.movie_id) AS n FROM topic_torrents tt JOIN torrents t ON t.info_hash = tt.info_hash WHERE tt.topic_id = ? AND tt.rank IS NOT NULL AND t.movie_id IS NOT NULL').get(topic.id) as { n: number }
    ).n
    const unseen = (
      this.db.prepare(
        `SELECT COUNT(DISTINCT t.movie_id) AS n
         FROM topic_torrents tt
         JOIN torrents t ON t.info_hash = tt.info_hash
         LEFT JOIN movie_state ms ON ms.movie_id = t.movie_id
         WHERE tt.topic_id = ? AND t.movie_id IS NOT NULL
           AND COALESCE(ms.status, 'unseen') = 'unseen'`
      ).get(topic.id) as { n: number }
    ).n
    const seen = (
      this.db.prepare(
        `SELECT COUNT(DISTINCT t.movie_id) AS n
         FROM topic_torrents tt
         JOIN torrents t ON t.info_hash = tt.info_hash
         JOIN movie_state ms ON ms.movie_id = t.movie_id
         WHERE tt.topic_id = ? AND ms.status IN ('seen','downloaded')`
      ).get(topic.id) as { n: number }
    ).n
    const favorites = (
      this.db.prepare(
        `SELECT COUNT(DISTINCT t.movie_id) AS n
         FROM topic_torrents tt
         JOIN torrents t ON t.info_hash = tt.info_hash
         JOIN movie_state ms ON ms.movie_id = t.movie_id
         WHERE tt.topic_id = ? AND ms.favorite = 1`
      ).get(topic.id) as { n: number }
    ).n
    return { topic, totalMovies: total, inTopNow: inTop, unseen, seen, favorites }
  }

  /** Bulk update a topic's torrent membership and ranks. Hashes not in the new
   *  list have their rank cleared but stay in the table so we keep history. */
  setTopicTorrents(topicId: number, hashesInOrder: string[]): void {
    const now = Date.now()
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE topic_torrents SET rank = NULL WHERE topic_id = ?').run(topicId)
      const upsert = this.db.prepare(
        `INSERT INTO topic_torrents (topic_id, info_hash, rank, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(topic_id, info_hash) DO UPDATE SET
           rank = excluded.rank,
           last_seen_at = excluded.last_seen_at`
      )
      hashesInOrder.forEach((h, i) => upsert.run(topicId, h, i + 1, now, now))
    })
    tx()
  }

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
      .prepare('SELECT * FROM torrents WHERE movie_id IS NULL ORDER BY last_seen_at DESC LIMIT ?')
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
         ORDER BY last_seen_at DESC
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
      seenAt: null,
      favorite: false
    }
  }

  setFavorite(movieId: number, favorite: boolean): void {
    this.ensureState(movieId)
    this.db.prepare('UPDATE movie_state SET favorite = ? WHERE movie_id = ?').run(favorite ? 1 : 0, movieId)
  }

  /** Clear the on-disk file reference but keep status (seen/etc) intact. */
  clearFile(movieId: number): void {
    this.db
      .prepare('UPDATE movie_state SET file_path = NULL, qbit_hash = NULL WHERE movie_id = ?')
      .run(movieId)
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

  setFilePath(movieId: number, filePath: string): void {
    this.ensureState(movieId)
    this.db.prepare('UPDATE movie_state SET file_path = ? WHERE movie_id = ?').run(filePath, movieId)
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
    topicId: number
    statuses?: MovieStatus[]
    inTopOnly?: boolean
    excludeStatuses?: MovieStatus[]
    favoritesOnly?: boolean
    sort?: 'rank' | 'seen_at' | 'downloaded_at' | 'title' | 'discovery'
  }): Array<{ movie: Movie; state: MovieState; bestTorrent: Torrent | null; rank: number | null }> {
    const conds: string[] = [
      `EXISTS (
         SELECT 1 FROM topic_torrents tt
         JOIN torrents t ON t.info_hash = tt.info_hash
         WHERE tt.topic_id = ? AND t.movie_id = m.id
       )`
    ]
    const params: unknown[] = [opts.topicId]

    if (opts.inTopOnly) {
      conds.push(`EXISTS (
        SELECT 1 FROM topic_torrents tt2
        JOIN torrents t2 ON t2.info_hash = tt2.info_hash
        WHERE tt2.topic_id = ? AND t2.movie_id = m.id AND tt2.rank IS NOT NULL
      )`)
      params.push(opts.topicId)
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

    if (opts.favoritesOnly) {
      conds.push('ms.favorite = 1')
    }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''

    const rankSubquery = `(SELECT MIN(tt.rank) FROM topic_torrents tt
      JOIN torrents t ON t.info_hash = tt.info_hash
      WHERE tt.topic_id = ? AND t.movie_id = m.id)`
    const recencySubquery = `(SELECT MAX(tt.last_seen_at) FROM topic_torrents tt
      JOIN torrents t ON t.info_hash = tt.info_hash
      WHERE tt.topic_id = ? AND t.movie_id = m.id)`

    let orderBy = 'm.title COLLATE NOCASE ASC'
    let orderParams: unknown[] = []
    if (opts.sort === 'rank') {
      orderBy = `${rankSubquery} ASC NULLS LAST`
      orderParams = [opts.topicId]
    } else if (opts.sort === 'seen_at') orderBy = 'ms.seen_at DESC'
    else if (opts.sort === 'downloaded_at') orderBy = 'ms.downloaded_at DESC'
    else if (opts.sort === 'discovery') {
      orderBy = `${rankSubquery} ASC NULLS LAST, ${recencySubquery} DESC`
      orderParams = [opts.topicId, opts.topicId]
    }

    const rows = this.db
      .prepare(
        `SELECT m.*,
                COALESCE(ms.status, 'unseen') AS s_status,
                ms.file_path AS s_file_path,
                ms.qbit_hash AS s_qbit_hash,
                ms.downloaded_at AS s_downloaded_at,
                ms.seen_at AS s_seen_at,
                COALESCE(ms.favorite, 0) AS s_favorite,
                ${rankSubquery} AS rank
         FROM movies m
         LEFT JOIN movie_state ms ON ms.movie_id = m.id
         ${where}
         ORDER BY ${orderBy}`
      )
      .all(opts.topicId, ...params, ...orderParams) as Array<MovieRow & {
        s_status: MovieStatus
        s_file_path: string | null
        s_qbit_hash: string | null
        s_downloaded_at: number | null
        s_seen_at: number | null
        s_favorite: number
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
        seenAt: r.s_seen_at,
        favorite: r.s_favorite === 1
      }
      const torrents = this.torrentsForMovie(r.id)
      const bestTorrent = torrents[0] ?? null
      return { movie, state, bestTorrent, rank: r.rank }
    })
  }

  /**
   * Movies currently ranked in the given topic, with their state and best torrent.
   */
  topMovies(topicId: number): Array<{ movie: Movie; state: MovieState; bestTorrent: Torrent; rank: number }> {
    const rows = this.db
      .prepare(
        `SELECT t.*, tt.rank AS topic_rank,
                m.id AS m_id, m.tmdb_id AS m_tmdb_id, m.title AS m_title, m.year AS m_year,
                m.poster_url AS m_poster_url, m.plot AS m_plot, m.rating AS m_rating,
                m.runtime_min AS m_runtime_min, m.genres_json AS m_genres_json,
                ms.status AS s_status, ms.file_path AS s_file_path, ms.qbit_hash AS s_qbit_hash,
                ms.downloaded_at AS s_downloaded_at, ms.seen_at AS s_seen_at,
                COALESCE(ms.favorite, 0) AS s_favorite
         FROM topic_torrents tt
         JOIN torrents t ON t.info_hash = tt.info_hash
         LEFT JOIN movies m ON m.id = t.movie_id
         LEFT JOIN movie_state ms ON ms.movie_id = m.id
         WHERE tt.topic_id = ? AND tt.rank IS NOT NULL
         ORDER BY tt.rank ASC`
      )
      .all(topicId) as Array<TorrentRow & {
        topic_rank: number
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
        s_favorite: number
      }>

    return rows
      .filter((r) => r.m_id !== null)
      .map((r) => ({
        rank: r.topic_rank,
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
          seenAt: r.s_seen_at,
          favorite: r.s_favorite === 1
        }
      }))
  }
}
