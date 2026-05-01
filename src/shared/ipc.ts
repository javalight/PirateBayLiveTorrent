// Shared IPC channel names + payload types between main and renderer.

export const IpcChannels = {
  ping: 'app:ping',
  pollNow: 'poller:tick-now',
  pollOneNow: 'poller:tick-one',
  pollerStatus: 'poller:status',
  listTopics: 'topics:list',
  createTopic: 'topics:create',
  updateTopic: 'topics:update',
  archiveTopic: 'topics:archive',
  topicStats: 'topics:stats',
  topMovies: 'movies:top',
  enrichNow: 'enricher:run',
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  download: 'movie:download',
  deleteFile: 'movie:delete-file',
  findTorrents: 'torrents:find',
  downloadMagnet: 'torrents:download-magnet',
  play: 'movie:play',
  setStatus: 'movie:set-status',
  setFavorite: 'movie:set-favorite',
  listMovies: 'movies:list',
  testQbit: 'qbit:test',
  openPath: 'shell:open-path',
  openExternal: 'shell:open-external',
  revealItem: 'shell:reveal-item',
  topUpdated: 'top:updated',
  downloadProgress: 'download:progress'
} as const

export interface PollerStatusPayload {
  intervalMs: number
  categories: number[]
  running: boolean
}

export interface TopUpdatedPayload {
  topicId: number
  topicName: string
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
