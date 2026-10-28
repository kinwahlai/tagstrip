import type { Annotation, Label } from '../db/types'

// A page's regions come out of IndexedDB in primary-key order, and keys are
// random UUIDs, so the list read in a different order on every page. Schema
// order makes every document read the same; within one label, draw order.
// A region whose label has left the schema goes last.
export function sortRegionsBySchema(regions: Annotation[], labels: Label[]): Annotation[] {
  const rank = new Map(labels.map((l, i) => [l.id, i]))
  const rankOf = (r: Annotation) => rank.get(r.labelId) ?? labels.length
  return [...regions].sort((a, b) => rankOf(a) - rankOf(b) || a.createdAt - b.createdAt)
}
