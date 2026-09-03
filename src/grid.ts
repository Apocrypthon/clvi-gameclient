import type { Boundary } from './boundary'
import { CELL_M, M_PER_DEG_LAT, M_PER_DEG_LON, pointInRings, type BBox } from './geo'
import { PIGMENTS } from './palette'

export const OUTSIDE = 0
export const LITTERED = 1
export const RESTORING = 2
export const RESTORED = 3

/**
 * A flat 150 m grid laid out from the boundary bbox NW corner.
 * Cell ids are "P-<col>-<row>" and are a pure function of the bbox, so any
 * session that loads the same boundary derives the same ids. (Contracts v1.)
 */
export class Grid {
  readonly cols: number
  readonly rows: number
  readonly bbox: BBox
  /** OUTSIDE | LITTERED | RESTORING | RESTORED, one byte per cell. */
  readonly state: Uint8Array
  /** 0..1 saturation toward the cell's pigment. */
  readonly bloom: Float32Array
  /** Stable index into PIGMENTS, derived from the cell id. */
  readonly pigment: Uint8Array
  /** Cells inside the boundary — the denominator for "% restored". */
  readonly insideCount: number

  constructor(boundary: Boundary) {
    this.bbox = boundary.bbox
    const widthM = (this.bbox.maxLon - this.bbox.minLon) * M_PER_DEG_LON
    const heightM = (this.bbox.maxLat - this.bbox.minLat) * M_PER_DEG_LAT
    this.cols = Math.ceil(widthM / CELL_M)
    this.rows = Math.ceil(heightM / CELL_M)

    const n = this.cols * this.rows
    this.state = new Uint8Array(n)
    this.bloom = new Float32Array(n)
    this.pigment = new Uint8Array(n)

    let inside = 0
    for (let row = 0; row < this.rows; row++) {
      const lat = this.bbox.maxLat - ((row + 0.5) * CELL_M) / M_PER_DEG_LAT
      for (let col = 0; col < this.cols; col++) {
        const lon = this.bbox.minLon + ((col + 0.5) * CELL_M) / M_PER_DEG_LON
        const i = row * this.cols + col
        if (pointInRings(lon, lat, boundary.rings)) {
          this.state[i] = LITTERED
          this.pigment[i] = hashPigment(col, row)
          inside++
        }
      }
    }
    this.insideCount = inside
  }

  index(col: number, row: number): number {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return -1
    return row * this.cols + col
  }

  idOf(col: number, row: number): string {
    return `P-${col}-${row}`
  }

  idAt(i: number): string {
    return `P-${i % this.cols}-${Math.floor(i / this.cols)}`
  }

  /** Resolves "P-<col>-<row>" to a flat index, or -1 if malformed / off-grid. */
  indexOfId(cellId: string): number {
    const m = /^P-(\d+)-(\d+)$/.exec(cellId)
    if (!m) return -1
    return this.index(Number(m[1]), Number(m[2]))
  }

  /** World metres (bbox NW origin, +y south) to a flat index. */
  indexAtWorld(x: number, y: number): number {
    return this.index(Math.floor(x / CELL_M), Math.floor(y / CELL_M))
  }
}

/** Deterministic per-cell pigment so a cell always blooms the same colour. */
function hashPigment(col: number, row: number): number {
  let h = 2166136261
  h = Math.imul(h ^ col, 16777619)
  h = Math.imul(h ^ row, 16777619)
  h ^= h >>> 13
  return (h >>> 0) % PIGMENTS.length
}
