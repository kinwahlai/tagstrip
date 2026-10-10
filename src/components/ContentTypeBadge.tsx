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

// `boxed` is for the header, where the tag sits beside the filename: there it
// has to stand apart from the name and say that it describes the page on
// screen, not the file. In a list of pages neither is in doubt.
export function ContentTypeBadge({
  contentType,
  boxed = false,
}: {
  contentType: Page['contentType']
  boxed?: boolean
}) {
  return (
    <span
      className={`tag mono ${TAG_CLASS[contentType]}${boxed ? ' tag-boxed' : ''}`}
      style={{ fontSize: '10.5px' }}
      title={boxed ? `This page: ${contentType}` : undefined}
    >
      {contentType}
    </span>
  )
}
