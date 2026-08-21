import type { Page } from '../db/types'

// ContentTypeBadge prints the raw union value in lower case, so the tag does too
// — the word carries the meaning. The old blue/amber/slate has no equivalent in a
// single-accent system, so the design system's tag ramps stand in: a scanned page
// is the one that changes how Suggest text behaves, so it takes the accent.
const TAG_CLASS: Record<Page['contentType'], string> = {
  text: 'tag-neutral',
  scanned: 'tag-accent',
  unknown: 'tag-outline',
}

export function ContentTypeBadge({ contentType }: { contentType: Page['contentType'] }) {
  return (
    <span className={`tag mono ${TAG_CLASS[contentType]}`} style={{ fontSize: '10.5px' }}>
      {contentType}
    </span>
  )
}
