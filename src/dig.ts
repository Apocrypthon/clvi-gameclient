import type { Camera } from './camera'
import type { DeviceClass, MapEvent, Submission } from './contracts'
import { CELL_M, type Vec2 } from './geo'
import { Grid, OUTSIDE } from './grid'
import { detectDeviceClass, estWh } from './energy'
import { pigmentCss } from './palette'
import {
  BACKOFF_BITS,
  DEFAULT_DIFFICULTY_BITS,
  LOW_BATTERY_RELIEF_BITS,
  MIN_DIFFICULTY_BITS,
  playerId,
  requestChallenge,
  submit,
} from './mockLedger'
import { drawArtifact, seedFrom, type Artifact } from './registry'
import { batteryIsLow, Solver, type SolveProgress } from './solver'

export const HOLD_MS = 600
/** Courtesy cap. Disclosed, client-side, and deliberately low. */
export const DAILY_SOLVE_CAP = 60
const SOLVE_STORE = 'strata.solves.v1'
const MAX_BACKOFF_ROUNDS = 3

export type DigPhase = 'idle' | 'arming' | 'solving' | 'reveal'

export interface DigResult {
  artifact: Artifact
  cellId: string
  nonce: string
  hashes: number
  ms: number
  hps: number
  difficultyBits: number
  deviceClass: DeviceClass
  wh: number
}

export interface DigHooks {
  onPhase(phase: DigPhase): void
  onProgress(progress: SolveProgress): void
  onReveal(result: DigResult, screen: Vec2, pigment: number): void
  onNotice(text: string): void
}

/**
 * A2/A3/A5 — press-and-hold a cell, solve the challenge, submit the find.
 * The dig never bricks: on the 30 s hard cap it asks for a fresh challenge
 * four bits easier and keeps going, down to MIN_DIFFICULTY_BITS.
 */
export class Dig {
  phase: DigPhase = 'idle'
  progress: SolveProgress = { hashes: 0, ms: 0, hps: 0 }
  private cell = -1
  private armedFor = 0
  private solver = new Solver()
  private shimmer = 0

  constructor(
    private grid: Grid,
    private hooks: DigHooks,
  ) {}

  get activeCell(): number {
    return this.cell
  }

  pressStart(world: Vec2): void {
    if (this.phase === 'solving' || this.phase === 'reveal') return
    const i = this.grid.indexAtWorld(world.x, world.y)
    if (i < 0 || this.grid.state[i] === OUTSIDE) {
      this.hooks.onNotice('Outside the Paradise service area.')
      return
    }
    this.cell = i
    this.armedFor = 0
    this.setPhase('arming')
  }

  /** Card dismissed — the dig returns to idle and the next press can arm. */
  dismiss(): void {
    if (this.phase === 'reveal') this.setPhase('idle')
  }

  pressCancel(): void {
    if (this.phase !== 'arming') return
    this.cell = -1
    this.setPhase('idle')
  }

  pressRelease(): void {
    if (this.phase !== 'arming') return
    this.cell = -1
    this.setPhase('idle')
    this.hooks.onNotice('Hold for 0.6 s to break ground.')
  }

  /** Ring fill (A2) and heat shimmer (A3) advance here, not in the render pass. */
  update(dtMs: number): void {
    if (this.phase === 'arming') {
      this.armedFor += dtMs
      if (this.armedFor >= HOLD_MS) void this.run()
    } else if (this.phase === 'solving') {
      this.shimmer += dtMs
    }
  }

  private setPhase(phase: DigPhase): void {
    this.phase = phase
    this.hooks.onPhase(phase)
  }

  private async run(): Promise<void> {
    const cell = this.cell
    const cellId = this.grid.idAt(cell)
    this.setPhase('solving')
    this.progress = { hashes: 0, ms: 0, hps: 0 }
    this.shimmer = 0

    const remaining = solvesRemaining()
    if (remaining <= 0) {
      this.hooks.onNotice(`Daily courtesy cap reached (${DAILY_SOLVE_CAP} solves). Back tomorrow.`)
      this.cell = -1
      this.setPhase('idle')
      return
    }

    const me = playerId()
    const deviceClass = detectDeviceClass()
    let bits = DEFAULT_DIFFICULTY_BITS
    if (await batteryIsLow()) {
      bits = Math.max(MIN_DIFFICULTY_BITS, bits - LOW_BATTERY_RELIEF_BITS)
      this.hooks.onNotice(`Battery under 20 % — asking for ${bits} bits.`)
    }

    let totalHashes = 0
    let totalMs = 0
    for (let round = 0; round < MAX_BACKOFF_ROUNDS; round++) {
      const challenge = await requestChallenge({ playerId: me, cellId, difficultyBits: bits })
      const outcome = await this.solver.solve(challenge, me, (p) => {
        this.progress = { hashes: totalHashes + p.hashes, ms: totalMs + p.ms, hps: p.hps }
        this.hooks.onProgress(this.progress)
      })
      totalHashes += outcome.hashes
      totalMs += outcome.ms

      if (outcome.ok) {
        recordSolve()
        const artifact = drawArtifact(seedFrom(`${cellId}:${challenge.challengeId}`))
        const submission: Submission = {
          challengeId: challenge.challengeId,
          playerId: me,
          cellId,
          artifactId: artifact.id,
          nonce: outcome.nonce,
          hashes: totalHashes,
          ms: Math.round(totalMs),
          deviceClass,
        }
        const ack = await submit(submission)
        if (ack.accepted) dispatchMapEvent(ack.event)

        const result: DigResult = {
          artifact,
          cellId,
          nonce: outcome.nonce,
          hashes: totalHashes,
          ms: Math.round(totalMs),
          hps: totalMs > 0 ? (totalHashes / totalMs) * 1000 : 0,
          difficultyBits: challenge.difficultyBits,
          deviceClass,
          wh: estWh(totalMs, deviceClass),
        }
        this.setPhase('reveal')
        this.hooks.onReveal(result, this.cellScreenCenterFallback(), this.grid.pigment[cell])
        this.cell = -1
        return
      }

      if (outcome.reason === 'cancelled') {
        this.cell = -1
        this.setPhase('idle')
        return
      }

      if (bits <= MIN_DIFFICULTY_BITS) break
      bits = Math.max(MIN_DIFFICULTY_BITS, bits - BACKOFF_BITS)
      this.hooks.onNotice(`Hard cap hit — retrying at ${bits} bits.`)
    }

    this.hooks.onNotice('The ground held. Try another cell.')
    this.cell = -1
    this.setPhase('idle')
  }

  /** The reveal is screen-space; main.ts overrides this with the live camera. */
  screenOfCell: ((cell: number) => Vec2) | null = null

  private cellScreenCenterFallback(): Vec2 {
    return this.screenOfCell?.(this.cell) ?? { x: 0, y: 0 }
  }

  /** Overlay for the active dig: hold ring, then the heat shimmer. */
  drawOverlay(ctx: CanvasRenderingContext2D, cam: Camera): void {
    if (this.cell < 0) return
    const col = this.cell % this.grid.cols
    const row = (this.cell / this.grid.cols) | 0
    const c = cam.toScreen((col + 0.5) * CELL_M, (row + 0.5) * CELL_M)
    const pigment = this.grid.pigment[this.cell]
    const radius = Math.max(26, cam.cellPx * 0.85)

    ctx.save()
    if (this.phase === 'arming') {
      const t = Math.min(1, this.armedFor / HOLD_MS)
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(c.x, c.y, radius, 0, Math.PI * 2)
      ctx.stroke()

      ctx.strokeStyle = pigmentCss(pigment, 0.95)
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(c.x, c.y, radius, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2)
      ctx.stroke()

      ctx.fillStyle = pigmentCss(pigment, 0.12 + 0.2 * t)
      ctx.fillRect(col * CELL_M * cam.scale + originX(cam), row * CELL_M * cam.scale + originY(cam), cam.cellPx, cam.cellPx)
    } else if (this.phase === 'solving') {
      // Heat shimmer: rings breathe faster the more hashes/sec we are managing.
      const rate = Math.min(2.6, 0.6 + this.progress.hps / 30000)
      const pulse = 0.5 + 0.5 * Math.sin((this.shimmer / 1000) * rate * Math.PI * 2)
      ctx.globalCompositeOperation = 'lighter'
      for (let k = 0; k < 3; k++) {
        const phase = (this.shimmer / 900 + k / 3) % 1
        ctx.strokeStyle = pigmentCss(pigment, 0.32 * (1 - phase))
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(c.x, c.y, radius * (0.6 + phase * 1.1), 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.fillStyle = pigmentCss(pigment, 0.1 + 0.16 * pulse)
      ctx.beginPath()
      ctx.arc(c.x, c.y, radius * 0.75, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

function originX(cam: Camera): number {
  return cam.vw / 2 - cam.cx * cam.scale
}

function originY(cam: Camera): number {
  return cam.vh / 2 - cam.cy * cam.scale
}

/** A5 — hand the ack's MapEvent to the MAP track over the window. */
export function dispatchMapEvent(event: MapEvent): void {
  window.dispatchEvent(new CustomEvent<MapEvent>('strata:map-event', { detail: event }))
}

interface SolveLog {
  day: string
  n: number
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function readSolveLog(): SolveLog {
  try {
    const raw = localStorage.getItem(SOLVE_STORE)
    if (raw) {
      const parsed = JSON.parse(raw) as SolveLog
      if (parsed.day === today() && typeof parsed.n === 'number') return parsed
    }
  } catch {
    /* fall through to a fresh day */
  }
  return { day: today(), n: 0 }
}

export function solvesRemaining(): number {
  return Math.max(0, DAILY_SOLVE_CAP - readSolveLog().n)
}

function recordSolve(): void {
  const log = readSolveLog()
  log.n++
  try {
    localStorage.setItem(SOLVE_STORE, JSON.stringify(log))
  } catch {
    /* cap is a courtesy, not a security boundary — see docs/ENERGY.md */
  }
}
