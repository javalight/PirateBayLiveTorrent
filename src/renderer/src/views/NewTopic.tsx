import { useState } from 'react'
import type { CreateTopicArg } from '@shared/api'
import type { Topic } from '@shared/types'

interface CategoryGroup {
  group: string
  cats: Array<{ id: number; label: string }>
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    group: 'Video',
    cats: [
      { id: 200, label: 'All Video' },
      { id: 201, label: 'Movies' },
      { id: 207, label: 'HD — Movies' },
      { id: 211, label: 'UHD / 4K — Movies' },
      { id: 202, label: 'Movies DVDR' },
      { id: 209, label: '3D' },
      { id: 210, label: 'CAM / TS' },
      { id: 205, label: 'TV shows' },
      { id: 208, label: 'HD — TV shows' },
      { id: 212, label: 'UHD / 4K — TV shows' },
      { id: 203, label: 'Music videos' },
      { id: 204, label: 'Movie clips' },
      { id: 206, label: 'Handheld' },
      { id: 299, label: 'Video — Other' }
    ]
  },
  {
    group: 'Audio',
    cats: [
      { id: 100, label: 'All Audio' },
      { id: 101, label: 'Music' },
      { id: 104, label: 'FLAC' },
      { id: 102, label: 'Audio books' },
      { id: 103, label: 'Sound clips' },
      { id: 199, label: 'Audio — Other' }
    ]
  },
  {
    group: 'Applications',
    cats: [
      { id: 300, label: 'All Applications' },
      { id: 301, label: 'Windows' },
      { id: 302, label: 'Mac' },
      { id: 303, label: 'UNIX' },
      { id: 304, label: 'Handheld' },
      { id: 305, label: 'iOS (iPad / iPhone)' },
      { id: 306, label: 'Android' },
      { id: 399, label: 'Other OS' }
    ]
  },
  {
    group: 'Games',
    cats: [
      { id: 400, label: 'All Games' },
      { id: 401, label: 'PC' },
      { id: 402, label: 'Mac' },
      { id: 403, label: 'PSx' },
      { id: 404, label: 'XBOX360' },
      { id: 405, label: 'Wii' },
      { id: 406, label: 'Handheld' },
      { id: 407, label: 'iOS (iPad / iPhone)' },
      { id: 408, label: 'Android' },
      { id: 499, label: 'Games — Other' }
    ]
  },
  {
    group: 'Porn',
    cats: [
      { id: 500, label: 'All Porn' },
      { id: 501, label: 'Movies' },
      { id: 505, label: 'HD — Movies' },
      { id: 507, label: 'UHD / 4K — Movies' },
      { id: 502, label: 'Movies DVDR' },
      { id: 506, label: 'Movie clips' },
      { id: 503, label: 'Pictures' },
      { id: 504, label: 'Games' },
      { id: 599, label: 'Porn — Other' }
    ]
  },
  {
    group: 'Other',
    cats: [
      { id: 600, label: 'All Other' },
      { id: 601, label: 'E-books' },
      { id: 602, label: 'Comics' },
      { id: 603, label: 'Pictures' },
      { id: 604, label: 'Covers' },
      { id: 605, label: 'Physibles' },
      { id: 699, label: 'Other — Other' }
    ]
  }
]


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
