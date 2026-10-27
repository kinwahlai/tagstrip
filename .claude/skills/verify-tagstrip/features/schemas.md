# Schemas

A label schema is the set of fields (labels) annotated on documents. Each label has a name, a colour and an optional hotkey; the screen lists labels with usage counts. Schemas are created, renamed, exported and deleted (deleting is refused while a project uses it).

## Sub-features

- create: new schema by name
- add-label: add a label (name, colour, hotkey)
- edit-label: edit or delete a label
- rename-schema, delete-schema, export-schema

## How to get to it

- First run: "Schema name" field and "Create" on the first-run page (id `first-schema-name`).
- Rail: button "Label schemas" opens the overview; "New schema" form there (id `new-schema-name`, button "Create"). A schema row's name button opens its detail.
- Rail: a schema entry opens SchemaDetail (heading "Labels · N").

## Driving it

No scripted journey yet; drive with Playwright MCP. The first four steps are scripted inside `suggest-text-ocr` (scripts/drive.mjs) and can be copied.

1. Fill `getByLabel('Schema name')`, click button "Create". Result: detail view, heading "Labels · 0".
2. Fill `getByLabel('Name', {exact:true})` (id `label-name`), optionally `Hotkey` select (id `label-hotkey`), click "Add label". Result: heading "Labels · 1", row in the table.
3. Row buttons are named from the label (see LabelEditor.tsx lines ~357-370); editing switches the form to "Edit label" with "Save label"/"Cancel".
4. Overview row buttons: `Export <name>`, `Rename <name>`, `Delete <name>` (aria-labels); dialogs are RenameDialog and ConfirmDialog.

## Gotchas

- An empty name is rejected with a `role="alert"` message; check it appears rather than assuming.
- The first-run page only exists while there are no schemas and no projects; after that "Label schemas" in the rail is the entry.
- Hotkeys are one of a-z, 0-9 and also trigger label selection on the canvas.
