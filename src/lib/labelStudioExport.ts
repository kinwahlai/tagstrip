import { db } from '../db/db'
import { downloadJson } from './serialize'

// Reverse-engineered from a real Label Studio export sample, not their
// official schema docs (no access to those) — best-effort compatibility.
// See README for the "verify a re-import works on your Label Studio version"
// caveat this format ships under.

export interface LabelStudioExportOptions {
  bboxTagName: string
  labelTagName: string
  includeTranscription: boolean
  transcriptionTagName: string
}

export const DEFAULT_LABEL_STUDIO_OPTIONS: LabelStudioExportOptions = {
  bboxTagName: 'bbox',
  labelTagName: 'label',
  includeTranscription: false,
  transcriptionTagName: 'transcription',
}

interface LsResultEntry {
  id: string
  type: 'rectangle' | 'labels' | 'textarea'
  from_name: string
  to_name: string
  original_width: number
  original_height: number
  image_rotation: number
  value: Record<string, unknown>
}

export async function buildLabelStudioExport(
  projectId: string,
  options: LabelStudioExportOptions,
): Promise<unknown[]> {
  const project = await db.projects.get(projectId)
  if (!project) throw new Error('Project not found.')
  const schema = await db.labelSchemas.get(project.schemaId)
  if (!schema) throw new Error('This project’s label schema is missing.')
  const labelsById = new Map(schema.labels.map((l) => [l.id, l]))

  const docs = await db.docs.where('projectId').equals(projectId).sortBy('createdAt')

  const tasks: unknown[] = []
  let taskId = 0

  for (const doc of docs) {
    const pages = await db.pages.where('documentId').equals(doc.id).sortBy('pageIndex')

    for (const page of pages) {
      const annotations = await db.annotations
        .where('[documentId+pageIndex]')
        .equals([doc.id, page.pageIndex])
        .toArray()

      const result: LsResultEntry[] = []
      for (const annotation of annotations) {
        const label = labelsById.get(annotation.labelId)
        const value = {
          x: annotation.x * 100,
          y: annotation.y * 100,
          width: annotation.width * 100,
          height: annotation.height * 100,
          rotation: 0,
        }
        const shared = {
          id: annotation.id,
          to_name: 'image',
          original_width: page.width,
          original_height: page.height,
          image_rotation: 0,
        }

        result.push({
          ...shared,
          type: 'rectangle',
          from_name: options.bboxTagName,
          value,
        })
        result.push({
          ...shared,
          type: 'labels',
          from_name: options.labelTagName,
          value: { ...value, labels: [label?.name ?? 'unknown'] },
        })
        if (options.includeTranscription && annotation.text) {
          result.push({
            ...shared,
            type: 'textarea',
            from_name: options.transcriptionTagName,
            value: { ...value, text: [annotation.text] },
          })
        }
      }

      const imageName =
        doc.pageCount > 1
          ? `${doc.filename}#page-${page.pageIndex + 1}.png`
          : doc.filename.replace(/\.pdf$/i, '.png')

      tasks.push({
        id: taskId,
        data: { image: imageName },
        annotations: [
          {
            id: 0,
            completed_by: null,
            result,
            was_cancelled: false,
            ground_truth: false,
            lead_time: 0,
            prediction: {},
            result_count: result.length,
            unique_id: null,
            import_id: null,
            last_action: null,
            task: taskId,
            project: null,
            updated_by: null,
            parent_prediction: null,
            parent_annotation: null,
            last_created_by: null,
          },
        ],
        predictions: [],
        meta: { notes: doc.notes ?? '', contentType: page.contentType },
        inner_id: taskId + 1,
        total_annotations: 1,
        cancelled_annotations: 0,
        total_predictions: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        last_comment_updated_at: null,
        project: null,
        updated_by: null,
        comment_authors: [],
        drafts: [],
      })

      taskId += 1
    }
  }

  return tasks
}

export async function exportProjectToLabelStudio(
  projectId: string,
  options: LabelStudioExportOptions,
): Promise<void> {
  const project = await db.projects.get(projectId)
  const tasks = await buildLabelStudioExport(projectId, options)
  const filename = `${(project?.name ?? 'project').replace(/[^a-z0-9-_]+/gi, '_')}-label-studio.json`
  downloadJson(filename, tasks)
}
