import { useState } from 'react'
import type { FoundTorrent } from '@shared/api'

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

const CATEGORY_OPTIONS: Array<{ id: number | ''; label: string }> = [
  { id: '', label: 'Any' },
  { id: 200, label: 'Video — All' },
  { id: 201, label: 'Movies' },
  { id: 207, label: 'HD Movies' },
  { id: 211, label: 'UHD Movies' },
  { id: 205, label: 'TV shows' },
  { id: 208, label: 'HD TV' },
  { id: 100, label: 'Audio — All' },
  { id: 101, label: 'Music' },
  { id: 300, label: 'Applications' },
  { id: 400, label: 'Games' },
  { id: 600, label: 'Other (E-books / Comics / etc)' }
]

export function SearchView(): JSX.Element {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<number | ''>('')
  const [results, setResults] = useState<FoundTorrent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set())

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await window.api.findTorrents(query.trim(), category === '' ? null : Number(category))
      setResults(r)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const download = async (t: FoundTorrent): Promise<void> => {
    try {
      await window.api.downloadMagnet({ infoHash: t.infoHash, name: t.name, magnet: t.magnet })
      setDownloaded((s) => new Set([...s, t.infoHash]))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section className="view">
      <header className="view-header">
        <h2>Search torrents</h2>
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
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.id === '' ? 'any' : c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn primary" disabled={loading || !query.trim()}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error ? <div className="error">{error}</div> : null}

      <p className="hint" style={{ marginTop: 16 }}>
        {results.length > 0
          ? `${results.length} results — sorted by qBittorrent. Downloads go to your default folder.`
          : !loading && query
            ? 'No results yet — hit Search.'
            : ''}
      </p>

      <div className="list">
        {results.map((t) => (
          <article key={t.infoHash} className="row">
            <div className="row-main">
              <div className="row-rank row-rank-empty">cat {t.category}</div>
              <div className="row-title-block">
                <h3 className="row-title" title={t.name}>{t.name}</h3>
                <div className="row-secondary">
                  <div className="row-meta">
                    <span>{formatSize(t.size)}</span>
                    <span>{t.seeders} seed</span>
                    <span>{t.leechers} leech</span>
                    {t.imdb ? <span>{t.imdb}</span> : null}
                  </div>
                  <div className="row-subtitle" title={t.name}>{t.name}</div>
                </div>
              </div>
              <div className="row-actions">
                {downloaded.has(t.infoHash) ? (
                  <span className="badge badge-downloaded">Sent to qBit</span>
                ) : (
                  <button className="btn-action" onClick={() => void download(t)}>Download</button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
