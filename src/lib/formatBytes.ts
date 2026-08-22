// Disk figures are read from navigator.storage.estimate(), which returns bytes
// and is only ever an estimate — browsers deliberately fuzz it. Rounding to one
// decimal at MB and above matches that precision rather than implying more.
const UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1000) return `${Math.round(bytes)} bytes`

  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000
    unit++
  }
  return `${value >= 100 ? Math.round(value) : Number(value.toFixed(1))} ${UNITS[unit]}`
}
