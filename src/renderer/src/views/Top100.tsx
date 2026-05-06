import { useState } from 'react'
import type { Topic } from '@shared/types'
import { useTopMovies } from '../hooks/useMovies'
import { useDownloadProgress } from '../hooks/useDownloads'
import { MovieCard } from '../components/MovieCard'
import { MoviePosterCard } from '../components/MoviePosterCard'
import { DisplayModeToggle } from '../contexts/DisplayMode'
import { LayoutModeToggle, useLayoutMode } from '../contexts/LayoutMode'

export function Top100View({ topic }: { topic: Topic }): JSX.Element {
  const { movies, loading, error, refresh, pollNow } = useTopMovies(topic.id)
  const progress = useDownloadProgress(refresh)
  const [polling, setPolling] = useState(false)
  const { mode } = useLayoutMode()

  const handleRefresh = async (): Promise<void> => {
    setPolling(true)
    try {
      await pollNow()
    } finally {
      setPolling(false)
    }
  }

  const busy = polling || loading
  const headerLabel = topic.sourceKind === 'top100' ? 'Top 100' : 'Latest'

  return (
    <section className="view">
      <header className="view-header">
        <h2>
          {topic.icon ? <span style={{ marginRight: 8 }}>{topic.icon}</span> : null}
          {topic.name} — {headerLabel}
        </h2>
        <div className="view-header-right">
          <LayoutModeToggle />
          <DisplayModeToggle />
          <button className="btn refresh-btn" onClick={() => void handleRefresh()} disabled={busy}>
            {busy ? <span className="spinner" /> : null}
            {busy ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </header>

      {error ? <div className="error">Error: {error}</div> : null}

      {!loading && movies.length === 0 ? (
        <div className="empty">
          <p>Nothing here yet — first poll may still be running.</p>
          <p>Hit “Refresh now” to fetch the latest Top 100.</p>
        </div>
      ) : null}

      <div className={mode === 'grid' ? 'poster-grid' : 'list'}>
        {movies.map((card) =>
          mode === 'grid' ? (
            <MoviePosterCard
              key={card.movie.id}
              card={card}
              progress={progress[card.movie.id]}
              onChanged={refresh}
            />
          ) : (
            <MovieCard
              key={card.movie.id}
              card={card}
              progress={progress[card.movie.id]}
              onChanged={refresh}
            />
          )
        )}
      </div>
    </section>
  )
}
