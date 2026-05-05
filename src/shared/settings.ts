export interface AppSettings {
  pollIntervalMin: number
  categories: number[]
  downloadDir: string
  autoMarkSeenOnDownload: boolean
  streamWhileDownloading: boolean
  tmdb: {
    apiKey: string | null
  }
}

export const SETTINGS_DEFAULTS: AppSettings = {
  pollIntervalMin: 30,
  categories: [201],
  downloadDir: '',
  autoMarkSeenOnDownload: true,
  streamWhileDownloading: true,
  tmdb: { apiKey: null }
}

/** Show Play button during a download once at least this fraction is on disk. */
export const STREAM_PLAY_THRESHOLD = 0.05
