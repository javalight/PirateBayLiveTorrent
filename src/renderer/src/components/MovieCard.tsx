import type { TopMovieCard } from '@shared/api'
import { StatusBadge } from './StatusBadge'

export function MovieCard({ card }: { card: TopMovieCard }): JSX.Element {
  const { movie, state, bestTorrent, rank } = card
  const rating = movie.rating != null ? movie.rating.toFixed(1) : null

  return (
    <article className="card">
      <div className="card-rank">#{rank}</div>
      <div className="card-poster">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt={movie.title} loading="lazy" />
        ) : (
          <div className="poster-placeholder">No poster</div>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title" title={movie.title}>
          {movie.title}
        </h3>
        <div className="card-meta">
          {movie.year ? <span>{movie.year}</span> : null}
          {rating ? <span>★ {rating}</span> : null}
          {bestTorrent.seeders ? <span>{bestTorrent.seeders} seed</span> : null}
        </div>
        <StatusBadge status={state.status} />
      </div>
    </article>
  )
}
