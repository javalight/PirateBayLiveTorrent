import { useEffect, useRef, useState } from 'react'
import type { TopMovieCard } from '@shared/api'
import type { DownloadProgressPayload } from '@shared/ipc'
import { STREAM_PLAY_THRESHOLD } from '@shared/settings'
import { StatusBadge } from './StatusBadge'
import { useAppSettings } from '../contexts/AppSettings'

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

export function MoviePosterCard({
  card,
  progress,
  onChanged
}: {
  card: TopMovieCard
  progress?: DownloadProgressPayload
  onChanged?: () => void
}): JSX.Element {
  const { movie, state, bestTorrent, rank } = card
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

  const appSettings = useAppSettings()
  const showPosters = appSettings?.showPosters ?? true

  const articleRef = useRef<HTMLElement | null>(null)
  const [posterUrl, setPosterUrl] = useState<string | null>(movie.posterUrl)
  useEffect(() => {
    setPosterUrl(movie.posterUrl)
  }, [movie.posterUrl])
  useEffect(() => {
    if (!showPosters || posterUrl) return
    const el = articleRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          obs.disconnect()
          window.api
            .enrichMovie(movie.id)
            .then((updated) => {
              if (updated?.posterUrl) setPosterUrl(updated.posterUrl)
            })
            .catch(() => {})
          break
        }
      },
      { rootMargin: '300px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [movie.id, posterUrl, showPosters])

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

  const primaryAction = ((): { label: string; run: () => Promise<unknown> } | null => {
    if (state.status === 'unseen' || state.status === 'hidden') {
      return { label: 'Download', run: () => window.api.download(movie.id) }
    }
    if (state.status === 'downloaded' || state.status === 'seen') {
      if (!state.filePath) return null
      return { label: '▶ Play', run: () => window.api.play(movie.id) }
    }
    if (canStreamNow) {
      return { label: `▶ Stream (${pct}%)`, run: () => window.api.play(movie.id) }
    }
    return null
  })()

  return (
    <article className={`poster-card status-${state.status}`} ref={articleRef}>
      <div className="poster-card-image">
        {showPosters ? (
          posterUrl ? (
            <img src={posterUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <div className="poster-card-placeholder" aria-hidden>?</div>
          )
        ) : (
          <div className="poster-card-placeholder" aria-hidden>{movie.title}</div>
        )}
        {rank ? <span className="poster-card-rank">#{rank}</span> : null}
        {state.status !== 'unseen' ? (
          <span className="poster-card-status"><StatusBadge status={state.status} /></span>
        ) : null}
        {showProgress ? (
          <div className="poster-card-progress">
            <div className="poster-card-progress-bar" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      {/* Favorite button is a sibling of the image (not a child) so its
        * tooltip isn't clipped by the image div's overflow:hidden. */}
      <button
        className={`poster-card-fav ${state.favorite ? 'is-fav' : ''}`}
        data-tooltip={state.favorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-label="Toggle favorite"
        disabled={busy}
        onClick={() => handleAction(() => window.api.setFavorite(movie.id, !state.favorite))}
      >
        {state.favorite ? '★' : '☆'}
      </button>

      <div className="poster-card-meta">
        <h3 className="poster-card-title" data-tooltip={movie.title}>{movie.title}</h3>
        <div className="poster-card-sub">
          {movie.year ? <span>{movie.year}</span> : null}
          {bestTorrent.sizeBytes ? <span>{formatSize(bestTorrent.sizeBytes)}</span> : null}
          {bestTorrent.seeders ? <span>{bestTorrent.seeders} seed</span> : null}
        </div>
      </div>

      <div className="poster-card-actions">
        {primaryAction ? (
          <button
            className="btn-action"
            disabled={busy}
            onClick={() => handleAction(primaryAction.run)}
          >
            {primaryAction.label}
          </button>
        ) : null}

        {canStreamNow && primaryAction?.label !== `▶ Stream (${pct}%)` ? (
          <button
            className="btn-action"
            data-tooltip={`Stream now (${pct}% downloaded)`}
            disabled={busy}
            onClick={() => handleAction(() => window.api.play(movie.id))}
          >
            ▶ Stream
          </button>
        ) : null}

        <button
          className="btn-ghost icon-only"
          data-tooltip="Watch trailer on YouTube"
          aria-label="Watch trailer"
          disabled={busy}
          onClick={() => handleAction(() => window.api.openExternal(trailerUrl))}
        >
          ▶
        </button>

        {state.status === 'downloading' ? (
          <button
            className="btn-ghost icon-only"
            data-tooltip="Restart — re-announce to trackers and re-find peers"
            aria-label="Restart download"
            disabled={busy}
            onClick={() => handleAction(() => window.api.restartDownload(movie.id))}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        ) : null}

        {state.filePath ? (
          <>
            <button
              className="btn-ghost icon-only"
              data-tooltip="Show in Finder"
              aria-label="Show in Finder"
              disabled={busy}
              onClick={() => handleAction(() => window.api.revealItem(movie.id))}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              </svg>
            </button>
            <button
              className="btn-ghost icon-only btn-danger"
              data-tooltip="Delete file (keeps Seen status)"
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
          </>
        ) : null}

        {state.status === 'unseen' ? (
          <>
            <button
              className="btn-ghost icon-only"
              data-tooltip="Mark as seen without downloading"
              aria-label="Mark as seen"
              disabled={busy}
              onClick={() => handleAction(() => window.api.setStatus(movie.id, 'seen'))}
            >
              ✓
            </button>
            <button
              className="btn-ghost icon-only"
              data-tooltip="Hide — won't show in Unseen anymore"
              aria-label="Hide"
              disabled={busy}
              onClick={() => handleAction(() => window.api.setStatus(movie.id, 'hidden'))}
            >
              ⊘
            </button>
          </>
        ) : null}

        {(state.status === 'seen' || state.status === 'hidden') ? (
          <button
            className="btn-ghost icon-only"
            data-tooltip="Move back to unseen"
            aria-label="Move back to unseen"
            disabled={busy}
            onClick={() => handleAction(() => window.api.setStatus(movie.id, 'unseen'))}
          >
            ↺
          </button>
        ) : null}
      </div>

      {error ? <div className="row-error">{error}</div> : null}
    </article>
  )
}
