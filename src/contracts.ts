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
  nonce: number
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
