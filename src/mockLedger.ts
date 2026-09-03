import type { Challenge, MapEvent, Submission, SubmissionAck } from './contracts'

/**
 * Stand-in for the Strata ledger until the backend is live. It issues real
 * challenges (real salts, real difficulty) so the client path is honest —
 * only the transport and the acknowledgement are faked.
 *
 * Tuning knob: DEFAULT_DIFFICULTY_BITS targets a 3–6 s median solve on a
 * phone. See docs/STATE.md#Verify for how to re-measure it.
 */
export const DEFAULT_DIFFICULTY_BITS = 17
export const HARD_CAP_MS = 30_000
export const BACKOFF_BITS = 4
export const LOW_BATTERY_RELIEF_BITS = 2
export const MIN_DIFFICULTY_BITS = 8
export const CHALLENGE_TTL_MS = 120_000

const LATENCY_MS = 120

export async function requestChallenge(opts: {
  playerId: string
  cellId: string
  difficultyBits?: number
}): Promise<Challenge> {
  await sleep(LATENCY_MS)
  const bits = Math.max(MIN_DIFFICULTY_BITS, opts.difficultyBits ?? DEFAULT_DIFFICULTY_BITS)
  return {
    challengeId: `ch_${randomHex(8)}`,
    salt: randomHex(16),
    difficultyBits: bits,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  }
}

export async function submit(submission: Submission): Promise<SubmissionAck> {
  await sleep(LATENCY_MS)
  const event: MapEvent = { cellId: submission.cellId, ts: Date.now(), kind: 'restored' }
  return { accepted: true, event }
}

export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Stable per-browser player id. No account system yet; no secrets here. */
export function playerId(): string {
  const key = 'strata.playerId.v1'
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const id = `p_${randomHex(8)}`
    localStorage.setItem(key, id)
    return id
  } catch {
    return `p_${randomHex(8)}`
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
