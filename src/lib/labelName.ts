// Label names feed exported JSON keys and Label Studio's `value` fields, where
// spaces are awkward to work with. The name field converts whitespace to
// underscores as you type rather than rejecting it on save, so the correction
// is invisible instead of an error to dismiss.
export function spacesToUnderscores(value: string): string {
  return value.replace(/\s+/g, '_')
}
