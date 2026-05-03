import { useState } from 'react'
import type { Topic } from '@shared/types'
import { useTopMovies } from '../hooks/useMovies'
import { useDownloadProgress } from '../hooks/useDownloads'
import { MovieCard } from '../components/MovieCard'
import { DisplayModeToggle } from '../contexts/DisplayMode'

export function Top100View({ topic }: { topic: Topic }): JSX.Element {
  const { movies, loading, error, refresh, pollNow } = useTopMovies(topic.id)
  const progress = useDownloadProgress(refresh)
  const [polling, setPolling] = useState(false)

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
          <p>If this persists, open Settings, add your TMDB API key, then click Refresh now.</p>
        </div>
      ) : null}

      <div className="list">
        {movies.map((card) => (
          <MovieCard
            key={card.movie.id}
            card={card}
            progress={progress[card.movie.id]}
            onChanged={refresh}
          />
        ))}
      </div>
    </section>
  )
}
