// Headless smoke checks for the loop. Run with: npm run verify
// Bundled by esbuild so it exercises the real modules in src/, not copies.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bboxOfRings, project, unproject, M_PER_DEG_LAT, M_PER_DEG_LON, CELL_M } from '../src/geo.ts'
import { Grid, OUTSIDE, RESTORED } from '../src/grid.ts'
import { Regen } from '../src/regen.ts'
import { REGISTRY, RARITY_WEIGHT, drawArtifact, seedFrom } from '../src/registry.ts'
import { digestBits, isValidNonce, verifySolve } from '../src/hash.ts'
import { estKwh, WATTS } from '../src/energy.ts'

let failures = 0
function check(name, cond, detail = '') {
  const mark = cond ? 'ok  ' : 'FAIL'
  if (!cond) failures++
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`)
}

// --- boundary + grid (M1, M2) ------------------------------------------------
const fc = JSON.parse(readFileSync(resolve(process.cwd(), 'data/paradise-boundary.geojson'), 'utf8'))
const feature = fc.features[0]
const rings = feature.geometry.coordinates
const boundary = {
  rings,
  bbox: bboxOfRings(rings),
  provisional: feature.properties.PROVISIONAL === true,
  name: feature.properties.name,
}
check('boundary parses', rings.length >= 1 && rings[0].length >= 4)
check('boundary is flagged provisional', boundary.provisional, 'replace with OSM when network allows')

const grid = new Grid(boundary)
check('grid is 150 m', CELL_M === 150)
check('grid has cells', grid.cols > 50 && grid.rows > 50, `${grid.cols} x ${grid.rows}`)
check(
  'boundary fills a plausible share of the bbox',
  grid.insideCount / (grid.cols * grid.rows) > 0.4,
  `${grid.insideCount} inside of ${grid.cols * grid.rows}`,
)
check('cell ids round-trip', grid.indexOfId('P-10-12') === grid.index(10, 12))
check('malformed cell ids are rejected', grid.indexOfId('nope') === -1)
check('off-grid cell ids are rejected', grid.indexOfId(`P-${grid.cols}-0`) === -1)

// --- projection (M2) ---------------------------------------------------------
const p = project(-115.15, 36.1, grid.bbox)
const back = unproject(p.x, p.y, grid.bbox)
check(
  'projection round-trips',
  Math.abs(back.lon + 115.15) < 1e-9 && Math.abs(back.lat - 36.1) < 1e-9,
)
check('metres per degree are anchored at 36.09 N', Math.abs(M_PER_DEG_LON / M_PER_DEG_LAT - Math.cos((36.09 * Math.PI) / 180)) < 1e-12)

// --- regeneration (M4) -------------------------------------------------------
const regen = new Regen(grid)
let seed = -1
for (let i = 0; i < grid.state.length && seed < 0; i++) {
  const col = i % grid.cols
  const row = (i / grid.cols) | 0
  if (col > 20 && row > 20 && grid.state[i] !== OUTSIDE) seed = i
}
const seedId = grid.idAt(seed)
check('applyEvent accepts a MapEvent', regen.applyEvent({ cellId: seedId, ts: 1, kind: 'restored' }, false))
check('applyEvent dedupes by cellId+ts', !regen.applyEvent({ cellId: seedId, ts: 1, kind: 'restored' }, false))
check('applyEvent rejects unknown cells', !regen.applyEvent({ cellId: 'P-9999-9999', ts: 2, kind: 'restored' }, false))

for (let i = 0; i < 200; i++) regen.step(250)
let touched = 0
let maxBloom = 0
for (let i = 0; i < grid.bloom.length; i++) {
  if (grid.bloom[i] > 0.02) touched++
  maxBloom = Math.max(maxBloom, grid.bloom[i])
}
check('the seed cell is restored', grid.state[seed] === RESTORED)
check('bloom diffuses outward', touched > 12, `${touched} cells carry bloom`)
check('bloom stays bounded', maxBloom <= 1.0001, `max ${maxBloom.toFixed(3)}`)
check(
  'one find does not saturate the valley',
  touched < grid.insideCount * 0.25,
  `${((touched / grid.insideCount) * 100).toFixed(1)}% of Paradise`,
)

// --- registry (A1) -----------------------------------------------------------
check('registry has 15-20 finds', REGISTRY.length >= 15 && REGISTRY.length <= 20, `${REGISTRY.length}`)
check('registry ids are unique', new Set(REGISTRY.map((a) => a.id)).size === REGISTRY.length)
check('every find has a rarity weight', REGISTRY.every((a) => a.weight === RARITY_WEIGHT[a.rarity]))
check('every rarity tier is represented', new Set(REGISTRY.map((a) => a.rarity)).size === 4)
const s = seedFrom('P-42-41:ch_abc')
check('seeded draw is reproducible', drawArtifact(s).id === drawArtifact(s).id)
const counts = new Map()
for (let i = 0; i < 20000; i++) {
  const id = drawArtifact(seedFrom(`cell:${i}`)).id
  counts.set(id, (counts.get(id) ?? 0) + 1)
}
check('the draw reaches every find', counts.size === REGISTRY.length)
const legendary = REGISTRY.filter((a) => a.rarity === 'legendary').reduce((n, a) => n + (counts.get(a.id) ?? 0), 0)
const common = REGISTRY.filter((a) => a.rarity === 'common').reduce((n, a) => n + (counts.get(a.id) ?? 0), 0)
check('common finds outnumber legendary', common > legendary * 5, `${common} vs ${legendary}`)

// --- the solve (A3) ----------------------------------------------------------
const SALT = 'a1b2c3d4e5f60718'
const PLAYER = 'p_verify'
const BITS = 12
let nonce = 0
const t0 = performance.now()
let found = ''
while (found === '' && nonce < 200000) {
  const batch = []
  // Counting is numeric; the nonce becomes a string at the point it is hashed,
  // so the winning candidate IS the string that would be submitted.
  for (let i = 0; i < 256; i++) batch.push(digestBits(SALT, String(nonce + i), PLAYER))
  const bits = await Promise.all(batch)
  for (let i = 0; i < bits.length; i++) if (bits[i] >= BITS && found === '') found = String(nonce + i)
  nonce += 256
}
const elapsed = performance.now() - t0
const hps = (nonce / elapsed) * 1000
check(`a ${BITS}-bit solve is found`, found !== '', `nonce ${found}`)
check('the found nonce verifies', await verifySolve(SALT, found, PLAYER, BITS))
const foundBits = await digestBits(SALT, found, PLAYER)
check('verification is exact at the boundary', await verifySolve(SALT, found, PLAYER, foundBits))
check('verification rejects one bit too many', !(await verifySolve(SALT, found, PLAYER, foundBits + 1)))

// The nonce crosses the wire as a string (clvi-backend requireNonce). These
// guard the bug class where a client hashes one representation and submits
// another, which the backend rejects with a 400 on every submit.
check('the nonce is a string', typeof found === 'string', `typeof ${typeof found}`)
check('the nonce passes the backend pattern', isValidNonce(found))
check('the submitted nonce is the one that was hashed', await verifySolve(SALT, found, PLAYER, foundBits))
check('a nonce containing the separator is rejected', !isValidNonce(`12:34`))
check('a space-bearing nonce is rejected', !isValidNonce('12 34'))
check('an empty nonce is rejected', !isValidNonce(''))
check('a 129-char nonce is rejected', !isValidNonce('1'.repeat(129)))
check('a 128-char nonce is accepted', isValidNonce('1'.repeat(128)))
console.log(
  `     hash rate here: ${Math.round(hps).toLocaleString()} h/s → ` +
    `17 bits ≈ ${(131072 / hps).toFixed(1)} s on this machine (phones run 3-8x slower)`,
)

// --- energy (A6) -------------------------------------------------------------
check('estKwh matches the frozen formula', Math.abs(estKwh(5000, 'phone') - (5000 / 3.6e9) * 3) < 1e-15)
check('every device class has a wattage', Object.keys(WATTS).length === 4)
check('4 s on a phone is a fraction of a watt-hour', estKwh(4000, 'phone') * 1000 < 0.01, `${(estKwh(4000, 'phone') * 1000).toFixed(5)} Wh`)

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) FAILED`)
process.exit(failures === 0 ? 0 : 1)
