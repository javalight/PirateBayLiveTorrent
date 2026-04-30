// API surface exposed by preload to the renderer via contextBridge.
// Implemented in src/preload/index.ts; consumed via window.api in the renderer.

import type { Movie, MovieState, Torrent } from './types.js'
import type { PollerStatusPayload, TopUpdatedPayload } from './ipc.js'
import type { AppSettings } from './settings.js'

export interface TopMovieCard {
  movie: Movie
  state: MovieState
  bestTorrent: Torrent
  rank: number
}

export interface UpdateSettingsArg {
  pollIntervalMin?: number
  categories?: number[]
  downloadDir?: string
  autoMarkSeenOnDownload?: boolean
  tmdbApiKey?: string | null
  qbitHost?: string
  qbitUsername?: string
  qbitPassword?: string | null
}

export interface AppApi {
  ping: () => Promise<string>
  pollNow: () => Promise<TopUpdatedPayload[]>
  pollerStatus: () => Promise<PollerStatusPayload>
  topMovies: (category: number) => Promise<TopMovieCard[]>
  enrichNow: () => Promise<{ attempted: number; linkedToTmdb: number; linkedFallback: number; failed: number }>
  getSettings: () => Promise<AppSettings>
  updateSettings: (patch: UpdateSettingsArg) => Promise<AppSettings>
  onTopUpdated: (cb: (payload: TopUpdatedPayload) => void) => () => void
}
