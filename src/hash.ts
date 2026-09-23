// The solve rule, isolated so it can be exercised outside a Worker.
// Contracts v1: sha256(salt + ":" + nonce + ":" + playerId) must carry
// >= difficultyBits leading zero bits.

const encoder = new TextEncoder()

/** The nonce is a STRING here, and it is the same string that goes on the wire.
 *  Hashing one representation and submitting another is the bug this signature
 *  exists to prevent. */
export function challengeInput(salt: string, nonce: string, playerId: string): Uint8Array {
  return encoder.encode(`${salt}:${nonce}:${playerId}`)
}

/** The backend's rule: 1-128 chars, printable ASCII, no ":". */
const NONCE_PATTERN = /^[\x21-\x39\x3b-\x7e]{1,128}$/

export function isValidNonce(nonce: string): boolean {
  return NONCE_PATTERN.test(nonce)
}

export function leadingZeroBits(buf: ArrayBuffer): number {
  const view = new Uint8Array(buf)
  let bits = 0
  for (let i = 0; i < view.length; i++) {
    const byte = view[i]
    if (byte === 0) {
      bits += 8
      continue
    }
    return bits + (Math.clz32(byte) - 24)
  }
  return bits
}

export async function digestBits(salt: string, nonce: string, playerId: string): Promise<number> {
  const digest = await crypto.subtle.digest('SHA-256', challengeInput(salt, nonce, playerId))
  return leadingZeroBits(digest)
}

/** Verifies a claimed nonce — the same check the ledger will run server-side. */
export async function verifySolve(
  salt: string,
  nonce: string,
  playerId: string,
  difficultyBits: number,
): Promise<boolean> {
  return (await digestBits(salt, nonce, playerId)) >= difficultyBits
}
