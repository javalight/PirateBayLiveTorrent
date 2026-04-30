import { useState } from 'react'
import type { CreateTopicArg } from '@shared/api'

const KNOWN_CATEGORIES: Array<{ id: number; label: string }> = [
  { id: 201, label: 'Movies' },
  { id: 207, label: 'Movies / HD' },
  { id: 202, label: 'Movies / DVDR' },
  { id: 209, label: 'Movies / 3D' },
  { id: 205, label: 'TV shows' },
  { id: 208, label: 'TV / HD' },
  { id: 200, label: 'All Video' }
]

export function NewTopic({
  onClose,
  onCreated
}: {
  onClose: () => void
  onCreated: (topicId: number) => void
}): JSX.Element {
  const [kind, setKind] = useState<'top100' | 'search'>('top100')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🎬')
  const [category, setCategory] = useState<number>(201)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCategory, setSearchCategory] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const arg: CreateTopicArg =
        kind === 'top100'
          ? {
              name: name.trim() || `Top 100 · cat ${category}`,
              icon,
              sourceKind: 'top100',
              sourceParam: String(category),
              sourceCategory: category
            }
          : {
              name: name.trim() || `Search · ${searchQuery}`,
              icon,
              sourceKind: 'search',
              sourceParam: searchQuery.trim(),
              sourceCategory: searchCategory === '' ? null : Number(searchCategory)
            }

      if (arg.sourceKind === 'search' && !arg.sourceParam) {
        throw new Error('Search query is required')
      }

      const t = await window.api.createTopic(arg)
      onCreated(t.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>New topic</h3>

        <fieldset>
          <legend>Source</legend>
          <label className="row">
            <input type="radio" name="kind" checked={kind === 'top100'} onChange={() => setKind('top100')} />
            <span>Top 100 from a TPB category (live ranked list)</span>
          </label>
          <label className="row">
            <input type="radio" name="kind" checked={kind === 'search'} onChange={() => setKind('search')} />
            <span>Custom search (find torrents by query)</span>
          </label>
        </fieldset>

        {kind === 'top100' && (
          <label>
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(Number(e.target.value))}>
              {KNOWN_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} (cat {c.id})
                </option>
              ))}
            </select>
          </label>
        )}

        {kind === 'search' && (
          <>
            <label>
              <span>Query</span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='e.g. "tarkovsky", "criterion 4k"'
                autoFocus
              />
            </label>
            <label>
              <span>Limit to category (optional)</span>
              <select
                value={searchCategory}
                onChange={(e) => setSearchCategory(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— any —</option>
                {KNOWN_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} (cat {c.id})
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label>
          <span>Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-generated if blank" />
        </label>
        <label>
          <span>Icon (emoji)</span>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
        </label>

        {error ? <div className="error">{error}</div> : null}

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
