// Shared IPC channel names + payload types between main and renderer.

export const IpcChannels = {
  ping: 'app:ping',
  pollNow: 'poller:tick-now',
  pollerStatus: 'poller:status',
  topMovies: 'movies:top',
  enrichNow: 'enricher:run',
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  topUpdated: 'top:updated' // emitted from main → renderer (no invoke)
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
