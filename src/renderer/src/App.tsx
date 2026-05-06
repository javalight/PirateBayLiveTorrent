import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ListMoviesArg } from '@shared/api'
import type { Topic } from '@shared/types'
import { Top100View } from './views/Top100'
import { SettingsView } from './views/Settings'
import { FilteredView } from './views/Filtered'
import { MasterView } from './views/Master'
import { NewTopic } from './views/NewTopic'
import { SearchView } from './views/Search'
import { NavigationProvider } from './contexts/Navigation'

type Tab = 'top100' | 'unseen' | 'favorites' | 'downloads' | 'seen' | 'hidden'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'top100', label: 'Top 100' },
  { id: 'unseen', label: 'Unseen' },
  { id: 'favorites', label: '★ Favorites' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'seen', label: 'Seen' },
  { id: 'hidden', label: 'Hidden' }
]

type Route =
  | { kind: 'master' }
  | { kind: 'topic'; topicId: number; tab: Tab }
  | { kind: 'search'; initialQuery?: string }
  | { kind: 'downloads' }
  | { kind: 'settings' }

const sameRoute = (a: Route, b: Route): boolean => {
  if (a.kind !== b.kind) return false
  if (a.kind === 'topic' && b.kind === 'topic') {
    return a.topicId === b.topicId && a.tab === b.tab
  }
  if (a.kind === 'search' && b.kind === 'search') {
    return a.initialQuery === b.initialQuery
  }
  return true
}

interface NavState {
  route: Route
  history: Route[]
}

export function App(): JSX.Element {
  const [nav, setNav] = useState<NavState>({ route: { kind: 'master' }, history: [] })
  const { route, history } = nav
  const [topics, setTopics] = useState<Topic[]>([])
  const [editing, setEditing] = useState<{ kind: 'new' } | { kind: 'edit'; topic: Topic } | null>(null)
  const [topicSwitcherOpen, setTopicSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement | null>(null)

  // Single state object so route + history update atomically — avoids the
  // StrictMode double-invocation hazard of calling setHistory inside a
  // setRoute updater.
  const navigate = useCallback((next: Route): void => {
    setNav((cur) => {
      if (sameRoute(cur.route, next)) return cur
      return { route: next, history: [cur.route, ...cur.history].slice(0, 50) }
    })
  }, [])

  const goBack = useCallback((): void => {
    setNav((cur) => {
      if (cur.history.length === 0) return cur
      return { route: cur.history[0]!, history: cur.history.slice(1) }
    })
  }, [])

  // Cmd-[ / Cmd-Left = back, just like Safari / Finder.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && (e.key === '[' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        goBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goBack])

  useEffect(() => {
    if (!topicSwitcherOpen) return
    const onDocMouseDown = (e: MouseEvent): void => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setTopicSwitcherOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setTopicSwitcherOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [topicSwitcherOpen])

  const reloadTopics = useCallback(() => {
    window.api.listTopics().then(setTopics)
  }, [])

  useEffect(() => {
    reloadTopics()
  }, [reloadTopics])

  const goMaster = (): void => navigate({ kind: 'master' })
  const goSettings = (): void => navigate({ kind: 'settings' })
  const goSearch = (): void => {
    navigate({ kind: 'search' })
    setTopicSwitcherOpen(false)
  }
  const searchFor = useCallback((query: string): void => {
    const trimmed = query.trim()
    if (!trimmed) return
    navigate({ kind: 'search', initialQuery: trimmed })
    setTopicSwitcherOpen(false)
  }, [navigate])
  const goDownloads = (): void => {
    navigate({ kind: 'downloads' })
    setTopicSwitcherOpen(false)
  }
  const goTopic = (topicId: number, tab: Tab = 'unseen'): void => {
    navigate({ kind: 'topic', topicId, tab })
    setTopicSwitcherOpen(false)
  }

  const currentTopic =
    route.kind === 'topic' ? topics.find((t) => t.id === route.topicId) ?? null : null

  return (
    <NavigationProvider value={{ searchFor }}>
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-skull" aria-hidden>☠</span>
          <span className="brand-text">
            The<span className="brand-text-accent">PirateBay</span>
            <span className="brand-text-sub">Live Torrent</span>
          </span>
        </div>

        <div className="topic-switcher" ref={switcherRef}>
          <button
            className="topic-switcher-btn"
            onClick={() => setTopicSwitcherOpen((v) => !v)}
          >
            <span className="topic-switcher-icon">
              {currentTopic?.icon ??
                (route.kind === 'search'
                  ? '🔍'
                  : route.kind === 'downloads'
                    ? '⬇'
                    : route.kind === 'settings'
                      ? '⚙'
                      : '🏠')}
            </span>
            <span className="topic-switcher-name">
              {currentTopic
                ? currentTopic.name
                : route.kind === 'search'
                  ? 'Search torrents'
                  : route.kind === 'downloads'
                    ? 'All downloads'
                    : route.kind === 'settings'
                      ? 'Settings'
                      : 'All topics'}
            </span>
            <span className="topic-switcher-chevron">▾</span>
          </button>
          {topicSwitcherOpen && (
            <div className="topic-menu">
              <button className="topic-menu-item" onClick={goMaster}>
                <span>🏠</span> All topics
              </button>
              <button className="topic-menu-item" onClick={goSearch}>
                <span>🔍</span> Search torrents
              </button>
              <button className="topic-menu-item" onClick={goDownloads}>
                <span>⬇</span> All downloads
              </button>
              {topics.map((t) => (
                <button
                  key={t.id}
                  className={`topic-menu-item ${currentTopic?.id === t.id ? 'active' : ''}`}
                  onClick={() => goTopic(t.id, route.kind === 'topic' ? route.tab : 'unseen')}
                >
                  <span>{t.icon ?? '📁'}</span> {t.name}
                </button>
              ))}
              <button className="topic-menu-item topic-menu-add" onClick={() => { setEditing({ kind: 'new' }); setTopicSwitcherOpen(false) }}>
                + New topic
              </button>
            </div>
          )}
        </div>

        {route.kind === 'topic' && (
          <nav className="tab-nav">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`nav-item ${route.tab === t.id ? 'active' : ''}`}
                onClick={() => navigate({ kind: 'topic', topicId: route.topicId, tab: t.id })}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}

        <div className="sidebar-footer">
          <button className={`nav-item ${route.kind === 'settings' ? 'active' : ''}`} onClick={goSettings}>
            ⚙ Settings
          </button>
        </div>
      </aside>

      <main className="content">
        {history.length > 0 && (
          <button
            className="back-btn"
            onClick={goBack}
            title="Back (⌘[)"
            aria-label="Back"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Back</span>
          </button>
        )}
        {route.kind === 'master' && (
          <MasterView
            onPick={(id) => goTopic(id)}
            onAddTopic={() => setEditing({ kind: 'new' })}
            onEditTopic={(t) => setEditing({ kind: 'edit', topic: t })}
            onPickSearch={goSearch}
            onPickDownloads={goDownloads}
          />
        )}
        {route.kind === 'search' && <SearchView initialQuery={route.initialQuery} />}
        {route.kind === 'downloads' && (
          <FilteredView
            title="All downloads"
            emptyText="No downloads yet. Click Download on anything (Search, a topic, etc.) and it'll show up here."
            query={{ downloadActivityOnly: true, sort: 'activity' }}
            searchable
          />
        )}
        {route.kind === 'settings' && <SettingsView />}
        {route.kind === 'topic' && currentTopic && (
          <TopicView topic={currentTopic} tab={route.tab} />
        )}
        {route.kind === 'topic' && !currentTopic && (
          <section className="view"><p className="empty">Topic not found.</p></section>
        )}
      </main>

      {editing && (
        <NewTopic
          editing={editing.kind === 'edit' ? editing.topic : undefined}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            const wasEdit = editing.kind === 'edit'
            setEditing(null)
            reloadTopics()
            if (!wasEdit) goTopic(id)
          }}
          onArchive={(id) => {
            void window.api.archiveTopic(id).then(() => {
              setEditing(null)
              reloadTopics()
              goMaster()
            })
          }}
        />
      )}
    </div>
    </NavigationProvider>
  )
}

function TopicView({ topic, tab }: { topic: Topic; tab: Tab }): JSX.Element {
  const unseenQuery = useMemo<ListMoviesArg>(
    () => ({ topicId: topic.id, statuses: ['unseen'], sort: 'discovery' }),
    [topic.id]
  )
  const favoritesQuery = useMemo<ListMoviesArg>(
    () => ({ topicId: topic.id, favoritesOnly: true, sort: 'discovery' }),
    [topic.id]
  )
  const downloadsQuery = useMemo<ListMoviesArg>(
    () => ({ topicId: topic.id, downloadActivityOnly: true, sort: 'activity' }),
    [topic.id]
  )
  const seenQuery = useMemo<ListMoviesArg>(
    () => ({ topicId: topic.id, statuses: ['seen', 'downloaded'], sort: 'seen_at' }),
    [topic.id]
  )
  const hiddenQuery = useMemo<ListMoviesArg>(
    () => ({ topicId: topic.id, statuses: ['hidden'], sort: 'title' }),
    [topic.id]
  )

  if (tab === 'top100') return <Top100View topic={topic} />
  if (tab === 'unseen') {
    return (
      <FilteredView
        title={`${topic.name} — Unseen`}
        emptyText="Nothing unseen yet for this topic. Wait for the first poll, or add new sources."
        query={unseenQuery}
        searchable
      />
    )
  }
  if (tab === 'favorites') {
    return (
      <FilteredView
        title={`${topic.name} — Favorites`}
        emptyText="No favorites in this topic yet."
        query={favoritesQuery}
        searchable
      />
    )
  }
  if (tab === 'downloads') {
    return (
      <FilteredView
        title={`${topic.name} — Downloads`}
        emptyText="No download activity yet. Click Download on something and it'll show up here."
        query={downloadsQuery}
        searchable
      />
    )
  }
  if (tab === 'seen') {
    return (
      <FilteredView
        title={`${topic.name} — Seen`}
        emptyText="No seen movies in this topic yet."
        query={seenQuery}
        searchable
      />
    )
  }
  return (
    <FilteredView
      title={`${topic.name} — Hidden`}
      emptyText="Nothing hidden in this topic."
      query={hiddenQuery}
      searchable
    />
  )
}
