import type { MovieStatus } from '@shared/types'

const LABELS: Record<MovieStatus, string> = {
  unseen: 'Unseen',
  downloading: 'Downloading',
  downloaded: 'Downloaded',
  seen: 'Seen',
  hidden: 'Hidden'
}

export function StatusBadge({ status }: { status: MovieStatus }): JSX.Element {
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>
}
