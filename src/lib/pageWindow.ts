// Which page numbers the toolbar shows, as 0-based indices with null for a gap.
// Past seven pages it is always exactly seven slots, so the strip keeps its
// width as you page through and the buttons do not slide under the cursor.
export function pageWindow(pageIndex: number, pageCount: number): (number | null)[] {
  if (pageCount <= 0) return []
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index)

  const last = pageCount - 1
  if (pageIndex <= 3) return [0, 1, 2, 3, 4, null, last]
  if (pageIndex >= pageCount - 4) return [0, null, last - 4, last - 3, last - 2, last - 1, last]
  return [0, null, pageIndex - 1, pageIndex, pageIndex + 1, null, last]
}
