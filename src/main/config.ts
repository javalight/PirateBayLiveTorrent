import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SETTINGS_DEFAULTS, type AppSettings } from '../shared/settings.js'

interface PersistedSecrets {
  tmdbApiKeyEnc: string | null
}

interface PersistedShape {
  pollIntervalMin: number
  categories: number[]
  downloadDir: string
  autoMarkSeenOnDownload: boolean
  streamWhileDownloading: boolean
  secrets: PersistedSecrets
}

let cache: PersistedShape | null = null

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

const defaults = (): PersistedShape => ({
  pollIntervalMin: SETTINGS_DEFAULTS.pollIntervalMin,
  categories: SETTINGS_DEFAULTS.categories,
  downloadDir: join(app.getPath('videos'), 'PBL'),
  autoMarkSeenOnDownload: SETTINGS_DEFAULTS.autoMarkSeenOnDownload,
  streamWhileDownloading: SETTINGS_DEFAULTS.streamWhileDownloading,
  secrets: { tmdbApiKeyEnc: null }
})

const load = (): PersistedShape => {
  if (cache) return cache
  const path = settingsPath()
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as Partial<PersistedShape> & {
      // Tolerate legacy keys from pre-WebTorrent settings files; they're ignored.
      qbitHost?: unknown
      qbitUsername?: unknown
    }
    cache = { ...defaults(), ...parsed } as PersistedShape
    cache.secrets = { tmdbApiKeyEnc: parsed.secrets?.tmdbApiKeyEnc ?? null }
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

const encrypt = (plain: string): string =>
  safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(plain).toString('base64') : plain

const decrypt = (enc: string | null): string | null => {
  if (!enc) return null
  if (!safeStorage.isEncryptionAvailable()) return enc
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return null
  }
}

export function getSettings(): AppSettings {
  const s = load()
  return {
    pollIntervalMin: s.pollIntervalMin,
    categories: s.categories,
    downloadDir: s.downloadDir,
    autoMarkSeenOnDownload: s.autoMarkSeenOnDownload,
    streamWhileDownloading: s.streamWhileDownloading,
    tmdb: { apiKey: decrypt(s.secrets.tmdbApiKeyEnc) }
  }
}

export interface UpdateSettingsInput {
  pollIntervalMin?: number
  categories?: number[]
  downloadDir?: string
  autoMarkSeenOnDownload?: boolean
  streamWhileDownloading?: boolean
  tmdbApiKey?: string | null
}

export function updateSettings(patch: UpdateSettingsInput): AppSettings {
  const s = { ...load() }
  if (patch.pollIntervalMin != null) s.pollIntervalMin = clamp(patch.pollIntervalMin, 5, 360)
  if (patch.categories) s.categories = patch.categories
  if (patch.downloadDir) s.downloadDir = patch.downloadDir
  if (patch.autoMarkSeenOnDownload != null) s.autoMarkSeenOnDownload = patch.autoMarkSeenOnDownload
  if (patch.streamWhileDownloading != null) s.streamWhileDownloading = patch.streamWhileDownloading

  if ('tmdbApiKey' in patch) {
    s.secrets = { ...s.secrets }
    s.secrets.tmdbApiKeyEnc = patch.tmdbApiKey ? encrypt(patch.tmdbApiKey) : null
  }

  cache = s
  persist(s)
  return getSettings()
}

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n))
