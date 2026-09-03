import './style.css'
import { loadBoundary } from './boundary'
import { Camera } from './camera'
import type { MapEvent } from './contracts'
import { Dig, solvesRemaining } from './dig'
import { MapEventFeed } from './feed'
import { CELL_M, project, type Vec2 } from './geo'
import { Grid, OUTSIDE, RESTORED } from './grid'
import { Holi } from './holi'
import { Regen } from './regen'
import { MapRenderer } from './render'
import { Hud } from './ui'

const boundary = loadBoundary()
const grid = new Grid(boundary)
const regen = new Regen(grid)
const renderer = new MapRenderer(grid, boundary)
const holi = new Holi()

const canvas = document.getElementById('stage') as HTMLCanvasElement
const ctx = canvas.getContext('2d', { alpha: false })
if (!ctx) throw new Error('canvas 2d unavailable')

const hud = new Hud(() => {
  dig.dismiss()
  idleReadout()
})

const dig = new Dig(grid, {
  onPhase: (phase) => {
    if (phase === 'arming') hud.setReadout('Breaking ground…')
    else if (phase === 'solving') hud.setReadout('Solving · 0 h/s')
    else if (phase === 'idle') idleReadout()
  },
  onProgress: (p) => {
    hud.setReadout(
      `Solving · ${Math.round(p.hps).toLocaleString()} h/s · ${(p.ms / 1000).toFixed(1)} s`,
    )
  },
  onReveal: (result, screen, pigment) => {
    holi.burst(screen.x, screen.y, pigment)
    hud.setReadout(`${result.artifact.name} — ${(result.ms / 1000).toFixed(1)} s`)
    // The card rises out of the burst rather than landing on top of it.
    window.setTimeout(() => hud.showCard(result, pigment), 380)
  },
  onNotice: (text) => hud.notify(text),
})

const camera = new Camera(grid.cols * CELL_M, grid.rows * CELL_M, canvas, {
  onPressStart: (world) => {
    if (hud.cardOpen) return
    dig.pressStart(world)
  },
  onPressCancel: () => dig.pressCancel(),
  onPressRelease: () => dig.pressRelease(),
})

dig.screenOfCell = (cell): Vec2 => {
  const col = cell % grid.cols
  const row = (cell / grid.cols) | 0
  return camera.toScreen((col + 0.5) * CELL_M, (row + 0.5) * CELL_M)
}

const feed = new MapEventFeed((events) => {
  let applied = 0
  for (const ev of events) if (regen.applyEvent(ev)) applied++
  if (applied > 0) hud.notify(`${applied} restoration${applied === 1 ? '' : 's'} from the feed.`)
})

// A5 -> M4: the FIND track hands finds to the MAP track over the window.
window.addEventListener('strata:map-event', (e) => {
  regen.applyEvent((e as CustomEvent<MapEvent>).detail)
})

/** Public hook named in SEED.md; also how the debug button blooms a cell. */
const StrataMap = {
  applyEvent(event: MapEvent): boolean {
    return regen.applyEvent(event)
  },
  stats(): { restored: number; inside: number; cols: number; rows: number } {
    return { restored: regen.restoredCount, inside: grid.insideCount, cols: grid.cols, rows: grid.rows }
  },
  cellIdAt(lon: number, lat: number): string | null {
    const p = project(lon, lat, grid.bbox)
    const i = grid.indexAtWorld(p.x, p.y)
    return i >= 0 && grid.state[i] !== OUTSIDE ? grid.idAt(i) : null
  },
}
declare global {
  interface Window {
    StrataMap: typeof StrataMap
  }
}
window.StrataMap = StrataMap

document.getElementById('btn-bloom')?.addEventListener('click', () => {
  const cell = centreCell()
  if (cell < 0) {
    hud.notify('Pan over Paradise first.')
    return
  }
  const applied = StrataMap.applyEvent({ cellId: grid.idAt(cell), ts: Date.now(), kind: 'restored' })
  hud.notify(applied ? `Bloomed ${grid.idAt(cell)}.` : 'Already restored.')
})
document
  .getElementById('btn-zoom-in')
  ?.addEventListener('click', () => camera.zoomAt(1.6, camera.vw / 2, camera.vh / 2))
document
  .getElementById('btn-zoom-out')
  ?.addEventListener('click', () => camera.zoomAt(1 / 1.6, camera.vw / 2, camera.vh / 2))

/**
 * Nearest in-boundary cell to the centre of the view, searched in rings.
 * Prefers a cell that has not bloomed yet, so the debug button always does
 * something visible; falls back to any in-boundary cell.
 */
function centreCell(): number {
  const c = camera.toWorld(camera.vw / 2, camera.vh / 2)
  const col0 = Math.floor(c.x / CELL_M)
  const row0 = Math.floor(c.y / CELL_M)
  let fallback = -1
  for (let r = 0; r < 40; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const i = grid.index(col0 + dx, row0 + dy)
        if (i < 0 || grid.state[i] === OUTSIDE) continue
        if (grid.state[i] !== RESTORED) return i
        if (fallback < 0) fallback = i
      }
    }
  }
  return fallback
}

function idleReadout(): void {
  hud.setReadout(`Press and hold a cell to dig. ${solvesRemaining()} solves left today.`)
}

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min(64, now - last)
  last = now

  camera.step(dt)
  regen.step(dt)
  dig.update(dt)
  holi.update(dt)

  renderer.draw(ctx!, camera)
  dig.drawOverlay(ctx!, camera)
  holi.draw(ctx!)

  hud.setStats(regen.restoredCount, grid.insideCount, feed.status)
  requestAnimationFrame(frame)
}

window.addEventListener('resize', () => camera.resize())
window.addEventListener('orientationchange', () => window.setTimeout(() => camera.resize(), 120))

camera.resize()
const replayed = regen.restore()
idleReadout()
if (replayed > 0) hud.notify(`Replayed ${replayed} restored cell${replayed === 1 ? '' : 's'}.`)
feed.start()
requestAnimationFrame(frame)
