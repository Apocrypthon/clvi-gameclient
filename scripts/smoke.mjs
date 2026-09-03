// Browser smoke test for the loop's VERIFY step.
//   npm run build && npm run preview -- --port 4173 &
//   npm i -D playwright   (optional dev-only dep; browsers ship with the image)
//   node scripts/smoke.mjs
// Drives a real press-and-hold dig on an iPhone-sized viewport and asserts the
// Holi reveal produced an artifact card with an energy estimate.
import { chromium, devices } from 'playwright'

const URL = process.env.SMOKE_URL ?? 'http://localhost:4173/'
const SHOT = process.env.SMOKE_SHOT ?? null

let failures = 0
function check(name, cond, detail = '') {
  if (!cond) failures++
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// The image ships browsers under PLAYWRIGHT_BROWSERS_PATH; if the installed
// playwright build expects a different revision, point it at the one on disk.
const EXECUTABLE = process.env.SMOKE_CHROME ?? null
const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {})
const context = await browser.newContext({ ...devices['iPhone 13'], isMobile: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
// The /map-events probe 404s until the backend is live — that is the designed
// fallback path (docs/STATE.md), not a failure.
const EXPECTED = /map-events/
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const text = m.text()
  if (EXPECTED.test(text) || (/404/.test(text) && /Failed to load resource/.test(text))) return
  errors.push(text)
})

await page.goto(URL, { waitUntil: 'load' })
await page.waitForTimeout(900)

check('page has a canvas', (await page.locator('#stage').count()) === 1)
const stats = await page.evaluate(() => window.StrataMap.stats())
check('StrataMap.applyEvent is exposed', await page.evaluate(() => typeof window.StrataMap.applyEvent === 'function'))
check('grid built from the boundary', stats.inside > 3000, `${stats.inside} cells inside ${stats.cols}x${stats.rows}`)

// The mock feed should land within a poll.
await page.waitForFunction(() => window.StrataMap.stats().restored > 0, null, { timeout: 8000 })
check('mock feed restored cells', (await page.evaluate(() => window.StrataMap.stats().restored)) > 0)
check('feed status is reported', /feed/.test(await page.locator('#stat-feed').innerText()))

// The canvas must actually paint (not a blank frame).
const painted = await page.evaluate(() => {
  const c = document.getElementById('stage')
  const ctx = c.getContext('2d')
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  const seen = new Set()
  for (let i = 0; i < d.length; i += 4 * 997) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`)
  return seen.size
})
check('canvas renders more than one colour', painted > 3, `${painted} sampled colours`)

// Press and hold the middle of the screen: arm -> solve -> Holi -> card.
const box = await page.locator('#stage').boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.waitForTimeout(900)
check('hold enters the solving phase', /Solving|Breaking/.test(await page.locator('#readout').innerText()))
await page.mouse.up()

const t0 = Date.now()
await page.locator('#card').waitFor({ state: 'visible', timeout: 45000 })
const solveMs = Date.now() - t0
check('artifact card appears', true, `${(solveMs / 1000).toFixed(1)} s from press`)
check('card names an artifact', (await page.locator('#card-name').innerText()).length > 3, await page.locator('#card-name').innerText())
const energy = await page.locator('#card-energy').innerText()
check('card prints an energy estimate', /Wh/.test(energy) && /estimate/i.test(energy), energy.slice(0, 72) + '…')
const solveStats = await page.locator('#card-stats').innerText()
check('card prints solve stats', /h\/s/.test(solveStats) && /bits/.test(solveStats), solveStats.replace(/\s+/g, ' '))

if (SHOT) await page.screenshot({ path: SHOT })
await page.locator('#card-close').click()

// The debug bloom button restores the centre cell.
const before = await page.evaluate(() => window.StrataMap.stats().restored)
await page.locator('#btn-bloom').click()
await page.waitForTimeout(400)
const after = await page.evaluate(() => window.StrataMap.stats().restored)
check('debug button blooms a cell', after > before, `${before} -> ${after}`)

check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
console.log(failures === 0 ? '\nsmoke passed' : `\n${failures} smoke check(s) FAILED`)
process.exit(failures === 0 ? 0 : 1)
