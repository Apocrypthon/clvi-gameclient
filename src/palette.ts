// Player palette: Holi pigments. Littered ground is the same hue family drained
// of saturation, so restoration reads as colour returning rather than repainting.

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Saturated pigments a restored cell can bloom into. */
export const PIGMENTS: Rgb[] = [
  { r: 255, g: 45, b: 120 }, // gulal magenta
  { r: 255, g: 176, b: 32 }, // saffron
  { r: 25, g: 201, b: 138 }, // jade
  { r: 34, g: 200, b: 255 }, // cyan
  { r: 139, g: 92, b: 246 }, // violet
]

/** Desaturated sand/ash: the unrestored desert floor. */
export const ASH: Rgb = { r: 86, g: 82, b: 74 }

export const BLOOM_LEVELS = 17

/** Pre-baked css strings: LUT[pigment][bloomLevel]. Avoids per-frame allocation. */
export const FILL_LUT: string[][] = PIGMENTS.map((p) => {
  const row: string[] = []
  for (let i = 0; i < BLOOM_LEVELS; i++) {
    const t = i / (BLOOM_LEVELS - 1)
    // Ease so the first traces of bloom are visible but the peak stays saturated.
    const e = t * t * (3 - 2 * t)
    const r = Math.round(ASH.r + (p.r - ASH.r) * e)
    const g = Math.round(ASH.g + (p.g - ASH.g) * e)
    const b = Math.round(ASH.b + (p.b - ASH.b) * e)
    row.push(`rgb(${r},${g},${b})`)
  }
  return row
})

export function pigmentCss(index: number, alpha = 1): string {
  const p = PIGMENTS[index % PIGMENTS.length]
  return `rgba(${p.r},${p.g},${p.b},${alpha})`
}
