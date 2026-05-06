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
        <button
          className={`poster-card-fav ${state.favorite ? 'is-fav' : ''}`}
          title={state.favorite ? 'Unfavorite' : 'Favorite'}
          aria-label="Toggle favorite"
          disabled={busy}
          onClick={() => handleAction(() => window.api.setFavorite(movie.id, !state.favorite))}
        >
          {state.favorite ? '★' : '☆'}
        </button>
        {state.status !== 'unseen' ? (
          <span className="poster-card-status"><StatusBadge status={state.status} /></span>
        ) : null}
        {showProgress ? (
          <div className="poster-card-progress">
            <div className="poster-card-progress-bar" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>

      <div className="poster-card-meta">
        <h3 className="poster-card-title" title={movie.title}>{movie.title}</h3>
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
        {state.status === 'unseen' ? (
          <>
            <button
              className="btn-ghost"
              title="Mark as seen"
              disabled={busy}
              onClick={() => handleAction(() => window.api.setStatus(movie.id, 'seen'))}
            >
              ✓
            </button>
            <button
              className="btn-ghost"
              title="Hide"
              disabled={busy}
              onClick={() => handleAction(() => window.api.setStatus(movie.id, 'hidden'))}
            >
              ⊘
            </button>
          </>
        ) : null}
        {(state.status === 'seen' || state.status === 'hidden') ? (
          <button
            className="btn-ghost"
            title="Move back to unseen"
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
