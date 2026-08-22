import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { aggregate } from './stats'
import type { Aggregates } from './stats'
import type { Page } from '../db/types'

const EMPTY: Aggregates = {
  regionsByLabel: new Map(),
  lastUsedByLabel: new Map(),
  regionsByDoc: new Map(),
  docIdsByProject: new Map(),
  contentTypeByDoc: new Map(),
}

// Four index reads for the whole workspace, aggregated once. Every table then
// reads its numbers out of the returned maps, so nothing is recomputed per row
// and adding a row to a table costs a map lookup rather than a query.
export function useWorkspaceStats(): Aggregates {
  return (
    useLiveQuery(async () => {
      const [labelKeys, annotationDocKeys, docKeys, pageKeys] = await Promise.all([
        db.annotations.orderBy('[labelId+updatedAt]').keys(),
        db.annotations.orderBy('documentId').keys(),
        db.docs.orderBy('[projectId+id]').keys(),
        db.pages.orderBy('[documentId+contentType]').keys(),
      ])
      return aggregate({
        labelKeys: labelKeys as unknown as [string, number][],
        annotationDocKeys: annotationDocKeys as unknown as string[],
        docKeys: docKeys as unknown as [string, string][],
        pageKeys: pageKeys as unknown as [string, Page['contentType']][],
      })
    }, []) ?? EMPTY
  )
}

// navigator.storage.estimate() is not universally available, and where it is it
// is deliberately imprecise. Returning null rather than a zero keeps the rail
// from stating a figure the browser never gave us.
export function useDiskUsage(): number | null {
  const [bytes, setBytes] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!navigator.storage?.estimate) return

    navigator.storage
      .estimate()
      .then((estimate) => {
        if (!cancelled && typeof estimate.usage === 'number') setBytes(estimate.usage)
      })
      .catch(() => {
        // An estimate we cannot get is not an error worth surfacing; the rail
        // simply says nothing about disk instead.
      })

    return () => {
      cancelled = true
    }
  }, [])

  return bytes
}
