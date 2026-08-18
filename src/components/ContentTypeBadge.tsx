import type { Page } from '../db/types'

const STYLES: Record<Page['contentType'], string> = {
  text: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  scanned: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  unknown: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

export function ContentTypeBadge({ contentType }: { contentType: Page['contentType'] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[contentType]}`}>
      {contentType}
    </span>
  )
}
