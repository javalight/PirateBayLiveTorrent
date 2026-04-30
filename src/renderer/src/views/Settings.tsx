import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/settings'

export function SettingsView(): JSX.Element {
  const [s, setS] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState<{
    tmdbApiKey: string
    qbitHost: string
    qbitUsername: string
    qbitPassword: string
    downloadDir: string
    pollIntervalMin: number
    autoMarkSeenOnDownload: boolean
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [openStatus, setOpenStatus] = useState<string | null>(null)

  useEffect(() => {
    window.api.getSettings().then((v) => {
      setS(v)
      setDraft({
        tmdbApiKey: v.tmdb.apiKey ?? '',
        qbitHost: v.qbit.host,
        qbitUsername: v.qbit.username,
        qbitPassword: v.qbit.password ?? '',
        downloadDir: v.downloadDir,
        pollIntervalMin: v.pollIntervalMin,
        autoMarkSeenOnDownload: v.autoMarkSeenOnDownload
      })
    })
  }, [])

  if (!s || !draft) return <section className="view"><p>Loading…</p></section>

  const save = async (): Promise<void> => {
    setSaving(true)
    setMsg(null)
    try {
      const next = await window.api.updateSettings({
        tmdbApiKey: draft.tmdbApiKey || null,
        qbitHost: draft.qbitHost,
        qbitUsername: draft.qbitUsername,
        qbitPassword: draft.qbitPassword || null,
        downloadDir: draft.downloadDir,
        pollIntervalMin: draft.pollIntervalMin,
        autoMarkSeenOnDownload: draft.autoMarkSeenOnDownload
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
          <legend>TMDB</legend>
          <label>
            <span>API key</span>
            <input
              type="password"
              value={draft.tmdbApiKey}
              onChange={(e) => setDraft({ ...draft, tmdbApiKey: e.target.value })}
              placeholder="Get one at themoviedb.org/settings/api"
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>qBittorrent</legend>
          <label>
            <span>Host</span>
            <input
              value={draft.qbitHost}
              onChange={(e) => setDraft({ ...draft, qbitHost: e.target.value })}
              placeholder="http://localhost:8080"
            />
          </label>
          <label>
            <span>Username</span>
            <input
              value={draft.qbitUsername}
              onChange={(e) => setDraft({ ...draft, qbitUsername: e.target.value })}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={draft.qbitPassword}
              onChange={(e) => setDraft({ ...draft, qbitPassword: e.target.value })}
            />
          </label>
        </fieldset>

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
