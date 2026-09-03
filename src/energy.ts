import type { DeviceClass } from './contracts'

/**
 * A6 — energy honesty. Every solve prints what it probably cost.
 * This is an ESTIMATE, and docs/ENERGY.md states every assumption behind it.
 */
export const WATTS: Record<DeviceClass, number> = {
  phone: 3,
  tablet: 5,
  laptop: 15,
  desktop: 45,
}

/** estKwh = (ms / 3.6e9) x WATTS[deviceClass]. Frozen in SEED.md. */
export function estKwh(ms: number, deviceClass: DeviceClass): number {
  return (ms / 3.6e9) * WATTS[deviceClass]
}

export function estWh(ms: number, deviceClass: DeviceClass): number {
  return estKwh(ms, deviceClass) * 1000
}

export function formatWh(wh: number): string {
  if (wh < 0.001) return '<0.001 Wh'
  if (wh < 1) return `${wh.toFixed(3)} Wh`
  return `${wh.toFixed(2)} Wh`
}

/**
 * Heuristic, deliberately coarse. We cannot read the SoC, so we bucket by UA
 * and screen and say so on the card.
 */
export function detectDeviceClass(): DeviceClass {
  const ua = navigator.userAgent
  const touch = (navigator.maxTouchPoints ?? 0) > 1
  const short = Math.min(screen.width, screen.height)

  if (/iPad/.test(ua) || (touch && /Macintosh/.test(ua))) return 'tablet'
  if (/Tablet|PlayBook|Silk/.test(ua) || (touch && /Android/.test(ua) && !/Mobile/.test(ua)))
    return 'tablet'
  if (/iPhone|iPod|Mobile|Android|Windows Phone/.test(ua)) return 'phone'
  if (touch && short < 820) return 'phone'
  if (!touch && short >= 1000) return 'desktop'
  return 'laptop'
}
