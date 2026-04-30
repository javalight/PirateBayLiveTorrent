// API surface exposed by preload to the renderer via contextBridge.
// Implemented in src/preload/index.ts; consumed via window.api in the renderer.

import type { Movie, MovieState, MovieStatus, Torrent } from './types.js'

export interface MovieListItem {
  movie: Movie
  state: MovieState
  bestTorrent: Torrent | null
  rank: number | null
}

export interface ListMoviesArg {
  statuses?: MovieStatus[]
  excludeStatuses?: MovieStatus[]
  inTopOnly?: boolean
  sort?: 'rank' | 'seen_at' | 'downloaded_at' | 'title'
}
import type { DownloadProgressPayload, PollerStatusPayload, TopUpdatedPayload } from './ipc.js'
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
  listMovies: (arg: ListMoviesArg) => Promise<MovieListItem[]>
  enrichNow: () => Promise<{ attempted: number; linkedToTmdb: number; linkedFallback: number; failed: number }>
  getSettings: () => Promise<AppSettings>
  updateSettings: (patch: UpdateSettingsArg) => Promise<AppSettings>
  download: (movieId: number) => Promise<void>
  play: (movieId: number) => Promise<void>
  setStatus: (movieId: number, status: MovieStatus) => Promise<void>
  testQbit: () => Promise<{ ok: boolean; message: string }>
  openPath: (path: string) => Promise<void>
  onTopUpdated: (cb: (payload: TopUpdatedPayload) => void) => () => void
  onDownloadProgress: (cb: (payload: DownloadProgressPayload) => void) => () => void
}
