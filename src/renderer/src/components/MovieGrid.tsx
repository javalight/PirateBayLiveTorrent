import type { MovieListItem } from '@shared/api'
import type { DownloadProgressPayload } from '@shared/ipc'
import { MovieCard } from './MovieCard'

export function MovieGrid({
  items,
  progress,
  onChanged
}: {
  items: MovieListItem[]
  progress: Record<number, DownloadProgressPayload>
  onChanged?: () => void
}): JSX.Element {
  return (
    <div className="grid">
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
