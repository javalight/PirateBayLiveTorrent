import { useState } from 'react'
import { useTopMovies } from '../hooks/useMovies'
import { useDownloadProgress } from '../hooks/useDownloads'
import { MovieCard } from '../components/MovieCard'

export function Top100View({ category }: { category: number }): JSX.Element {
  const { movies, loading, error, refresh, pollNow } = useTopMovies(category)
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

  return (
    <section className="view">
      <header className="view-header">
        <h2>Top 100 — Movies</h2>
        <button className="btn refresh-btn" onClick={() => void handleRefresh()} disabled={busy}>
          {busy ? <span className="spinner" /> : null}
          {busy ? 'Refreshing…' : 'Refresh now'}
        </button>
      </header>

      {error ? <div className="error">Error: {error}</div> : null}

      {!loading && movies.length === 0 ? (
        <div className="empty">
          <p>No movies yet — the first poll may still be running.</p>
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
