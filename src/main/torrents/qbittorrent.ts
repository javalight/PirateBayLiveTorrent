// Minimal qBittorrent Web API v2 client.
// Spec: https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)

export interface QbitInfo {
  hash: string
  name: string
  state: string
  progress: number
  save_path: string
  content_path: string
  size: number
  dlspeed: number
}

export class QbitError extends Error {}

export class QbittorrentClient {
  private cookie: string | null = null

  constructor(
    private host: string,
    private username: string,
    private password: string
  ) {
    this.host = host.replace(/\/$/, '')
  }

  private url(path: string): string {
    return `${this.host}${path}`
  }

  async login(): Promise<void> {
    const body = new URLSearchParams({ username: this.username, password: this.password })
    const res = await fetch(this.url('/api/v2/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: this.host
      },
      body: body.toString()
    })
    const text = await res.text()
    if (!res.ok || text.trim() !== 'Ok.') {
      throw new QbitError(`qBittorrent login failed: ${res.status} ${text}`)
    }
    const setCookie = res.headers.get('set-cookie') ?? ''
    const sid = /SID=([^;]+)/.exec(setCookie)?.[1]
    if (!sid) throw new QbitError('qBittorrent login: no SID cookie returned')
    this.cookie = `SID=${sid}`
  }

  private async authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    if (!this.cookie) await this.login()
    const headers = new Headers(init.headers)
    if (this.cookie) headers.set('Cookie', this.cookie)
    headers.set('Referer', this.host)
    const res = await fetch(this.url(path), { ...init, headers })
    if (res.status === 403) {
      // Cookie expired → re-login once.
      this.cookie = null
      await this.login()
      const retryHeaders = new Headers(init.headers)
      if (this.cookie) retryHeaders.set('Cookie', this.cookie)
      retryHeaders.set('Referer', this.host)
      return fetch(this.url(path), { ...init, headers: retryHeaders })
    }
    return res
  }

  async addMagnet(
    magnet: string,
    savePath: string,
    opts: { sequentialDownload?: boolean; firstLastPiecePrio?: boolean } = {}
  ): Promise<void> {
    const form = new URLSearchParams()
    form.set('urls', magnet)
    form.set('savepath', savePath)
    form.set('paused', 'false')
    if (opts.sequentialDownload) form.set('sequentialDownload', 'true')
    if (opts.firstLastPiecePrio) form.set('firstLastPiecePrio', 'true')

    const res = await this.authedFetch('/api/v2/torrents/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    })
    const text = await res.text()
    if (!res.ok || text.trim() !== 'Ok.') {
      throw new QbitError(`qBittorrent addMagnet failed: ${res.status} ${text}`)
    }
  }

  async info(hashes: string[]): Promise<QbitInfo[]> {
    const params = new URLSearchParams()
    if (hashes.length > 0) params.set('hashes', hashes.map((h) => h.toLowerCase()).join('|'))
    const res = await this.authedFetch(`/api/v2/torrents/info?${params.toString()}`)
    if (!res.ok) throw new QbitError(`qBittorrent info failed: ${res.status}`)
    return (await res.json()) as QbitInfo[]
  }

  async test(): Promise<void> {
    await this.login()
  }
}

const COMPLETED_STATES = new Set(['uploading', 'stalledUP', 'pausedUP', 'queuedUP', 'forcedUP'])

export function isComplete(info: QbitInfo): boolean {
  return COMPLETED_STATES.has(info.state) || info.progress >= 1
}
