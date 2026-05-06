export interface AppSettings {
  pollIntervalMin: number
  categories: number[]
  downloadDir: string
  autoMarkSeenOnDownload: boolean
  showPosters: boolean
  trailerUseInApp: boolean
}

export const SETTINGS_DEFAULTS: AppSettings = {
  pollIntervalMin: 30,
  categories: [201],
  downloadDir: '',
  autoMarkSeenOnDownload: true,
  showPosters: true,
  trailerUseInApp: false
}
