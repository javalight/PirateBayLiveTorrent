export type MovieStatus =
  | 'unseen'
  | 'downloading'
  | 'downloaded'
  | 'seen'
  | 'hidden'

export interface Movie {
  id: number
  tmdbId: number | null
  title: string
  year: number | null
  posterUrl: string | null
  plot: string | null
  rating: number | null
  runtimeMin: number | null
  genres: string[]
}

export interface Torrent {
  infoHash: string
  name: string
  category: number
  sizeBytes: number | null
  seeders: number
  leechers: number
  magnet: string
  movieId: number | null
  imdb: string | null
  enrichmentTriedAt: number | null
  firstSeenAt: number
  lastSeenAt: number
  currentRank: number | null
}

export interface MovieState {
  movieId: number
  status: MovieStatus
  filePath: string | null
  qbitHash: string | null
  downloadedAt: number | null
  seenAt: number | null
  favorite: boolean
}

export interface MovieRow {
  movie: Movie
  state: MovieState
  bestTorrent: Torrent | null
  currentRank: number | null
}

export type TopicSourceKind = 'top100' | 'search'

export interface Topic {
  id: number
  name: string
  icon: string | null
  sourceKind: TopicSourceKind
  sourceParam: string
  sourceCategory: number | null
  createdAt: number
  archivedAt: number | null
}

export interface TopicStats {
  topic: Topic
  totalMovies: number
  unseen: number
  seen: number
  favorites: number
  inTopNow: number
}
