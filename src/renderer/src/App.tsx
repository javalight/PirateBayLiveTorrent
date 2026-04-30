import { useMemo, useState } from 'react'
import type { ListMoviesArg } from '@shared/api'
import { Top100View } from './views/Top100'
import { SettingsView } from './views/Settings'
import { FilteredView } from './views/Filtered'

type Tab = 'top100' | 'unseen' | 'library' | 'seen' | 'settings'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'top100', label: 'Top 100' },
  { id: 'unseen', label: 'Unseen' },
  { id: 'library', label: 'Library' },
  { id: 'seen', label: 'Seen' },
  { id: 'settings', label: 'Settings' }
]

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('top100')

  const unseenQuery = useMemo<ListMoviesArg>(
    () => ({ statuses: ['unseen'], inTopOnly: true, sort: 'rank' }),
    []
  )
  const libraryQuery = useMemo<ListMoviesArg>(
    () => ({ excludeStatuses: ['hidden'], sort: 'title' }),
    []
  )
  const seenQuery = useMemo<ListMoviesArg>(
    () => ({ statuses: ['seen', 'downloaded'], sort: 'seen_at' }),
    []
  )

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">PirateBay Live</div>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`nav-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="content">
        {tab === 'top100' && <Top100View category={201} />}
        {tab === 'unseen' && (
          <FilteredView
            title="Unseen — Top 100"
            emptyText="Nothing unseen in the current Top 100. Either you've watched everything or the first poll hasn't completed yet."
            query={unseenQuery}
          />
        )}
        {tab === 'library' && (
          <FilteredView
            title="Library"
            emptyText="Library is empty. Wait for the first poll to populate it."
            query={libraryQuery}
            searchable
          />
        )}
        {tab === 'seen' && (
          <FilteredView
            title="Seen pile"
            emptyText="No seen movies yet. Download or mark something as seen and it'll appear here."
            query={seenQuery}
          />
        )}
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
