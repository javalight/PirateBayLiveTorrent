import { useState } from 'react'
import type { TopMovieCard } from '@shared/api'
import type { DownloadProgressPayload } from '@shared/ipc'
import { STREAM_PLAY_THRESHOLD } from '@shared/settings'
import { StatusBadge } from './StatusBadge'

export function MovieCard({
  card,
  progress,
  onChanged
}: {
  card: TopMovieCard
  progress?: DownloadProgressPayload
  onChanged?: () => void
}): JSX.Element {
  const { movie, state, bestTorrent, rank } = card
  const rating = movie.rating != null ? movie.rating.toFixed(1) : null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAction = async (op: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await op()
      onChanged?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const showProgress = state.status === 'downloading' && progress
  const pct = showProgress ? Math.round(progress.progress * 100) : 0
  const canStreamNow =
    state.status === 'downloading' &&
    !!state.filePath &&
    !!progress &&
    progress.progress >= STREAM_PLAY_THRESHOLD

  const trailerUrl = (() => {
    const q = `youtube ${movie.title}${movie.year ? ` ${movie.year}` : ''} trailer`
    return `https://duckduckgo.com/?q=!ducky+${encodeURIComponent(q)}`
  })()

  return (
    <article className="card">
      <div className="card-rank">#{rank}</div>
      <button
        className={`card-fav ${state.favorite ? 'is-fav' : ''}`}
        title={state.favorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-label="Toggle favorite"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation()
          handleAction(() => window.api.setFavorite(movie.id, !state.favorite))
        }}
      >
        {state.favorite ? '★' : '☆'}
      </button>
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
        <div className="card-row">
          <StatusBadge status={state.status} />
          <div className="card-actions">
            <button
              className="btn-ghost"
              title="Watch trailer on YouTube"
              disabled={busy}
              onClick={() => handleAction(() => window.api.openExternal(trailerUrl))}
            >
              ▶ Trailer
            </button>
            {(state.status === 'unseen' || state.status === 'hidden') && (
              <button
                className="btn-action"
                disabled={busy}
                onClick={() => handleAction(() => window.api.download(movie.id))}
              >
                Download
              </button>
            )}
            {(state.status === 'downloaded' || state.status === 'seen') && (
              <button
                className="btn-action"
                disabled={busy || !state.filePath}
                onClick={() => handleAction(() => window.api.play(movie.id))}
              >
                Play
              </button>
            )}
            {canStreamNow && (
              <button
                className="btn-action"
                disabled={busy}
                title={`Stream now (${pct}% downloaded)`}
                onClick={() => handleAction(() => window.api.play(movie.id))}
              >
                ▶ Stream
              </button>
            )}
            {state.status === 'unseen' && (
              <>
                <button
                  className="btn-ghost"
                  title="Mark as seen without downloading"
                  disabled={busy}
                  onClick={() => handleAction(() => window.api.setStatus(movie.id, 'seen'))}
                >
                  ✓
                </button>
                <button
                  className="btn-ghost"
                  title="Hide — won't show in Unseen anymore"
                  disabled={busy}
                  onClick={() => handleAction(() => window.api.setStatus(movie.id, 'hidden'))}
                >
                  ⊘
                </button>
              </>
            )}
            {state.status === 'seen' && (
              <button
                className="btn-ghost"
                title="Move back to unseen"
                disabled={busy}
                onClick={() => handleAction(() => window.api.setStatus(movie.id, 'unseen'))}
              >
                ↺
              </button>
            )}
            {state.status === 'hidden' && (
              <button
                className="btn-ghost"
                title="Move back to unseen"
                disabled={busy}
                onClick={() => handleAction(() => window.api.setStatus(movie.id, 'unseen'))}
              >
                ↺
              </button>
            )}
          </div>
        </div>

        {showProgress ? (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${pct}%` }} />
            <span className="progress-label">
              {pct}% — {progress.state}
            </span>
          </div>
        ) : null}

        {error ? <div className="card-error">{error}</div> : null}
      </div>
    </article>
  )
}
