import { useState } from 'react'
import type { TopMovieCard } from '@shared/api'
import type { DownloadProgressPayload } from '@shared/ipc'
import { STREAM_PLAY_THRESHOLD } from '@shared/settings'
import { StatusBadge } from './StatusBadge'

const formatSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

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
    <article className="row">
      <div className="row-main">
        {rank ? <div className="row-rank">#{rank}</div> : <div className="row-rank row-rank-empty">—</div>}

        <div className="row-title-block">
          <h3 className="row-title" title={movie.title}>
            {movie.title}
          </h3>
          <div className="row-secondary">
            <div className="row-meta">
              {movie.year ? <span>{movie.year}</span> : null}
              {rating ? <span>★ {rating}</span> : null}
              {bestTorrent.sizeBytes ? <span>{formatSize(bestTorrent.sizeBytes)}</span> : null}
              {bestTorrent.seeders ? <span>{bestTorrent.seeders} seed</span> : null}
            </div>
            <div className="row-subtitle" title={bestTorrent.name}>
              {bestTorrent.name}
            </div>
          </div>
        </div>

        <StatusBadge status={state.status} />

        <div className="row-actions">
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

          {state.filePath && (
            <button
              className="btn-ghost icon-only"
              title="Show in Finder"
              aria-label="Show in Finder"
              disabled={busy}
              onClick={() => handleAction(() => window.api.revealItem(movie.id))}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              </svg>
            </button>
          )}

          {state.filePath && (
            <button
              className="btn-ghost icon-only btn-danger"
              title="Delete the downloaded file (keeps Seen status)"
              aria-label="Delete file"
              disabled={busy}
              onClick={() => {
                if (!confirm(`Delete the downloaded file for "${movie.title}"?\n\nThis frees up disk space. The movie will stay in your Seen list.`)) return
                handleAction(() => window.api.deleteFile(movie.id))
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
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
          {(state.status === 'seen' || state.status === 'hidden') && (
            <button
              className="btn-ghost"
              title="Move back to unseen"
              disabled={busy}
              onClick={() => handleAction(() => window.api.setStatus(movie.id, 'unseen'))}
            >
              ↺
            </button>
          )}

          <button
            className={`btn-ghost row-fav ${state.favorite ? 'is-fav' : ''}`}
            title={state.favorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label="Toggle favorite"
            disabled={busy}
            onClick={() => handleAction(() => window.api.setFavorite(movie.id, !state.favorite))}
          >
            {state.favorite ? '★' : '☆'}
          </button>
        </div>
      </div>

      {showProgress ? (
        <div className="row-progress">
          <div className="progress-bar" style={{ width: `${pct}%` }} />
          <span className="progress-label">
            {pct}% — {progress.state}
          </span>
        </div>
      ) : null}

      {error ? <div className="row-error">{error}</div> : null}
    </article>
  )
}
