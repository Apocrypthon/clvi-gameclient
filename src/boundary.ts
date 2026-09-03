import raw from '../data/paradise-boundary.geojson?raw'
import { bboxOfRings, type BBox, type Ring } from './geo'

interface GeoJsonGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

interface GeoJsonFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: GeoJsonGeometry
}

export interface Boundary {
  /** Every ring of every polygon, flattened. Interior rings punch holes (even-odd). */
  rings: Ring[]
  bbox: BBox
  provisional: boolean
  name: string
}

function ringsOf(geometry: GeoJsonGeometry): Ring[] {
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as number[][][]).map((r) => r as unknown as Ring)
  }
  const out: Ring[] = []
  for (const poly of geometry.coordinates as number[][][][]) {
    for (const r of poly) out.push(r as unknown as Ring)
  }
  return out
}

export function loadBoundary(): Boundary {
  const fc = JSON.parse(raw) as { features: GeoJsonFeature[] }
  const feature = fc.features[0]
  const rings = ringsOf(feature.geometry)
  return {
    rings,
    bbox: bboxOfRings(rings),
    provisional: feature.properties.PROVISIONAL === true,
    name: String(feature.properties.name ?? 'Paradise'),
  }
}
