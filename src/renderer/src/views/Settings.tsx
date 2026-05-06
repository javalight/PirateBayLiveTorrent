import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/settings'

export function SettingsView(): JSX.Element {
  const [s, setS] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState<{
    downloadDir: string
    pollIntervalMin: number
    autoMarkSeenOnDownload: boolean
    streamWhileDownloading: boolean
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [openStatus, setOpenStatus] = useState<string | null>(null)

  useEffect(() => {
    window.api.getSettings().then((v) => {
      setS(v)
      setDraft({
        downloadDir: v.downloadDir,
        pollIntervalMin: v.pollIntervalMin,
        autoMarkSeenOnDownload: v.autoMarkSeenOnDownload,
        streamWhileDownloading: v.streamWhileDownloading
      })
    })
  }, [])

  if (!s || !draft) return <section className="view"><p>Loading…</p></section>

  const save = async (): Promise<void> => {
    setSaving(true)
    setMsg(null)
    try {
      const next = await window.api.updateSettings({
        downloadDir: draft.downloadDir,
        pollIntervalMin: draft.pollIntervalMin,
        autoMarkSeenOnDownload: draft.autoMarkSeenOnDownload,
        streamWhileDownloading: draft.streamWhileDownloading
      })
      setS(next)
      setMsg('Saved.')
    } catch (err: unknown) {
      setMsg(`Error: ${String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="view">
      <header className="view-header">
        <h2>Settings</h2>
      </header>

      <div className="settings-form">
        <fieldset>
          <legend>Library</legend>
          <label>
            <span>Download folder</span>
            <div className="input-with-button">
              <input
                value={draft.downloadDir}
                onChange={(e) => setDraft({ ...draft, downloadDir: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                title="Open folder in Finder"
                aria-label="Open folder in Finder"
                onClick={() => {
                  setOpenStatus('opening')
                  window.api
                    .openPath(draft.downloadDir)
                    .then(() => setOpenStatus('opened'))
                    .catch((err: unknown) => setOpenStatus(`error: ${String(err)}`))
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                </svg>
              </button>
            </div>
            {openStatus ? <span className="hint inline-hint">{openStatus}</span> : null}
          </label>
          <label>
            <span>Poll every (min)</span>
            <input
              type="number"
              min={5}
              max={360}
              value={draft.pollIntervalMin}
              onChange={(e) => setDraft({ ...draft, pollIntervalMin: Number(e.target.value) })}
            />
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={draft.autoMarkSeenOnDownload}
              onChange={(e) => setDraft({ ...draft, autoMarkSeenOnDownload: e.target.checked })}
            />
            <span>Mark as seen automatically when download completes</span>
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={draft.streamWhileDownloading}
              onChange={(e) => setDraft({ ...draft, streamWhileDownloading: e.target.checked })}
            />
            <span>Stream while downloading (prioritize the largest file — Play button appears at 5%)</span>
          </label>
        </fieldset>

        <fieldset>
          <legend>About metadata</legend>
          <p className="hint" style={{ margin: 0 }}>
            Posters and plot summaries come from Wikipedia, free, no account needed. Each card is looked up the first time it scrolls into view, then cached locally so it loads instantly next time.
          </p>
        </fieldset>

        <div className="form-actions">
          <button className="btn primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {msg ? <span className="hint">{msg}</span> : null}
        </div>
      </div>
    </section>
  )
}
