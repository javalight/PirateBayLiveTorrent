// Spawns and supervises a `transmission-daemon` child process and exposes
// an RPC client to it. Bundling rationale: WebTorrent (pure JS) cannot
// reliably reach traditional BitTorrent swarms on UDP-restricted networks,
// so we drive a real libtorrent-class client via its HTTP RPC.

import { spawn, ChildProcess, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createServer, AddressInfo } from 'node:net'
import { join } from 'node:path'
import { app } from 'electron'
import { TransmissionRpc } from './transmission-rpc.js'

let proc: ChildProcess | null = null
let rpc: TransmissionRpc | null = null
let starting: Promise<TransmissionRpc> | null = null

const SEARCH_PATHS = [
  '/opt/homebrew/bin/transmission-daemon', // Apple Silicon brew
  '/usr/local/bin/transmission-daemon', // Intel brew
  '/usr/bin/transmission-daemon',
  '/opt/local/bin/transmission-daemon' // MacPorts
]

const findFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as AddressInfo).port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })

const resolveBinary = (): string | null => {
  // 1. Bundled binary in production builds (electron-builder extraResources).
  const resourcesPath = (process as { resourcesPath?: string }).resourcesPath
  if (resourcesPath) {
    const bundled = join(resourcesPath, 'bin', 'transmission-daemon')
    if (existsSync(bundled)) return bundled
  }
  // 2. Common install paths.
  for (const p of SEARCH_PATHS) {
    if (existsSync(p)) return p
  }
  // 3. PATH fallback (will throw if `which` finds nothing).
  try {
    const onPath = execFileSync('/usr/bin/which', ['transmission-daemon'], { encoding: 'utf8' }).trim()
    if (onPath && existsSync(onPath)) return onPath
  } catch {
    /* not on PATH */
  }
  return null
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function waitForReady(client: TransmissionRpc, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastErr: unknown
  while (Date.now() < deadline) {
    try {
      await client.sessionGet()
      return
    } catch (err) {
      lastErr = err
      await wait(200)
    }
  }
  throw new Error(`Transmission daemon never became ready: ${String(lastErr)}`)
}

const BINARY_NOT_FOUND_MSG = `transmission-daemon binary not found.

Install it with Homebrew (one-time):

    brew install transmission-cli

Then quit and relaunch the app.`

export async function startDaemon(): Promise<TransmissionRpc> {
  if (rpc) return rpc
  if (starting) return starting

  starting = (async () => {
    const binary = resolveBinary()
    if (!binary) throw new Error(BINARY_NOT_FOUND_MSG)

    const profileDir = join(app.getPath('userData'), 'transmission')
    mkdirSync(profileDir, { recursive: true })

    const port = await findFreePort()
    const peerPort = await findFreePort()
    console.log(`[transmission] starting daemon (binary=${binary}, rpc=${port}, peer=${peerPort})`)

    const child = spawn(
      binary,
      [
        '-f', // foreground; do not daemonize
        '-T', // disable RPC auth (we're on localhost, OS-isolated)
        '-p',
        String(port),
        '-P',
        String(peerPort), // random peer port so orphans never block new launches
        '-g',
        profileDir,
        '--rpc-bind-address',
        '127.0.0.1'
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )

    child.stdout?.on('data', (d: Buffer) => {
      const s = d.toString().trim()
      if (s) console.log('[transmission]', s)
    })
    child.stderr?.on('data', (d: Buffer) => {
      const s = d.toString().trim()
      if (s) console.warn('[transmission]', s)
    })
    child.on('exit', (code, signal) => {
      console.log(`[transmission] exited (code=${code}, signal=${signal})`)
      proc = null
      rpc = null
      starting = null
    })

    proc = child
    const client = new TransmissionRpc('127.0.0.1', port)

    try {
      await waitForReady(client)
    } catch (err) {
      child.kill('SIGTERM')
      throw err
    }

    const session = await client.sessionGet()
    console.log(`[transmission] connected — daemon v${session.version}, rpc v${session['rpc-version']}`)

    rpc = client
    return client
  })()

  try {
    return await starting
  } finally {
    starting = null
  }
}

/**
 * Gracefully stop the daemon and wait for it to actually exit so its
 * `.resume` files get flushed. Without this, Electron quits faster than
 * Transmission can persist state, and downloads restart from 0% next launch.
 */
export async function stopDaemon(timeoutMs = 8_000): Promise<void> {
  const child = proc
  proc = null
  rpc = null
  starting = null
  if (!child) return

  console.log('[transmission] stopping daemon (graceful)')
  await new Promise<void>((resolve) => {
    let done = false
    const finish = (msg: string): void => {
      if (done) return
      done = true
      console.log(`[transmission] ${msg}`)
      resolve()
    }
    child.once('exit', () => finish('daemon exited cleanly'))
    try {
      child.kill('SIGTERM')
    } catch {
      finish('already gone')
      return
    }
    setTimeout(() => {
      if (done) return
      try {
        child.kill('SIGKILL')
      } catch {
        /* already dead */
      }
      finish(`did not exit within ${timeoutMs}ms — SIGKILLed`)
    }, timeoutMs)
  })
}

export async function getRpc(): Promise<TransmissionRpc> {
  if (rpc) return rpc
  return startDaemon()
}
