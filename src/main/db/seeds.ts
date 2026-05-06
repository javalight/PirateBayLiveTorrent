import { Dal } from './dal.js'

interface DefaultTopic {
  name: string
  icon: string
  category: number
}

// apibay numeric category ids — see src/renderer/src/categories.ts.
const DEFAULTS: DefaultTopic[] = [
  { name: 'Top 100 Movies', icon: '🎬', category: 201 },
  { name: 'Top 100 TV Shows', icon: '📺', category: 205 },
  { name: 'Top 100 Games', icon: '🎮', category: 400 }
]

/**
 * On first launch (empty topics table), seed the three default Top-100
 * topics. Counts archived topics too — if the user explicitly archived
 * everything we don't want to keep re-creating them.
 */
export function seedDefaultTopics(dal: Dal): void {
  const existing = dal.listTopics(true)
  if (existing.length > 0) return

  for (const t of DEFAULTS) {
    dal.createTopic({
      name: t.name,
      icon: t.icon,
      sourceKind: 'top100',
      sourceParam: String(t.category),
      sourceCategory: t.category
    })
  }
  console.log(`[seeds] created ${DEFAULTS.length} default topics`)
}
