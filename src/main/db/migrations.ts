import type Database from 'better-sqlite3'
import { schemaV1 } from './schema.js'

const migrations: Array<{ version: number; up: (db: Database.Database) => void }> = [
  {
    version: 1,
    up: (db) => db.exec(schemaV1)
  }
  // Future migrations append here.
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
