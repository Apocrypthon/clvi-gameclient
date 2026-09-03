// Equirectangular projection anchored at 36.09 N (Paradise, NV).
// Rationale + constants documented in docs/DATA.md.

export const LAT0 = 36.09
const R_MEAN = 6371008.8 // IUGG mean Earth radius, metres

export const M_PER_DEG_LAT = (Math.PI / 180) * R_MEAN // 111195.08
export const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180) // 89855.93

/** Cell edge length in metres. Contracts v1: 150 m grid. */
export const CELL_M = 150

export interface BBox {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

/** A closed linear ring as [lon, lat] pairs. */
export type Ring = ReadonlyArray<readonly [number, number]>

export interface Vec2 {
  x: number
  y: number
}

/** Projects lon/lat to world metres, origin at the bbox NW corner, +y south. */
export function project(lon: number, lat: number, bbox: BBox): Vec2 {
  return {
    x: (lon - bbox.minLon) * M_PER_DEG_LON,
    y: (bbox.maxLat - lat) * M_PER_DEG_LAT,
  }
}

export function unproject(x: number, y: number, bbox: BBox): { lon: number; lat: number } {
  return {
    lon: bbox.minLon + x / M_PER_DEG_LON,
    lat: bbox.maxLat - y / M_PER_DEG_LAT,
  }
}

export function bboxOfRings(rings: Ring[]): BBox {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }
  return { minLon, minLat, maxLon, maxLat }
}

/** Even-odd point-in-polygon across every ring, so interior rings punch holes. */
export function pointInRings(lon: number, lat: number, rings: Ring[]): boolean {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside
      }
    }
  }
  return inside
}
