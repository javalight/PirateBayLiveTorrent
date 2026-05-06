import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type LayoutMode = 'list' | 'grid'

interface LayoutModeContext {
  mode: LayoutMode
  toggle: () => void
  setMode: (m: LayoutMode) => void
}

const STORAGE_KEY = 'pbl:layoutMode'

const Ctx = createContext<LayoutModeContext>({
  mode: 'list',
  toggle: () => {},
  setMode: () => {}
})

export function LayoutModeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [mode, setModeState] = useState<LayoutMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'grid' ? 'grid' : 'list'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const setMode = useCallback((m: LayoutMode) => setModeState(m), [])
  const toggle = useCallback(() => setModeState((m) => (m === 'list' ? 'grid' : 'list')), [])

  return <Ctx.Provider value={{ mode, toggle, setMode }}>{children}</Ctx.Provider>
}

export const useLayoutMode = (): LayoutModeContext => useContext(Ctx)

export function LayoutModeToggle(): JSX.Element {
  const { mode, toggle } = useLayoutMode()
  return (
    <button
      className="display-toggle"
      title={mode === 'list' ? 'Switch to poster grid' : 'Switch to list view'}
      onClick={toggle}
    >
      <span className={`display-seg ${mode === 'list' ? 'active' : ''}`}>≡ List</span>
      <span className={`display-seg ${mode === 'grid' ? 'active' : ''}`}>▦ Grid</span>
    </button>
  )
}
