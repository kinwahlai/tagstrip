import { addLabel, createSchema } from '../db/labelSchemas'
import { createProject } from '../db/projects'
import { addPdfDocument } from '../db/docs'
import { LABEL_COLORS } from './labelColors'

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

const SAMPLE_LABELS = [
  { name: 'account_holder', hotkey: '1' },
  { name: 'address_line_1', hotkey: '2' },
  { name: 'address_line_2', hotkey: '3' },
  { name: 'postcode', hotkey: '4' },
  { name: 'statement_date', hotkey: '5' },
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
  for (const [i, label] of SAMPLE_LABELS.entries()) {
    await addLabel(schemaId, { ...label, color: LABEL_COLORS[i].hex })
  }
  const projectId = await createProject('Sample — proof of address', schemaId)
  const docId = await addPdfDocument(projectId, file, onProgress)
  return { projectId, docId }
}
