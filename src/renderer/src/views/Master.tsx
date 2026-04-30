import { useCallback, useEffect, useState } from 'react'
import type { TopicStats } from '@shared/types'

export function MasterView({
  onPick,
  onAddTopic
}: {
  onPick: (topicId: number) => void
  onAddTopic: () => void
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
          <button key={s.topic.id} className="topic-card" onClick={() => onPick(s.topic.id)}>
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
        ))}
      </div>
    </section>
  )
}
