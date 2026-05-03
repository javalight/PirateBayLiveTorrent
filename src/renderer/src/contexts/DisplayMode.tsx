import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type DisplayMode = 'release' | 'title'

interface DisplayModeContext {
  mode: DisplayMode
  toggle: () => void
  setMode: (m: DisplayMode) => void
}

const STORAGE_KEY = 'pbl:displayMode'

const Ctx = createContext<DisplayModeContext>({
  mode: 'release',
  toggle: () => {},
  setMode: () => {}
})

export function DisplayModeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [mode, setModeState] = useState<DisplayMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'title' ? 'title' : 'release'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const setMode = useCallback((m: DisplayMode) => setModeState(m), [])
  const toggle = useCallback(() => setModeState((m) => (m === 'release' ? 'title' : 'release')), [])

  return <Ctx.Provider value={{ mode, toggle, setMode }}>{children}</Ctx.Provider>
}

export const useDisplayMode = (): DisplayModeContext => useContext(Ctx)

export function DisplayModeToggle(): JSX.Element {
  const { mode, toggle } = useDisplayMode()
  return (
    <button
      className="display-toggle"
      title={
        mode === 'release'
          ? 'Showing release names — click to show clean movie titles'
          : 'Showing clean movie titles — click to show release names'
      }
      onClick={toggle}
    >
      <span className={`display-seg ${mode === 'release' ? 'active' : ''}`}>Release</span>
      <span className={`display-seg ${mode === 'title' ? 'active' : ''}`}>Title</span>
    </button>
  )
}
