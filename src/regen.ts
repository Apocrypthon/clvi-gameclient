import type { MapEvent } from './contracts'
import { Grid, LITTERED, OUTSIDE, RESTORED, RESTORING } from './grid'

const STORE_KEY = 'strata.map.events.v1'
const TICK_MS = 250
/** A cell can only lift its neighbours to this fraction of its own bloom, so a
 *  single find heals a bounded halo (~9 cells) instead of the whole valley. */
const SPREAD_CEIL = 0.62
const APPROACH = 0.18 // per tick, toward that ceiling
const SEED_RAMP = 0.25 // per tick, a fresh find saturating to 1.0
const TOUCH_AT = 0.02 // bloom above which littered becomes restoring
/** Below this, a cell still adopts the pigment of whatever is bloom­ing it, so
 *  each find heals in one coherent colour instead of a field of confetti. */
const PIGMENT_LOCK_BELOW = 0.15
const RESTORED_AT = 0.9
const EPS = 0.004
const CATCHUP_TICKS = 80

/**
 * Regeneration (M4). Restoration is a diffusing field: a restored cell
 * saturates in the player palette and pushes a fraction of that bloom into its
 * four neighbours every tick, so the map heals outward from every find.
 */
export class Regen {
  private applied = new Set<string>()
  private seeds = new Set<number>()
  private active = new Set<number>()
  private acc = 0
  restoredCount = 0

  constructor(private grid: Grid) {}

  /** Replays persisted events and settles the field so a returning player sees
   *  the valley as they left it. */
  restore(): number {
    const stored = readStore()
    for (const ev of stored) this.applyEvent(ev, false)
    for (let i = 0; i < CATCHUP_TICKS; i++) this.tick()
    return stored.length
  }

  /** Contracts v1 MapEvent in, bloom out. Deduped by cellId+ts. */
  applyEvent(ev: MapEvent, persist = true): boolean {
    const key = `${ev.cellId}:${ev.ts}`
    if (this.applied.has(key)) return false
    const i = this.grid.indexOfId(ev.cellId)
    if (i < 0 || this.grid.state[i] === OUTSIDE) return false

    this.applied.add(key)
    if (this.grid.state[i] !== RESTORED) this.restoredCount++
    this.grid.state[i] = RESTORED
    this.seeds.add(i)
    this.active.add(i)
    if (persist) writeStore([...this.applied].map(parseKey))
    return true
  }

  /** Advances the field on a fixed 250 ms step, decoupled from frame rate. */
  step(dtMs: number): void {
    this.acc += dtMs
    let guard = 0
    while (this.acc >= TICK_MS && guard++ < 4) {
      this.acc -= TICK_MS
      this.tick()
    }
  }

  private tick(): void {
    const { grid } = this
    const { bloom, state, cols } = grid

    for (const i of this.seeds) {
      bloom[i] = Math.min(1, bloom[i] + SEED_RAMP)
      if (bloom[i] >= 1) this.seeds.delete(i)
    }

    const next = new Set<number>()
    for (const i of this.active) {
      const b = bloom[i]
      if (b < TOUCH_AT) continue
      const ceil = b * SPREAD_CEIL
      let pushed = this.seeds.has(i)
      const col = i % cols
      const row = (i / cols) | 0
      for (let k = 0; k < 4; k++) {
        const n =
          k === 0
            ? grid.index(col - 1, row)
            : k === 1
              ? grid.index(col + 1, row)
              : k === 2
                ? grid.index(col, row - 1)
                : grid.index(col, row + 1)
        if (n < 0 || state[n] === OUTSIDE) continue
        if (bloom[n] >= ceil - EPS) continue
        if (bloom[n] < PIGMENT_LOCK_BELOW) grid.pigment[n] = grid.pigment[i]
        bloom[n] += (ceil - bloom[n]) * APPROACH
        if (state[n] === LITTERED && bloom[n] > TOUCH_AT) state[n] = RESTORING
        if (state[n] !== RESTORED && bloom[n] >= RESTORED_AT) {
          state[n] = RESTORED
          this.restoredCount++
        }
        next.add(n)
        pushed = true
      }
      if (pushed) next.add(i)
    }
    this.active = next
  }
}

function parseKey(key: string): MapEvent {
  const at = key.lastIndexOf(':')
  return { cellId: key.slice(0, at), ts: Number(key.slice(at + 1)), kind: 'restored' }
}

function readStore(): MapEvent[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is MapEvent =>
        !!e && typeof e.cellId === 'string' && typeof e.ts === 'number' && e.kind === 'restored',
    )
  } catch {
    return []
  }
}

function writeStore(events: MapEvent[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(events))
  } catch {
    /* private mode / quota: the map still works, it just won't persist. */
  }
}
