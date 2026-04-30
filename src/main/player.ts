import { shell } from 'electron'
import { readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.m4v', '.webm', '.wmv', '.flv', '.mpg', '.mpeg', '.ts'])

export async function openInDefaultApp(filePath: string): Promise<void> {
  const target = resolveTarget(filePath)
  const err = await shell.openPath(target)
  if (err) throw new Error(`shell.openPath failed: ${err}`)
}

/** If the path is a folder, pick the largest video file inside (recursively, one level). */
function resolveTarget(p: string): string {
  try {
    const stat = statSync(p)
    if (!stat.isDirectory()) return p
  } catch {
    return p
  }

  const candidates: Array<{ path: string; size: number }> = []
  for (const name of readdirSync(p)) {
    const full = join(p, name)
    try {
      const s = statSync(full)
      if (s.isDirectory()) {
        for (const inner of readdirSync(full)) {
          const innerPath = join(full, inner)
          if (VIDEO_EXTS.has(extname(inner).toLowerCase())) {
            candidates.push({ path: innerPath, size: statSync(innerPath).size })
          }
        }
      } else if (VIDEO_EXTS.has(extname(name).toLowerCase())) {
        candidates.push({ path: full, size: s.size })
      }
    } catch {
      /* skip unreadable entries */
    }
  }

  if (candidates.length === 0) return p
  return candidates.sort((a, b) => b.size - a.size)[0]!.path
}
