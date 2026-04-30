import { useState } from 'react'
import { Top100View } from './views/Top100'
import { SettingsView } from './views/Settings'

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
        {tab === 'settings' && <SettingsView />}
        {(tab === 'unseen' || tab === 'library' || tab === 'seen') && (
          <section className="view">
            <header className="view-header">
              <h2>{TABS.find((t) => t.id === tab)?.label}</h2>
            </header>
            <p className="empty">Coming up next milestone.</p>
          </section>
        )}
      </main>
    </div>
  )
}
