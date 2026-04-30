import { useCallback, useEffect, useState } from 'react'
import type { TopMovieCard } from '@shared/api'

export interface UseMoviesResult {
  movies: TopMovieCard[]
  loading: boolean
  error: string | null
  refresh: () => void
  pollNow: () => Promise<void>
}

export function useTopMovies(category: number): UseMoviesResult {
  const [movies, setMovies] = useState<TopMovieCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    window.api
      .topMovies(category)
      .then((m) => {
        setMovies(m)
        setError(null)
      })
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [category])

  useEffect(() => {
    refresh()
    const off = window.api.onTopUpdated(() => refresh())
    return off
  }, [refresh])

  const pollNow = useCallback(async () => {
    await window.api.pollNow()
    refresh()
  }, [refresh])

  return { movies, loading, error, refresh, pollNow }
}
