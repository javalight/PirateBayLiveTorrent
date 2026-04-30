export interface AppSettings {
  pollIntervalMin: number
  categories: number[]
  downloadDir: string
  autoMarkSeenOnDownload: boolean
  tmdb: {
    apiKey: string | null
  }
  qbit: {
    host: string
    username: string
    password: string | null
  }
}

export const SETTINGS_DEFAULTS: AppSettings = {
  pollIntervalMin: 30,
  categories: [201],
  downloadDir: '',
  autoMarkSeenOnDownload: true,
  tmdb: { apiKey: null },
  qbit: { host: 'http://localhost:8080', username: 'admin', password: null }
}
