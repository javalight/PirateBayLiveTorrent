import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SETTINGS_DEFAULTS, type AppSettings } from '../shared/settings.js'

interface PersistedSecrets {
  tmdbApiKeyEnc: string | null
  qbitPasswordEnc: string | null
}

interface PersistedShape {
  pollIntervalMin: number
  categories: number[]
  downloadDir: string
  autoMarkSeenOnDownload: boolean
  streamWhileDownloading: boolean
  qbitHost: string
  qbitUsername: string
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
  qbitHost: SETTINGS_DEFAULTS.qbit.host,
  qbitUsername: SETTINGS_DEFAULTS.qbit.username,
  secrets: { tmdbApiKeyEnc: null, qbitPasswordEnc: null }
})

const load = (): PersistedShape => {
  if (cache) return cache
  const path = settingsPath()
  try {
    const raw = readFileSync(path, 'utf8')
    cache = { ...defaults(), ...(JSON.parse(raw) as Partial<PersistedShape>) } as PersistedShape
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
    tmdb: { apiKey: decrypt(s.secrets.tmdbApiKeyEnc) },
    qbit: {
      host: s.qbitHost,
      username: s.qbitUsername,
      password: decrypt(s.secrets.qbitPasswordEnc)
    }
  }
}

export interface UpdateSettingsInput {
  pollIntervalMin?: number
  categories?: number[]
  downloadDir?: string
  autoMarkSeenOnDownload?: boolean
  streamWhileDownloading?: boolean
  tmdbApiKey?: string | null
  qbitHost?: string
  qbitUsername?: string
  qbitPassword?: string | null
}

export function updateSettings(patch: UpdateSettingsInput): AppSettings {
  const s = { ...load() }
  if (patch.pollIntervalMin != null) s.pollIntervalMin = clamp(patch.pollIntervalMin, 5, 360)
  if (patch.categories) s.categories = patch.categories
  if (patch.downloadDir) s.downloadDir = patch.downloadDir
  if (patch.autoMarkSeenOnDownload != null) s.autoMarkSeenOnDownload = patch.autoMarkSeenOnDownload
  if (patch.streamWhileDownloading != null) s.streamWhileDownloading = patch.streamWhileDownloading
  if (patch.qbitHost) s.qbitHost = patch.qbitHost
  if (patch.qbitUsername) s.qbitUsername = patch.qbitUsername

  if ('tmdbApiKey' in patch || 'qbitPassword' in patch) {
    s.secrets = { ...s.secrets }
    if ('tmdbApiKey' in patch) {
      s.secrets.tmdbApiKeyEnc = patch.tmdbApiKey ? encrypt(patch.tmdbApiKey) : null
    }
    if ('qbitPassword' in patch) {
      s.secrets.qbitPasswordEnc = patch.qbitPassword ? encrypt(patch.qbitPassword) : null
    }
  }

  cache = s
  persist(s)
  return getSettings()
}

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n))
