import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ListMoviesArg } from '@shared/api'
import type { Topic } from '@shared/types'
import { Top100View } from './views/Top100'
import { SettingsView } from './views/Settings'
import { FilteredView } from './views/Filtered'
import { MasterView } from './views/Master'
import { NewTopic } from './views/NewTopic'

type Tab = 'top100' | 'unseen' | 'favorites' | 'downloads' | 'seen' | 'hidden'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'top100', label: 'Top 100' },
  { id: 'unseen', label: 'Unseen' },
  { id: 'favorites', label: '★ Favorites' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'seen', label: 'Seen' },
  { id: 'hidden', label: 'Hidden' }
]

type Route = { kind: 'master' } | { kind: 'topic'; topicId: number; tab: Tab } | { kind: 'settings' }

export function App(): JSX.Element {
  const [route, setRoute] = useState<Route>({ kind: 'master' })
  const [topics, setTopics] = useState<Topic[]>([])
  const [creating, setCreating] = useState(false)
  const [topicSwitcherOpen, setTopicSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement | null>(null)

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

  const goMaster = (): void => setRoute({ kind: 'master' })
  const goSettings = (): void => setRoute({ kind: 'settings' })
  const goTopic = (topicId: number, tab: Tab = 'unseen'): void => {
    setRoute({ kind: 'topic', topicId, tab })
    setTopicSwitcherOpen(false)
  }

  const currentTopic =
    route.kind === 'topic' ? topics.find((t) => t.id === route.topicId) ?? null : null

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="topic-switcher" ref={switcherRef}>
          <button
            className="topic-switcher-btn"
            onClick={() => setTopicSwitcherOpen((v) => !v)}
          >
            <span className="topic-switcher-icon">{currentTopic?.icon ?? '🏠'}</span>
            <span className="topic-switcher-name">
              {currentTopic ? currentTopic.name : 'All topics'}
            </span>
            <span className="topic-switcher-chevron">▾</span>
          </button>
          {topicSwitcherOpen && (
            <div className="topic-menu">
              <button className="topic-menu-item" onClick={goMaster}>
                <span>🏠</span> All topics
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
              <button className="topic-menu-item topic-menu-add" onClick={() => { setCreating(true); setTopicSwitcherOpen(false) }}>
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
                onClick={() => setRoute({ kind: 'topic', topicId: route.topicId, tab: t.id })}
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
        {route.kind === 'master' && (
          <MasterView onPick={(id) => goTopic(id)} onAddTopic={() => setCreating(true)} />
        )}
        {route.kind === 'settings' && <SettingsView />}
        {route.kind === 'topic' && currentTopic && (
          <TopicView topic={currentTopic} tab={route.tab} />
        )}
        {route.kind === 'topic' && !currentTopic && (
          <section className="view"><p className="empty">Topic not found.</p></section>
        )}
      </main>

      {creating && (
        <NewTopic
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            reloadTopics()
            goTopic(id)
          }}
        />
      )}
    </div>
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
