import { addAutoStyledLabel, createSchema } from '../db/labelSchemas'
import { createProject } from '../db/projects'
import { addPdfDocument } from '../db/docs'

// The audience for this tool has a bootstrapping problem: the documents they
// would naturally test it on are exactly the ones they are not allowed to put
// anywhere. So one is supplied — a fictional utility bill, marked SPECIMEN on
// its face, with a real text layer so "Suggest text" demonstrates the exact-text
// path rather than falling straight to OCR. Its PostScript source is in
// docs/sample-document.ps.
//
// It is fetched from this app's own origin, like the OCR model weights and the
// pdf.js worker. Nothing here reaches a third party.
const SAMPLE_PDF = 'sample/northgate-energy-statement.pdf'
const SAMPLE_FILENAME = 'northgate_energy_statement.pdf'

// Names only: colours and hotkeys come from the same auto-assignment the label
// editor uses, so the sample always demonstrates what a user would actually get
// rather than a hand-picked set that quietly drifts from it.
const SAMPLE_LABELS = [
  'account_holder',
  'address_line_1',
  'address_line_2',
  'postcode',
  'statement_date',
]

export interface SampleProject {
  projectId: string
  docId: string
}

export async function createSampleProject(
  onProgress?: (pagesProcessed: number, pageCount: number) => void,
): Promise<SampleProject> {
  // Resolved against baseURI so it survives the relative build base, which is
  // what lets the same bundle work from a domain root or a Pages subpath.
  // An HTTP status is actionable; a bare fetch rejection is not — the browser
  // gives "Failed to fetch" and nothing else, which tells the reader nothing
  // about where to look. Say what was being read and from where.
  let response: Response
  try {
    response = await fetch(new URL(SAMPLE_PDF, document.baseURI))
  } catch {
    throw new Error(
      `Could not read the bundled sample document at "${SAMPLE_PDF}". It ships with the app, so ` +
        `this usually means the file is missing from the build rather than a network problem.`,
    )
  }
  if (!response.ok) {
    throw new Error(
      `Could not read the bundled sample document at "${SAMPLE_PDF}" (HTTP ${response.status}).`,
    )
  }
  const file = new File([await response.blob()], SAMPLE_FILENAME, { type: 'application/pdf' })

  const schemaId = await createSchema('Proof of address')
  for (const name of SAMPLE_LABELS) {
    await addAutoStyledLabel(schemaId, name)
  }
  const projectId = await createProject('Sample — proof of address', schemaId)
  const docId = await addPdfDocument(projectId, file, onProgress)
  return { projectId, docId }
}
