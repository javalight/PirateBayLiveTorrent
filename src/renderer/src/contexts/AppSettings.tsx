import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppSettings } from '@shared/settings'

interface Ctx {
  settings: AppSettings | null
  /** Re-pull settings from main; call after Settings page saves. */
  refresh: () => void
}

const AppSettingsCtx = createContext<Ctx>({ settings: null, refresh: () => {} })

export function AppSettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  const refresh = useCallback(() => {
    void window.api.getSettings().then(setSettings)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return <AppSettingsCtx.Provider value={{ settings, refresh }}>{children}</AppSettingsCtx.Provider>
}

export const useAppSettings = (): AppSettings | null => useContext(AppSettingsCtx).settings
export const useRefreshAppSettings = (): (() => void) => useContext(AppSettingsCtx).refresh
