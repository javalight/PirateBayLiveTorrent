// Initial schema. Bumping schema requires adding a migration in migrations.ts.

export const schemaV1 = /* sql */ `
CREATE TABLE IF NOT EXISTS movies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id       INTEGER UNIQUE,
  title         TEXT NOT NULL,
  year          INTEGER,
  poster_url    TEXT,
  plot          TEXT,
  rating        REAL,
  runtime_min   INTEGER,
  genres_json   TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS movies_title_idx ON movies (title);

CREATE TABLE IF NOT EXISTS torrents (
  info_hash       TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        INTEGER NOT NULL,
  size_bytes      INTEGER,
  seeders         INTEGER NOT NULL DEFAULT 0,
  leechers        INTEGER NOT NULL DEFAULT 0,
  magnet          TEXT NOT NULL,
  movie_id        INTEGER REFERENCES movies(id),
  imdb            TEXT,
  enrichment_tried_at INTEGER,
  first_seen_at   INTEGER NOT NULL,
  last_seen_at    INTEGER NOT NULL,
  current_rank    INTEGER
);

CREATE INDEX IF NOT EXISTS torrents_movie_id_idx ON torrents (movie_id);
CREATE INDEX IF NOT EXISTS torrents_current_rank_idx ON torrents (current_rank);
CREATE INDEX IF NOT EXISTS torrents_category_idx ON torrents (category);

CREATE TABLE IF NOT EXISTS movie_state (
  movie_id      INTEGER PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('unseen','downloading','downloaded','seen','hidden')),
  file_path     TEXT,
  qbit_hash     TEXT,
  downloaded_at INTEGER,
  seen_at       INTEGER,
  favorite      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS movie_state_status_idx ON movie_state (status);
CREATE INDEX IF NOT EXISTS movie_state_favorite_idx ON movie_state (favorite);

CREATE TABLE IF NOT EXISTS top_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      INTEGER NOT NULL,
  fetched_at    INTEGER NOT NULL,
  hashes_json   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS top_snapshots_cat_time_idx ON top_snapshots (category, fetched_at);

CREATE TABLE IF NOT EXISTS topics (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  icon            TEXT,
  source_kind     TEXT NOT NULL CHECK (source_kind IN ('top100','search')),
  source_param    TEXT NOT NULL,
  source_category INTEGER,
  created_at      INTEGER NOT NULL,
  archived_at     INTEGER
);

CREATE TABLE IF NOT EXISTS topic_torrents (
  topic_id       INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  info_hash      TEXT NOT NULL REFERENCES torrents(info_hash) ON DELETE CASCADE,
  rank           INTEGER,
  first_seen_at  INTEGER NOT NULL,
  last_seen_at   INTEGER NOT NULL,
  PRIMARY KEY (topic_id, info_hash)
);

CREATE INDEX IF NOT EXISTS topic_torrents_topic_rank_idx ON topic_torrents (topic_id, rank);
CREATE INDEX IF NOT EXISTS topic_torrents_hash_idx ON topic_torrents (info_hash);
`
