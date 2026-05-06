import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ListMoviesArg, MovieListItem } from '@shared/api'
import { useDownloadProgress } from '../hooks/useDownloads'
import { MovieGrid } from '../components/MovieGrid'
import { DisplayModeToggle } from '../contexts/DisplayMode'
import { LayoutModeToggle } from '../contexts/LayoutMode'

export function FilteredView({
  title,
  emptyText,
  query,
  searchable = false
}: {
  title: string
  emptyText: string
  query: ListMoviesArg
  searchable?: boolean
}): JSX.Element {
  const [items, setItems] = useState<MovieListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const refresh = useCallback(() => {
    setLoading(true)
    window.api
      .listMovies(query)
      .then((rows) => {
        setItems(rows)
        setError(null)
      })
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [query])

  useEffect(() => {
    refresh()
    const offTop = window.api.onTopUpdated(refresh)
    return offTop
  }, [refresh])

  const progress = useDownloadProgress(refresh)

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.trim().toLowerCase()
    return items.filter((it) => it.movie.title.toLowerCase().includes(q))
  }, [items, search])

  return (
    <section className="view">
      <header className="view-header">
        <h2>{title}</h2>
        <div className="view-header-right">
          <LayoutModeToggle />
          <DisplayModeToggle />
          {searchable && (
            <input
              type="search"
              className="search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <span className="hint">{loading ? 'Loading…' : `${filtered.length} movies`}</span>
        </div>
      </header>

      {error ? <div className="error">Error: {error}</div> : null}

      {!loading && filtered.length === 0 ? (
        <div className="empty">{search ? 'No matches.' : emptyText}</div>
      ) : null}

      <MovieGrid items={filtered} progress={progress} onChanged={refresh} />
    </section>
  )
}
