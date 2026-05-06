import { createContext, useContext, type ReactNode } from 'react'

interface NavigationApi {
  searchFor: (query: string) => void
}

const Ctx = createContext<NavigationApi | null>(null)

export function NavigationProvider({
  value,
  children
}: {
  value: NavigationApi
  children: ReactNode
}): JSX.Element {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNavigation(): NavigationApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNavigation must be used inside <NavigationProvider>')
  return v
}
