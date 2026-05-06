import { useEffect, useState } from 'react'
import type { MovieListItem } from '@shared/api'
import { useDownloadProgress } from '../hooks/useDownloads'
import { MovieGrid } from '../components/MovieGrid'
import { CATEGORY_GROUPS } from '../categories'
import { DisplayModeToggle } from '../contexts/DisplayMode'
import { LayoutModeToggle } from '../contexts/LayoutMode'

export function SearchView({ initialQuery }: { initialQuery?: string }): JSX.Element {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [category, setCategory] = useState<number | ''>('')
  const [results, setResults] = useState<MovieListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runSearch = async (q: string, cat: number | ''): Promise<void> => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await window.api.findTorrents(q.trim(), cat === '' ? null : Number(cat))
      setResults(r)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    await runSearch(query, category)
  }

  // Auto-search when arriving from a card's search button (initialQuery
  // changes whenever the route's initialQuery does — App makes each
  // entry distinct via sameRoute so re-clicking the same card re-runs).
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setQuery(initialQuery)
      void runSearch(initialQuery, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  const refresh = async (): Promise<void> => {
    if (!query.trim()) return
    try {
      const r = await window.api.findTorrents(query.trim(), category === '' ? null : Number(category))
      setResults(r)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const progress = useDownloadProgress(refresh)

  return (
    <section className="view">
      <header className="view-header">
        <h2>Search torrents</h2>
        <div className="view-header-right">
          <LayoutModeToggle />
          <DisplayModeToggle />
        </div>
      </header>

      <form className="search-form" onSubmit={submit}>
        <input
          className="search-input"
          autoFocus
          placeholder="Type anything — movie, show, song, app, book…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Any category</option>
          {CATEGORY_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} (cat {c.id})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="submit" className="btn primary" disabled={loading || !query.trim()}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error ? <div className="error">{error}</div> : null}

      {results.length === 0 && !loading && query ? (
        <p className="hint">No results yet — hit Search.</p>
      ) : null}

      {results.length > 0 ? (
        <p className="hint" style={{ marginBottom: 16 }}>
          {results.length} results — same buttons as everywhere else (Trailer, Download, ★, ✓, ⊘, …)
        </p>
      ) : null}

      <MovieGrid items={results} progress={progress} onChanged={refresh} />
    </section>
  )
}
