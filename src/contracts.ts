// Contracts v1 — FROZEN. Change only via clvi-architecture.
// Mirrored verbatim from SEED.md; docs/ARCHITECTURE.md explains the flow.

export type DeviceClass = 'phone' | 'tablet' | 'laptop' | 'desktop'

export interface Challenge {
  challengeId: string
  salt: string
  difficultyBits: number
  expiresAt: number
}

export interface Submission {
  challengeId: string
  playerId: string
  cellId: string
  artifactId: string
  /** A string server-side: 1-128 chars of printable ASCII, never ":" (it is the
   *  preimage separator). The client sends the decimal form of the nonce it
   *  found, which is exactly what it hashed. */
  nonce: string
  hashes: number
  ms: number
  deviceClass: DeviceClass
}

export interface MapEvent {
  cellId: string
  ts: number
  kind: 'restored'
}

/** Ack returned by the ledger for an accepted Submission. */
export interface SubmissionAck {
  accepted: boolean
  event: MapEvent
}
