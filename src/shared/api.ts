// API surface exposed by preload to the renderer via contextBridge.
// Implemented in src/preload/index.ts; consumed via window.api in the renderer.

import type {
  Movie,
  MovieState,
  MovieStatus,
  Topic,
  TopicSourceKind,
  TopicStats,
  Torrent
} from './types.js'

export interface MovieListItem {
  movie: Movie
  state: MovieState
  bestTorrent: Torrent | null
  rank: number | null
}

export interface ListMoviesArg {
  /** Omit to query across all topics (and tracked-but-untopiced movies, e.g. from Search). */
  topicId?: number
  statuses?: MovieStatus[]
  excludeStatuses?: MovieStatus[]
  inTopOnly?: boolean
  favoritesOnly?: boolean
  downloadActivityOnly?: boolean
  sort?: 'rank' | 'seen_at' | 'downloaded_at' | 'title' | 'discovery' | 'activity'
}

export interface CreateTopicArg {
  name: string
  icon?: string | null
  sourceKind: TopicSourceKind
  sourceParam: string
  sourceCategory?: number | null
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
  streamWhileDownloading?: boolean
  tmdbApiKey?: string | null
  qbitHost?: string
  qbitUsername?: string
  qbitPassword?: string | null
}

export interface AppApi {
  ping: () => Promise<string>
  pollNow: () => Promise<TopUpdatedPayload[]>
  pollOneNow: (topicId: number) => Promise<TopUpdatedPayload | null>
  pollerStatus: () => Promise<PollerStatusPayload>
  listTopics: () => Promise<Topic[]>
  createTopic: (arg: CreateTopicArg) => Promise<Topic>
  updateTopic: (topicId: number, patch: Partial<CreateTopicArg>) => Promise<Topic>
  archiveTopic: (topicId: number) => Promise<void>
  topicStats: () => Promise<TopicStats[]>
  topMovies: (topicId: number) => Promise<TopMovieCard[]>
  listMovies: (arg: ListMoviesArg) => Promise<MovieListItem[]>
  enrichNow: () => Promise<{ attempted: number; linkedToTmdb: number; linkedFallback: number; failed: number }>
  getSettings: () => Promise<AppSettings>
  updateSettings: (patch: UpdateSettingsArg) => Promise<AppSettings>
  download: (movieId: number) => Promise<void>
  deleteFile: (movieId: number) => Promise<void>
  findTorrents: (query: string, category: number | null) => Promise<MovieListItem[]>
  play: (movieId: number) => Promise<void>
  setStatus: (movieId: number, status: MovieStatus) => Promise<void>
  setFavorite: (movieId: number, favorite: boolean) => Promise<void>
  testQbit: () => Promise<{ ok: boolean; message: string }>
  openPath: (path: string) => Promise<void>
  openExternal: (url: string) => Promise<void>
  revealItem: (movieId: number) => Promise<void>
  onTopUpdated: (cb: (payload: TopUpdatedPayload) => void) => () => void
  onDownloadProgress: (cb: (payload: DownloadProgressPayload) => void) => () => void
}
