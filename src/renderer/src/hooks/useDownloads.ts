import { useEffect, useState } from 'react'
import type { DownloadProgressPayload } from '@shared/ipc'

export type ProgressMap = Record<number, DownloadProgressPayload>

export function useDownloadProgress(onDone?: () => void): ProgressMap {
  const [progress, setProgress] = useState<ProgressMap>({})

  useEffect(() => {
    return window.api.onDownloadProgress((p) => {
      setProgress((prev) => ({ ...prev, [p.movieId]: p }))
      if (p.done) onDone?.()
    })
  }, [onDone])

  return progress
}
