// Minimal fetch wrapper with timeout + retry on transient errors.
// Uses Node's built-in fetch (available in Electron 28+ / Node 18+).

export interface FetchJsonOptions {
  signal?: AbortSignal
  timeoutMs?: number
  retries?: number
  searchParams?: Record<string, string>
}

const TRANSIENT_STATUSES = new Set([502, 503, 504])

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

export async function fetchJson<T = unknown>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const retries = opts.retries ?? 2
  const timeoutMs = opts.timeoutMs ?? 15_000

  const finalUrl = opts.searchParams
    ? `${url}?${new URLSearchParams(opts.searchParams).toString()}`
    : url

  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
    try {
      const res = await fetch(finalUrl, { signal: controller.signal })
      if (!res.ok) {
        if (TRANSIENT_STATUSES.has(res.status) && attempt < retries) {
          await sleep(2 ** attempt * 250)
          continue
        }
        throw new HttpError(res.status, `${res.status} ${res.statusText} for ${finalUrl}`)
      }
      return (await res.json()) as T
    } catch (err) {
      lastErr = err
      if (err instanceof HttpError) throw err
      if (attempt >= retries) throw err
      await sleep(2 ** attempt * 250)
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr ?? new Error('unreachable')
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
