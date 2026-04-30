import type Database from 'better-sqlite3'
import { schemaV1 } from './schema.js'

const migrations: Array<{ version: number; up: (db: Database.Database) => void }> = [
  {
    version: 1,
    up: (db) => db.exec(schemaV1)
  },
  {
    // For DBs created before favorites existed: add the column. Fresh installs
    // running v1 already include it via CREATE TABLE.
    version: 2,
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('movie_state')").all() as Array<{ name: string }>
      if (!cols.some((c) => c.name === 'favorite')) {
        db.exec('ALTER TABLE movie_state ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0')
      }
      db.exec('CREATE INDEX IF NOT EXISTS movie_state_favorite_idx ON movie_state (favorite)')
    }
  },
  {
    // v3: introduce topics. Existing torrents become members of a default topic
    // ("Movies — Top 100", source=top100, param=201) so nothing is lost.
    version: 3,
    up: (db) => {
      db.exec(`
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
      `)

      const existing = db.prepare('SELECT id FROM topics LIMIT 1').get()
      if (!existing) {
        const now = Date.now()
        const info = db
          .prepare(
            `INSERT INTO topics (name, icon, source_kind, source_param, source_category, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run('Movies — Top 100', '🎬', 'top100', '201', 201, now)
        const defaultTopicId = Number(info.lastInsertRowid)

        db.prepare(
          `INSERT OR IGNORE INTO topic_torrents (topic_id, info_hash, rank, first_seen_at, last_seen_at)
           SELECT ?, info_hash, current_rank, first_seen_at, last_seen_at FROM torrents`
        ).run(defaultTopicId)
      }
    }
  }
]

export function runMigrations(db: Database.Database): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL PRIMARY KEY)')
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number | null }
  const current = row.v ?? 0

  for (const m of migrations) {
    if (m.version > current) {
      const tx = db.transaction(() => {
        m.up(db)
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(m.version)
      })
      tx()
    }
  }
}
