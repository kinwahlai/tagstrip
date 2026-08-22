import { useSyncExternalStore } from 'react'

// The mockups are fixed 1440x900, so unlike every other value in this redesign
// these two numbers are ours rather than the designer's. They are placed where
// the layout actually breaks, not on conventional device sizes:
//   1024 — below this, rail (288) + documents (316) + a usable work surface no
//          longer fit, so the app becomes one column of work.
//    640 — below this, even a 56px rail strip is worth more as canvas, so the
//          rail leaves the flow entirely and opens as an overlay.
export type Breakpoint = 'narrow' | 'compact' | 'wide'

const NARROW = '(max-width: 639px)'
const COMPACT = '(max-width: 1023px)'

function subscribe(onChange: () => void): () => void {
  const queries = [window.matchMedia(NARROW), window.matchMedia(COMPACT)]
  queries.forEach((q) => q.addEventListener('change', onChange))
  return () => queries.forEach((q) => q.removeEventListener('change', onChange))
}

function getSnapshot(): Breakpoint {
  if (window.matchMedia(NARROW).matches) return 'narrow'
  if (window.matchMedia(COMPACT).matches) return 'compact'
  return 'wide'
}

// useSyncExternalStore rather than an effect: the width is external state that
// can change between render and commit, and reading it this way avoids the
// setState-in-effect cascade that pattern otherwise causes.
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'wide')
}
