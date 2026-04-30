// Shared IPC channel names + payload types between main and renderer.

export const IpcChannels = {
  ping: 'app:ping',
  pollNow: 'poller:tick-now',
  pollerStatus: 'poller:status',
  topMovies: 'movies:top',
  enrichNow: 'enricher:run',
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  download: 'movie:download',
  play: 'movie:play',
  setStatus: 'movie:set-status',
  setFavorite: 'movie:set-favorite',
  listMovies: 'movies:list',
  testQbit: 'qbit:test',
  openPath: 'shell:open-path',
  topUpdated: 'top:updated',
  downloadProgress: 'download:progress'
} as const

export interface PollerStatusPayload {
  intervalMs: number
  categories: number[]
  running: boolean
}

export interface TopUpdatedPayload {
  category: number
  fetched: number
  newTorrents: number
  unlinkedCount: number
  fetchedAt: number
}

export interface DownloadProgressPayload {
  movieId: number
  qbitHash: string
  state: string
  progress: number
  dlSpeed: number
  done: boolean
}
