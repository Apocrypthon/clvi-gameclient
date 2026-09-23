import SolverWorker from './solver.worker?worker'
import type { SolveMessage, SolveRequest } from './solver.worker'
import type { Challenge } from './contracts'
import { HARD_CAP_MS } from './mockLedger'

export interface SolveProgress {
  hashes: number
  ms: number
  hps: number
}

export type SolveOutcome =
  | { ok: true; nonce: string; hashes: number; ms: number }
  | { ok: false; reason: 'timeout' | 'cancelled'; hashes: number; ms: number }

/**
 * Client half of the solve. Exactly one worker for the lifetime of the page —
 * the whole point is that this stays a game mechanic, not a mining rig.
 */
export class Solver {
  private worker = new SolverWorker()
  private pending: ((o: SolveOutcome) => void) | null = null
  private onProgress: ((p: SolveProgress) => void) | null = null

  constructor() {
    this.worker.addEventListener('message', (e: MessageEvent) => {
      const msg = e.data as SolveMessage
      if (msg.type === 'progress') {
        this.onProgress?.({ hashes: msg.hashes, ms: msg.ms, hps: msg.hps })
        return
      }
      const resolve = this.pending
      this.pending = null
      this.onProgress = null
      if (!resolve) return
      if (msg.type === 'solved') {
        resolve({ ok: true, nonce: msg.nonce, hashes: msg.hashes, ms: msg.ms })
      } else {
        resolve({ ok: false, reason: 'timeout', hashes: msg.hashes, ms: msg.ms })
      }
    })
  }

  solve(
    challenge: Challenge,
    playerId: string,
    onProgress: (p: SolveProgress) => void,
  ): Promise<SolveOutcome> {
    this.cancel()
    return new Promise<SolveOutcome>((resolve) => {
      this.pending = resolve
      this.onProgress = onProgress
      const req: SolveRequest = {
        type: 'solve',
        salt: challenge.salt,
        playerId,
        difficultyBits: challenge.difficultyBits,
        // Random start so two players on the same challenge do not walk in step.
        startNonce: Math.floor(Math.random() * 1e6),
        hardCapMs: HARD_CAP_MS,
      }
      this.worker.postMessage(req)
    })
  }

  cancel(): void {
    const resolve = this.pending
    this.pending = null
    this.onProgress = null
    this.worker.postMessage({ type: 'cancel' })
    resolve?.({ ok: false, reason: 'cancelled', hashes: 0, ms: 0 })
  }
}

/** Battery-aware relief (A3): under 20 % we ask for an easier challenge. */
export async function batteryIsLow(): Promise<boolean> {
  interface BatteryLike {
    level: number
  }
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> }
  if (!nav.getBattery) return false
  try {
    const battery = await nav.getBattery()
    return battery.level < 0.2
  } catch {
    return false
  }
}
