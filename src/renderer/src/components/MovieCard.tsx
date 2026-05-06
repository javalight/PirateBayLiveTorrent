import { useEffect, useRef, useState } from 'react'
import type { TopMovieCard } from '@shared/api'
import type { DownloadProgressPayload } from '@shared/ipc'
import { STREAM_PLAY_THRESHOLD } from '@shared/settings'
import { StatusBadge } from './StatusBadge'
import { useDisplayMode } from '../contexts/DisplayMode'
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

const formatSpeed = (bytesPerSec: number): string =>
  bytesPerSec > 0 ? `${formatSize(bytesPerSec)}/s` : '0 B/s'

const STATE_LABELS: Record<string, string> = {
  metaDL: 'Looking for peers…',
  downloading: 'Downloading',
  uploading: 'Seeding',
  paused: 'Paused'
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
  const { mode } = useDisplayMode()
  const primaryTitle = mode === 'release' ? bestTorrent.name : movie.title
  const secondaryTitle = mode === 'release' ? movie.title : bestTorrent.name
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lazy poster: trigger a Wikipedia lookup the first time this row is
  // visible (or close to it). Cached on disk after; subsequent loads use
  // the stored URL instantly. Browser handles the actual image bytes
  // via native `loading="lazy"`. The slot itself (with `?` placeholder)
  // is always rendered when posters are enabled, so loading the image
  // never shifts surrounding content.
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
            .catch(() => {
              /* swallow — leave row placeholder-only */
            })
          break
        }
      },
      { rootMargin: '300px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [movie.id, posterUrl, showPosters])

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
    <article className="row" ref={articleRef}>
      <div className="row-main">
        {rank ? <div className="row-rank">#{rank}</div> : <div className="row-rank row-rank-empty">—</div>}

        {showPosters ? (
          posterUrl ? (
            <img
              className="row-poster"
              src={posterUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="row-poster row-poster-empty" aria-hidden>?</div>
          )
        ) : null}

        <div className="row-title-block">
          <h3
            className={`row-title ${mode === 'release' ? 'row-title-release' : 'row-title-clean'}`}
            title={bestTorrent.name}
          >
            {primaryTitle}
          </h3>
          <div className="row-meta">
            {secondaryTitle && secondaryTitle !== primaryTitle ? (
              <span className="row-meta-movie" title={secondaryTitle}>{secondaryTitle}</span>
            ) : null}
            {movie.year ? <span>{movie.year}</span> : null}
            {rating ? <span>★ {rating}</span> : null}
            {bestTorrent.sizeBytes ? <span>{formatSize(bestTorrent.sizeBytes)}</span> : null}
            {bestTorrent.seeders ? <span>{bestTorrent.seeders} seed</span> : null}
          </div>
        </div>

        <StatusBadge status={state.status} />

        <div className="row-actions">
          <button
            className="btn-ghost"
            data-tooltip="Watch trailer on YouTube"
            disabled={busy}
            onClick={() => handleAction(() => window.api.openExternal(trailerUrl))}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: 4 }}>
              <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
              <path d="m6.2 5.3 3.1 3.9" />
              <path d="m12.4 3.4 3.1 4" />
              <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            </svg>
            Trailer
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

          {state.status === 'downloading' && (
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
              data-tooltip="Show in Finder"
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
          )}

          {canStreamNow && (
            <button
              className="btn-action"
              disabled={busy}
              data-tooltip={`Stream now (${pct}% downloaded)`}
              onClick={() => handleAction(() => window.api.play(movie.id))}
            >
              ▶ Stream
            </button>
          )}

          {state.status === 'unseen' && (
            <>
              <button
                className="btn-ghost"
                data-tooltip="Mark as seen without downloading"
                disabled={busy}
                onClick={() => handleAction(() => window.api.setStatus(movie.id, 'seen'))}
              >
                ✓
              </button>
              <button
                className="btn-ghost"
                data-tooltip="Hide — won.t show in Unseen anymore"
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
              data-tooltip="Move back to unseen"
              disabled={busy}
              onClick={() => handleAction(() => window.api.setStatus(movie.id, 'unseen'))}
            >
              ↺
            </button>
          )}

          <button
            className={`btn-ghost row-fav ${state.favorite ? 'is-fav' : ''}`}
            data-tooltip={state.favorite ? 'Remove from favorites' : 'Add to favorites'}
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
          <div className="row-progress-bar">
            <div className="progress-bar" style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-label">
            {pct}% · {STATE_LABELS[progress.state] ?? progress.state}
            {' · '}
            {progress.peers} peer{progress.peers === 1 ? '' : 's'}
            {' · ↓ '}
            {formatSpeed(progress.dlSpeed)}
            {progress.upSpeed > 0 ? ` · ↑ ${formatSpeed(progress.upSpeed)}` : ''}
          </span>
        </div>
      ) : state.status === 'downloading' ? (
        <div className="row-progress">
          <div className="row-progress-bar">
            <div className="progress-bar" style={{ width: '0%' }} />
          </div>
          <span className="progress-label">Connecting to swarm…</span>
        </div>
      ) : null}

      {error ? <div className="row-error">{error}</div> : null}
    </article>
  )
}
