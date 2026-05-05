// Minimal Transmission RPC client.
// Spec: https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md
import http from 'node:http'

export interface TransmissionTorrent {
  hashString: string
  name: string
  /** 0=stopped 1=check-pending 2=checking 3=download-pending 4=downloading 5=seed-pending 6=seeding */
  status: number
  percentDone: number
  rateDownload: number
  rateUpload: number
  peersConnected: number
  totalSize: number
  downloadDir: string
  metadataPercentComplete: number
  files: Array<{ name: string; length: number }>
}

interface RpcEnvelope<T> {
  result: string
  arguments: T
}

export class TransmissionRpc {
  private sessionId: string | null = null

  constructor(
    private readonly host: string,
    private readonly port: number
  ) {}

  private rawRequest(body: string, retried = false): Promise<{ status: number; headers: http.IncomingHttpHeaders; data: string }> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(body))
      }
      if (this.sessionId) headers['X-Transmission-Session-Id'] = this.sessionId

      const req = http.request(
        {
          host: this.host,
          port: this.port,
          path: '/transmission/rpc',
          method: 'POST',
          headers
        },
        (res) => {
          let data = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, data }))
        }
      )
      req.on('error', reject)
      req.write(body)
      req.end()

      // Defensive timeout — transmission usually responds in milliseconds.
      req.setTimeout(15_000, () => {
        req.destroy(new Error('Transmission RPC timed out'))
      })

      // unused but silences TS; retried plumbed for future expansion
      void retried
    })
  }

  private async request<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
    const body = JSON.stringify({ method, arguments: args })
    let res = await this.rawRequest(body)

    if (res.status === 409) {
      // Transmission requires the session ID in a header; it returns 409 the
      // first time and tells us the value to use. Cache + retry.
      const sid = res.headers['x-transmission-session-id']
      if (typeof sid !== 'string') throw new Error('Transmission RPC: 409 with no session ID')
      this.sessionId = sid
      res = await this.rawRequest(body)
    }

    if (res.status !== 200) {
      throw new Error(`Transmission RPC HTTP ${res.status}: ${res.data.slice(0, 200)}`)
    }

    const env = JSON.parse(res.data) as RpcEnvelope<T>
    if (env.result !== 'success') {
      throw new Error(`Transmission RPC error: ${env.result}`)
    }
    return env.arguments
  }

  async sessionGet(): Promise<{ version: string; 'rpc-version': number }> {
    return this.request('session-get')
  }

  async addMagnet(magnet: string, downloadDir: string): Promise<{ hashString: string; name: string }> {
    const r = await this.request<{
      'torrent-added'?: { hashString: string; name: string }
      'torrent-duplicate'?: { hashString: string; name: string }
    }>('torrent-add', { filename: magnet, 'download-dir': downloadDir })
    const t = r['torrent-added'] ?? r['torrent-duplicate']
    if (!t) throw new Error('Transmission torrent-add returned neither added nor duplicate')
    return t
  }

  async remove(hashes: string[], deleteLocal: boolean): Promise<void> {
    if (hashes.length === 0) return
    await this.request('torrent-remove', { ids: hashes, 'delete-local-data': deleteLocal })
  }

  async info(hashes: string[]): Promise<TransmissionTorrent[]> {
    const args: Record<string, unknown> = {
      fields: [
        'hashString',
        'name',
        'status',
        'percentDone',
        'rateDownload',
        'rateUpload',
        'peersConnected',
        'totalSize',
        'downloadDir',
        'metadataPercentComplete',
        'files'
      ]
    }
    if (hashes.length > 0) args.ids = hashes
    const r = await this.request<{ torrents: TransmissionTorrent[] }>('torrent-get', args)
    return r.torrents
  }

  async reannounce(hashes: string[]): Promise<void> {
    if (hashes.length === 0) return
    await this.request('torrent-reannounce', { ids: hashes })
  }

  async start(hashes: string[]): Promise<void> {
    if (hashes.length === 0) return
    await this.request('torrent-start', { ids: hashes })
  }

  /** Re-hash the data on disk for a torrent. Lets transmission discover
   *  pieces that were already downloaded in a prior session. */
  async verify(hashes: string[]): Promise<void> {
    if (hashes.length === 0) return
    await this.request('torrent-verify', { ids: hashes })
  }

  /** Force transmission to flush its in-memory state to disk now. */
  async sessionSaveNow(): Promise<void> {
    // session-close gracefully shuts down — we don't want that here.
    // Instead use session-set with a no-op that triggers a save side-effect.
    // Transmission writes resume data on most session-set calls.
    await this.request('session-set', {})
  }
}
