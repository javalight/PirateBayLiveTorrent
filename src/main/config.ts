import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SETTINGS_DEFAULTS, type AppSettings } from '../shared/settings.js'

interface PersistedShape {
  pollIntervalMin: number
  categories: number[]
  downloadDir: string
  autoMarkSeenOnDownload: boolean
  streamWhileDownloading: boolean
  showPosters: boolean
  trailerUseInApp: boolean
}

let cache: PersistedShape | null = null

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

const defaults = (): PersistedShape => ({
  pollIntervalMin: SETTINGS_DEFAULTS.pollIntervalMin,
  categories: SETTINGS_DEFAULTS.categories,
  downloadDir: join(app.getPath('videos'), 'PBL'),
  autoMarkSeenOnDownload: SETTINGS_DEFAULTS.autoMarkSeenOnDownload,
  streamWhileDownloading: SETTINGS_DEFAULTS.streamWhileDownloading,
  showPosters: SETTINGS_DEFAULTS.showPosters,
  trailerUseInApp: SETTINGS_DEFAULTS.trailerUseInApp
})

const load = (): PersistedShape => {
  if (cache) return cache
  const path = settingsPath()
  try {
    const raw = readFileSync(path, 'utf8')
    // Tolerate legacy keys (qbitHost/qbitUsername/secrets/tmdbApiKey…) from
    // older settings files — extract only what we still use.
    const parsed = JSON.parse(raw) as Partial<PersistedShape>
    cache = { ...defaults(), ...parsed } as PersistedShape
  } catch {
    cache = defaults()
    persist(cache)
  }
  return cache
}

const persist = (s: PersistedShape): void => {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2))
}

export function getSettings(): AppSettings {
  const s = load()
  return {
    pollIntervalMin: s.pollIntervalMin,
    categories: s.categories,
    downloadDir: s.downloadDir,
    autoMarkSeenOnDownload: s.autoMarkSeenOnDownload,
    streamWhileDownloading: s.streamWhileDownloading,
    showPosters: s.showPosters,
    trailerUseInApp: s.trailerUseInApp
  }
}

export interface UpdateSettingsInput {
  pollIntervalMin?: number
  categories?: number[]
  downloadDir?: string
  autoMarkSeenOnDownload?: boolean
  streamWhileDownloading?: boolean
  showPosters?: boolean
  trailerUseInApp?: boolean
}

export function updateSettings(patch: UpdateSettingsInput): AppSettings {
  const s = { ...load() }
  if (patch.pollIntervalMin != null) s.pollIntervalMin = clamp(patch.pollIntervalMin, 5, 360)
  if (patch.categories) s.categories = patch.categories
  if (patch.downloadDir) s.downloadDir = patch.downloadDir
  if (patch.autoMarkSeenOnDownload != null) s.autoMarkSeenOnDownload = patch.autoMarkSeenOnDownload
  if (patch.streamWhileDownloading != null) s.streamWhileDownloading = patch.streamWhileDownloading
  if (patch.showPosters != null) s.showPosters = patch.showPosters
  if (patch.trailerUseInApp != null) s.trailerUseInApp = patch.trailerUseInApp

  cache = s
  persist(s)
  return getSettings()
}

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n))
