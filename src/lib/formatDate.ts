// The tables show when something was last touched. "today, 14:02" is what you
// actually need when you are working through a batch — an absolute date only
// starts earning its space once the thing is old enough that the day matters.
// Locale is pinned to en-GB rather than the browser's, so the tables read the
// same everywhere and the day-month order never flips.
const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const THIS_YEAR = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const OTHER_YEAR = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function daysApart(a: Date, b: Date): number {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((startOf(b) - startOf(a)) / 86_400_000)
}

export function formatWhen(timestamp: number, now: number = Date.now()): string {
  const then = new Date(timestamp)
  const today = new Date(now)
  const time = TIME.format(then)

  const days = daysApart(then, today)
  if (days === 0) return `today, ${time}`
  if (days === 1) return `yesterday, ${time}`
  if (then.getFullYear() === today.getFullYear()) return `${THIS_YEAR.format(then)}, ${time}`
  return `${OTHER_YEAR.format(then)}, ${time}`
}
