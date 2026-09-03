// The solve rule, isolated so it can be exercised outside a Worker.
// Contracts v1: sha256(salt + ":" + nonce + ":" + playerId) must carry
// >= difficultyBits leading zero bits.

const encoder = new TextEncoder()

export function challengeInput(salt: string, nonce: number, playerId: string): Uint8Array {
  return encoder.encode(`${salt}:${nonce}:${playerId}`)
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

export async function digestBits(salt: string, nonce: number, playerId: string): Promise<number> {
  const digest = await crypto.subtle.digest('SHA-256', challengeInput(salt, nonce, playerId))
  return leadingZeroBits(digest)
}

/** Verifies a claimed nonce — the same check the ledger will run server-side. */
export async function verifySolve(
  salt: string,
  nonce: number,
  playerId: string,
  difficultyBits: number,
): Promise<boolean> {
  return (await digestBits(salt, nonce, playerId)) >= difficultyBits
}
