// Retakes docs/screenshot.png, the picture at the top of the README: the
// bundled sample document on the annotate screen with its five regions drawn
// and transcribed. Run it whenever that screen's layout changes.
//
//   pnpm run dev                        # in another terminal, leave it running
//   pnpm run screenshot
//
// The first time, Playwright needs its browser: `pnpm exec playwright install
// chromium`. CHROMIUM can instead name a Chromium or chrome-headless-shell
// binary to use. APP_URL (default http://localhost:5173/) and OUT (default
// docs/screenshot.png) do the obvious.
//
// It starts from empty browser storage every time, so it never touches or
// depends on projects in your own browser.
//
// Two runs are the same picture but not the same bytes: the regions list on
// the right comes out in a different order each time.
const path = require('node:path')
const { chromium } = require('playwright')

const APP_URL = process.env.APP_URL || 'http://localhost:5173/'
const OUT = process.env.OUT || path.join(__dirname, 'screenshot.png')

// Where each value sits on the sample page, as fractions of the page's width
// and height: [label, left, top, right, bottom, the text it should read back].
// These follow docs/sample-document.ps; if that layout moves, so must these.
const REGIONS = [
  ['account_holder', 0.092, 0.2555, 0.226, 0.2785, 'A. MORGAN'],
  ['address_line_1', 0.092, 0.2945, 0.29, 0.3155, '48 Rusholme Grove'],
  ['address_line_2', 0.092, 0.3325, 0.201, 0.3535, 'Fallowfield'],
  ['postcode', 0.092, 0.399, 0.187, 0.422, 'M14 6QT'],
  // Last, so it is the one left selected in the picture.
  ['statement_date', 0.569, 0.2555, 0.728, 0.2785, '14 August 2026'],
]

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM || undefined,
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Load the sample document' }).click()
  await page.getByTestId('zoom-readout').waitFor()
  await page.waitForTimeout(1500) // the page image and the open-time fit settle

  const stage = page.locator('[data-testid="canvas-scroll-area"] .select-none').first()
  const labels = page.getByRole('group', { name: 'Labels' })
  for (const [name, left, top, right, bottom] of REGIONS) {
    await labels.getByRole('button', { name }).click()
    const box = await stage.boundingBox()
    await page.mouse.move(box.x + left * box.width, box.y + top * box.height)
    await page.mouse.down()
    await page.mouse.move(box.x + right * box.width, box.y + bottom * box.height, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(300)
  }

  // Fill every transcription the way a user would, from the PDF's text layer.
  const suggest = page.getByRole('button', { name: 'Suggest text' })
  for (let i = 0; i < (await suggest.count()); i++) {
    await suggest.nth(i).click()
    await page.waitForTimeout(1500)
  }

  // Suggesting moves the selection; put it back on the last region drawn.
  const [, left, top, right, bottom] = REGIONS[REGIONS.length - 1]
  const box = await stage.boundingBox()
  await page.mouse.click(
    box.x + ((left + right) / 2) * box.width,
    box.y + ((top + bottom) / 2) * box.height,
  )
  await page.mouse.move(700, 880) // off the controls, so nothing is caught hovered
  await page.waitForTimeout(500)

  // A box that misses its text falls back to OCR and reads back something
  // else, and the picture would then show a wrong transcription. Refuse.
  const got = await page
    .locator('.ts-inspector-regions input')
    .evaluateAll((inputs) => inputs.map((input) => input.value).sort())
  const want = REGIONS.map((region) => region[5]).sort()
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    await browser.close()
    throw new Error(
      `Transcriptions read back as ${JSON.stringify(got)}, expected ${JSON.stringify(want)}. ` +
        'A region no longer sits on its text: adjust REGIONS. Nothing was written.',
    )
  }

  await page.screenshot({ path: OUT })
  await browser.close()
  console.log(`Wrote ${OUT}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
