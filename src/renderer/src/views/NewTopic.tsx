import { useState } from 'react'
import type { CreateTopicArg } from '@shared/api'
import type { Topic } from '@shared/types'
import { CATEGORY_GROUPS } from '../categories'



export function NewTopic({
  onClose,
  onSaved,
  editing,
  onArchive
}: {
  onClose: () => void
  onSaved: (topicId: number) => void
  editing?: Topic
  onArchive?: (topicId: number) => void
}): JSX.Element {
  const isEdit = !!editing
  const initialKind: 'top100' | 'search' = editing?.sourceKind ?? 'top100'
  const initialCategory =
    editing?.sourceKind === 'top100' ? Number(editing.sourceParam) : 201
  const initialSearchQuery = editing?.sourceKind === 'search' ? editing.sourceParam : ''
  const initialSearchCategory =
    editing?.sourceKind === 'search' && editing.sourceCategory != null ? editing.sourceCategory : ''

  const [kind, setKind] = useState<'top100' | 'search'>(initialKind)
  const [name, setName] = useState(editing?.name ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? '🎬')
  const [category, setCategory] = useState<number>(initialCategory)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [searchCategory, setSearchCategory] = useState<number | ''>(initialSearchCategory)
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

      const t = isEdit
        ? await window.api.updateTopic(editing!.id, arg)
        : await window.api.createTopic(arg)
      onSaved(t.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleArchive = (): void => {
    if (!editing || !onArchive) return
    if (!confirm(`Archive "${editing.name}"? It will be hidden from the topic list. Movies and history are kept.`)) return
    onArchive(editing.id)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{isEdit ? 'Edit topic' : 'New topic'}</h3>

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
          {isEdit && onArchive ? (
            <button type="button" className="btn btn-danger-text" onClick={handleArchive} disabled={busy}>
              Archive
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
