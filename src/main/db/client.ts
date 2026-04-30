import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { runMigrations } from './migrations.js'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db

  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'pbl.sqlite')

  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  runMigrations(db)
  _db = db
  return db
}

export function closeDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}
