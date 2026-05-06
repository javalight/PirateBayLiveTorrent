import type { MovieListItem } from '@shared/api'
import type { DownloadProgressPayload } from '@shared/ipc'
import { MovieCard } from './MovieCard'
import { MoviePosterCard } from './MoviePosterCard'
import { useLayoutMode } from '../contexts/LayoutMode'

export function MovieGrid({
  items,
  progress,
  onChanged
}: {
  items: MovieListItem[]
  progress: Record<number, DownloadProgressPayload>
  onChanged?: () => void
}): JSX.Element {
  const { mode } = useLayoutMode()

  if (mode === 'grid') {
    return (
      <div className="poster-grid">
        {items.map((it) => {
          if (!it.bestTorrent) return null
          return (
            <MoviePosterCard
              key={it.movie.id}
              card={{
                movie: it.movie,
                state: it.state,
                bestTorrent: it.bestTorrent,
                rank: it.rank ?? 0
              }}
              progress={progress[it.movie.id]}
              onChanged={onChanged}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="list">
      {items.map((it) => {
        if (!it.bestTorrent) return null
        return (
          <MovieCard
            key={it.movie.id}
            card={{
              movie: it.movie,
              state: it.state,
              bestTorrent: it.bestTorrent,
              rank: it.rank ?? 0
            }}
            progress={progress[it.movie.id]}
            onChanged={onChanged}
          />
        )
      })}
    </div>
  )
}
