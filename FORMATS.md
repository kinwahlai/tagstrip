# File formats

TagStrip has no server and no shared backend, so every hand-off between people or machines happens
through a downloaded file. This documents the two native JSON formats it produces and reads —
useful if you want to write your own tooling against them, or just understand what you're sharing
before you send a file to a teammate.

The third export option is different in kind, so it is documented separately: **Label Studio
JSON** emits the shape Label Studio's own JSON export produces, so that a pipeline already reading
that format can read TagStrip's output without a converter in between. It is one-way — TagStrip
cannot read it back — and it references page images without containing them.

### It has been checked against their own tooling

The shape was reverse-engineered from a real export, so it was described as best-effort for a long
time. It has since been run through `label-studio-converter`, Label Studio's own package, which
read it and produced correct COCO, Pascal VOC, YOLO and JSON_MIN from it. Coordinates were checked
by hand: a box at `x: 0.09, y: 0.26, w: 0.3, h: 0.03` on a 595x842 page came out as COCO
`[53.5, 218.9, 178.5, 25.3]` and YOLO `0.24 0.275 0.3 0.03`, both exactly right.

Reproduce it with:

```bash
uv venv lsv && uv pip install --python lsv/bin/python label-studio-converter
# then, with a TagStrip Label Studio JSON export and a labeling config that
# declares the tag names you exported under:
lsv/bin/python -c "from label_studio_converter import Converter;   Converter(open('config.xml').read(), project_dir='.')   .convert_to_coco('export.json', 'out', is_dir=False)"
```

`src/lib/__fixtures__/labelStudioExport.verified.json` is the exact output that passed, and
`labelStudioExport.verified.test.ts` pins the export to it — so if the format drifts, the
verification has to be redone rather than assumed to still hold.

Two things you will see and should not worry about. Their converter logs `Unknown label type or
labels are empty` for the bare `rectangle` and `textarea` entries: it takes the geometry from the
`labels` entries, which carry both the box and the name, and ignores the rest. And the conversion
needs a labeling config declaring your tag names, because the config is what tells it which
`from_name` means what.

### If you convert onward, watch what you lose

COCO, Pascal VOC and YOLO are **detection** formats: a box and a class, nothing else. Every one of
them silently drops the per-box transcription — verified, not assumed. For a pure detector that is
fine. For document understanding, where the field's _value_ is usually the point, it throws away
the half of the data TagStrip exists to collect. Label Studio JSON and JSON_MIN both keep it, as
does TagStrip's own native format.

## Schema export (`*-tagstrip-schema.json`)

Produced by the **Export** button next to a schema on the Schemas screen, and read back by
**Import schema…** on that same screen. This is the lightweight format for handing a team's label
definitions to a teammate's browser — it carries no documents, no annotations, and no project, so
it's a good fit for "set the label list up once, everyone else just imports it" workflows.

```json
{
  "version": 1,
  "exportedAt": 1750000000000,
  "labelSchema": {
    "name": "KYC fields",
    "labels": [
      { "id": "l1", "name": "Full name", "color": "#ef4444", "hotkey": "1" },
      { "id": "l2", "name": "Date of birth", "color": "#3b82f6", "hotkey": "2" }
    ]
  }
}
```

- `version` — format version; TagStrip refuses to import a file with a version it doesn't
  recognize rather than guessing at an incompatible shape.
- `labelSchema.labels[].id` is carried along for reference but is **not reused on import** — a
  fresh id is generated per label so importing the same file twice (or into a browser that already
  has schemas) never collides with an existing one. `hotkey` is optional (`"1"`–`"9"`).

## Project export (`*-tagstrip-export.json`)

Produced by **Export JSON** on a project's page, and read back by **Import project…** on the
Projects screen. This is the full backup/restore/hand-off format: one project, its label schema,
every uploaded document (original file bytes included, base64-encoded), and every annotation with
its transcription text. Because the source files are embedded, this file can be large — a
multi-page PDF project's export is roughly the size of its source PDFs, times ~1.33 for base64
overhead.

```json
{
  "version": 1,
  "exportedAt": 1750000000000,
  "project": { "name": "KYC batch 1" },
  "labelSchema": {
    "name": "KYC fields",
    "labels": [{ "id": "l1", "name": "Full name", "color": "#ef4444", "hotkey": "1" }]
  },
  "documents": [
    {
      "filename": "id-card-1.pdf",
      "sourceType": "pdf",
      "pageCount": 1,
      "notes": "",
      "sourceBase64": "JVBERi0xLjQK...",
      "sourceMimeType": "application/pdf",
      "pages": [
        {
          "pageIndex": 0,
          "width": 1240,
          "height": 1754,
          "contentType": "scanned",
          "contentTypeOverridden": false
        }
      ],
      "annotations": [
        {
          "pageIndex": 0,
          "labelId": "l1",
          "x": 0.12,
          "y": 0.08,
          "width": 0.4,
          "height": 0.05,
          "text": "Jane Doe",
          "ocrSuggested": false
        }
      ]
    }
  ]
}
```

- Annotation geometry (`x`/`y`/`width`/`height`) is normalized to 0–1 relative to the page, not
  pixels — so it survives being re-rendered at a different resolution on import.
- `annotations[].labelId` refers to a label's `id` _within this same file's_ `labelSchema.labels`,
  not to any id already in the destination browser's database — like the schema export, all ids
  (schema, labels, project, documents, annotations) are regenerated on import. An annotation whose
  `labelId` doesn't match any label in the file's own schema is silently dropped on import, since
  there's nothing to draw it against.
- `sourceType: "pdf"` documents carry the whole original PDF in `sourceBase64`, re-rasterized
  lazily on import just like a fresh upload. `sourceType: "image"` documents carry that one image;
  `pageCount` is always `1` for images.
- `textLayer` (omitted from the example above) is carried per-page when pdf.js extracted one at
  upload time, so exact (non-OCR) "Suggest text" keeps working after a round-trip without
  re-parsing the PDF.

## Compatibility

Both formats are versioned independently (`version: 1` for each, right now). A file's version is
checked strictly on import — an older or newer TagStrip build reading a file whose version it
doesn't recognize reports a specific "unsupported version" error rather than importing a
partially-understood file.
