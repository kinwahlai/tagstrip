import type { Doc } from '../db/types'

// Every document list reads in this order, so it never changes between a
// fresh import and a reload. Filename in natural order (p2 before p10, case
// ignored); same filename: import time, then id, so no tie is left to the
// random primary key.
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

export function sortDocs(docs: Doc[]): Doc[] {
  return [...docs].sort(
    (a, b) =>
      collator.compare(a.filename, b.filename) ||
      a.createdAt - b.createdAt ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}
