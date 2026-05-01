import { useCallback, useEffect, useState } from 'react'
import type { Topic, TopicStats } from '@shared/types'

export function MasterView({
  onPick,
  onAddTopic,
  onEditTopic
}: {
  onPick: (topicId: number) => void
  onAddTopic: () => void
  onEditTopic: (topic: Topic) => void
}): JSX.Element {
  const [stats, setStats] = useState<TopicStats[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingAll, setRefreshingAll] = useState(false)

  const refresh = useCallback(() => {
    setLoading(true)
    window.api
      .topicStats()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
    return window.api.onTopUpdated(refresh)
  }, [refresh])

  const handleRefreshAll = async (): Promise<void> => {
    setRefreshingAll(true)
    try {
      await window.api.pollNow()
    } finally {
      setRefreshingAll(false)
    }
  }

  return (
    <section className="view">
      <header className="view-header">
        <h2>Topics</h2>
        <div className="view-header-right">
          <button className="btn" onClick={() => void handleRefreshAll()} disabled={refreshingAll}>
            {refreshingAll ? 'Refreshing all…' : 'Refresh all'}
          </button>
          <button className="btn primary" onClick={onAddTopic}>+ New topic</button>
        </div>
      </header>

      {loading ? <p className="hint">Loading…</p> : null}

      {!loading && stats.length === 0 ? (
        <div className="empty">No topics yet. Hit “+ New topic” to add one.</div>
      ) : null}

      <div className="topic-grid">
        {stats.map((s) => (
          <div key={s.topic.id} className="topic-card-wrap">
            <button className="topic-card" onClick={() => onPick(s.topic.id)}>
              <div className="topic-icon">{s.topic.icon ?? '📁'}</div>
              <div className="topic-name">{s.topic.name}</div>
              <div className="topic-source">
                {s.topic.sourceKind === 'top100'
                  ? `Top 100 · cat ${s.topic.sourceParam}`
                  : `Search · "${s.topic.sourceParam}"`}
              </div>
              <div className="topic-stats">
                <span><strong>{s.unseen}</strong> unseen</span>
                <span><strong>{s.seen}</strong> seen</span>
                <span><strong>{s.favorites}</strong> ★</span>
                <span><strong>{s.inTopNow}</strong> ranked now</span>
              </div>
            </button>
            <button
              className="topic-edit"
              title="Edit topic"
              aria-label="Edit topic"
              onClick={(e) => {
                e.stopPropagation()
                onEditTopic(s.topic)
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
