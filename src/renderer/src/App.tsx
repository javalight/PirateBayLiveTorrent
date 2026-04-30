import { useMemo, useState } from 'react'
import type { ListMoviesArg } from '@shared/api'
import { Top100View } from './views/Top100'
import { SettingsView } from './views/Settings'
import { FilteredView } from './views/Filtered'

type Tab = 'top100' | 'unseen' | 'favorites' | 'seen' | 'hidden' | 'settings'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'top100', label: 'Top 100' },
  { id: 'unseen', label: 'Unseen' },
  { id: 'favorites', label: '★ Favorites' },
  { id: 'seen', label: 'Seen' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'settings', label: 'Settings' }
]

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('top100')

  const unseenQuery = useMemo<ListMoviesArg>(
    () => ({ statuses: ['unseen'], sort: 'discovery' }),
    []
  )
  const favoritesQuery = useMemo<ListMoviesArg>(
    () => ({ favoritesOnly: true, sort: 'discovery' }),
    []
  )
  const seenQuery = useMemo<ListMoviesArg>(
    () => ({ statuses: ['seen', 'downloaded'], sort: 'seen_at' }),
    []
  )
  const hiddenQuery = useMemo<ListMoviesArg>(
    () => ({ statuses: ['hidden'], sort: 'title' }),
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
            title="Unseen"
            emptyText="Nothing unseen yet. Wait for the first poll, or move things back here from Seen / Hidden."
            query={unseenQuery}
            searchable
          />
        )}
        {tab === 'favorites' && (
          <FilteredView
            title="Favorites"
            emptyText="No favorites yet. Tap the ☆ on a movie to add it here."
            query={favoritesQuery}
            searchable
          />
        )}
        {tab === 'seen' && (
          <FilteredView
            title="Seen"
            emptyText="No seen movies yet. Download or mark something as seen and it'll appear here."
            query={seenQuery}
            searchable
          />
        )}
        {tab === 'hidden' && (
          <FilteredView
            title="Hidden"
            emptyText="Nothing hidden. Hit the eye icon on a card to dismiss something — it'll land here."
            query={hiddenQuery}
            searchable
          />
        )}
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
