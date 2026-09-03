import type { Camera } from './camera'
import { CELL_M, project } from './geo'
import { Grid, OUTSIDE } from './grid'
import type { Boundary } from './boundary'
import { ASH, BLOOM_LEVELS, FILL_LUT } from './palette'

const ASH_CSS = `rgb(${ASH.r},${ASH.g},${ASH.b})`
const BACKDROP = '#12100e'
const BOUNDARY_STROKE = 'rgba(255,214,150,0.55)'
const GRIDLINE = 'rgba(0,0,0,0.16)'

export class MapRenderer {
  private ringsWorld: Float64Array[]

  constructor(
    private grid: Grid,
    boundary: Boundary,
  ) {
    // Project the outline once; it never moves.
    this.ringsWorld = boundary.rings.map((ring) => {
      const flat = new Float64Array(ring.length * 2)
      ring.forEach(([lon, lat], i) => {
        const p = project(lon, lat, grid.bbox)
        flat[i * 2] = p.x
        flat[i * 2 + 1] = p.y
      })
      return flat
    })
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0)
    ctx.fillStyle = BACKDROP
    ctx.fillRect(0, 0, cam.vw, cam.vh)

    const s = cam.scale
    const ox = cam.vw / 2 - cam.cx * s
    const oy = cam.vh / 2 - cam.cy * s
    const vp = cam.viewport()

    const g = this.grid
    const col0 = Math.max(0, Math.floor(vp.x0 / CELL_M))
    const col1 = Math.min(g.cols, Math.ceil(vp.x1 / CELL_M))
    const row0 = Math.max(0, Math.floor(vp.y0 / CELL_M))
    const row1 = Math.min(g.rows, Math.ceil(vp.y1 / CELL_M))
    if (col1 <= col0 || row1 <= row0) return

    // Row-major sweep, merging horizontal runs of identical colour into one
    // fillRect. The littered ground is one key, so most rows cost a few calls.
    for (let row = row0; row < row1; row++) {
      const y0 = Math.floor(row * CELL_M * s + oy)
      const h = Math.max(1, Math.floor((row + 1) * CELL_M * s + oy) - y0)
      const base = row * g.cols
      let runKey = -2
      let runStart = col0
      for (let col = col0; col <= col1; col++) {
        const key = col < col1 ? this.keyOf(base + col) : -2
        if (key !== runKey) {
          if (runKey !== -2 && col > runStart) {
            const x0 = Math.floor(runStart * CELL_M * s + ox)
            const w = Math.max(1, Math.floor(col * CELL_M * s + ox) - x0)
            ctx.fillStyle = cssOf(runKey, this.grid, base + runStart)
            ctx.fillRect(x0, y0, w, h)
          }
          runKey = key
          runStart = col
        }
      }
    }

    if (cam.cellPx > 11) this.drawGridLines(ctx, s, ox, oy, col0, col1, row0, row1)
    this.drawBoundary(ctx, s, ox, oy)
  }

  /** -2 outside (skip), -1 ash, else pigment*BLOOM_LEVELS + level. */
  private keyOf(i: number): number {
    const st = this.grid.state[i]
    if (st === OUTSIDE) return -2
    const level = Math.round(this.grid.bloom[i] * (BLOOM_LEVELS - 1))
    if (level <= 0) return -1
    return this.grid.pigment[i] * BLOOM_LEVELS + level
  }

  private drawGridLines(
    ctx: CanvasRenderingContext2D,
    s: number,
    ox: number,
    oy: number,
    col0: number,
    col1: number,
    row0: number,
    row1: number,
  ): void {
    ctx.strokeStyle = GRIDLINE
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let col = col0; col <= col1; col++) {
      const x = Math.floor(col * CELL_M * s + ox) + 0.5
      ctx.moveTo(x, Math.floor(row0 * CELL_M * s + oy))
      ctx.lineTo(x, Math.floor(row1 * CELL_M * s + oy))
    }
    for (let row = row0; row <= row1; row++) {
      const y = Math.floor(row * CELL_M * s + oy) + 0.5
      ctx.moveTo(Math.floor(col0 * CELL_M * s + ox), y)
      ctx.lineTo(Math.floor(col1 * CELL_M * s + ox), y)
    }
    ctx.stroke()
  }

  private drawBoundary(ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number): void {
    ctx.beginPath()
    for (const flat of this.ringsWorld) {
      for (let i = 0; i < flat.length; i += 2) {
        const x = flat[i] * s + ox
        const y = flat[i + 1] * s + oy
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
    }
    ctx.strokeStyle = BOUNDARY_STROKE
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
}

function cssOf(key: number, grid: Grid, i: number): string {
  if (key === -1) return ASH_CSS
  return FILL_LUT[grid.pigment[i]][key % BLOOM_LEVELS]
}
