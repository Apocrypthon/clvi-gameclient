/// <reference lib="webworker" />

// A3 — the solve. ONE worker, WebCrypto only, no wasm.
// Rule (Contracts v1): sha256(salt + ":" + nonce + ":" + playerId) must have
// >= difficultyBits leading zero bits.

export interface SolveRequest {
  type: 'solve'
  salt: string
  playerId: string
  difficultyBits: number
  startNonce: number
  hardCapMs: number
}

export type SolveMessage =
  | { type: 'progress'; hashes: number; ms: number; hps: number }
  | { type: 'solved'; nonce: number; hashes: number; ms: number }
  | { type: 'timeout'; hashes: number; ms: number }

import { challengeInput, leadingZeroBits } from './hash'

const BATCH = 512 // measured plateau for subtle.digest throughput; see docs/STATE.md#Verify
const PROGRESS_MS = 200

const ctx = self as unknown as DedicatedWorkerGlobalScope

let generation = 0

ctx.addEventListener('message', (e: MessageEvent) => {
  const msg = e.data as SolveRequest | { type: 'cancel' }
  if (msg.type === 'cancel') {
    generation++
    return
  }
  if (msg.type === 'solve') void run(msg, ++generation)
})

async function run(req: SolveRequest, gen: number): Promise<void> {
  const started = performance.now()
  let nonce = req.startNonce
  let hashes = 0
  let lastProgress = started

  for (;;) {
    if (gen !== generation) return

    const found = await scanBatch(req, nonce)
    hashes += BATCH
    nonce += BATCH
    if (gen !== generation) return

    if (found >= 0) {
      post({ type: 'solved', nonce: found, hashes, ms: performance.now() - started })
      return
    }

    const now = performance.now()
    if (now - lastProgress >= PROGRESS_MS) {
      const ms = now - started
      post({ type: 'progress', hashes, ms, hps: (hashes / ms) * 1000 })
      lastProgress = now
    }
    if (now - started >= req.hardCapMs) {
      post({ type: 'timeout', hashes, ms: now - started })
      return
    }
  }
}

/** Fires BATCH digests concurrently; subtle.digest per-call overhead dominates,
 *  so batching is what keeps the phone in the 3–6 s window. */
async function scanBatch(req: SolveRequest, start: number): Promise<number> {
  const jobs: Promise<ArrayBuffer>[] = new Array(BATCH)
  for (let i = 0; i < BATCH; i++) {
    jobs[i] = crypto.subtle.digest('SHA-256', challengeInput(req.salt, start + i, req.playerId))
  }
  const digests = await Promise.all(jobs)
  for (let i = 0; i < BATCH; i++) {
    if (leadingZeroBits(digests[i]) >= req.difficultyBits) return start + i
  }
  return -1
}

function post(msg: SolveMessage): void {
  ctx.postMessage(msg)
}
