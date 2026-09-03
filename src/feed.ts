import type { MapEvent } from './contracts'

const POLL_MS = 20_000
const LIVE_URL = '/map-events'
const LIVE_MISSES_BEFORE_BACKOFF = 2
const LIVE_REPROBE_EVERY = 10 // polls, i.e. ~3.3 minutes
const MOCK_URL = `${import.meta.env.BASE_URL}mock/map-events.json`

export type FeedStatus = 'idle' | 'live' | 'mock' | 'error'

/**
 * Event feed (M5). Polls GET /map-events?since=<ts> every 20 s and falls back
 * to public/mock/map-events.json while the backend is not live.
 * Dedupe by cellId+ts happens in Regen.applyEvent.
 */
export class MapEventFeed {
  status: FeedStatus = 'idle'
  private since = 0
  private timer: number | undefined
  private liveMisses = 0
  private polls = 0

  constructor(private onEvents: (events: MapEvent[]) => void) {}

  start(): void {
    void this.poll()
    this.timer = window.setInterval(() => void this.poll(), POLL_MS)
  }

  stop(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer)
  }

  async poll(): Promise<void> {
    // Probe the real endpoint until it has missed a few times, then re-probe
    // only every LIVE_REPROBE_EVERY polls so a 404 backend is not hammered
    // (and the console is not flooded) while the client still notices go-live.
    const probeLive = this.liveMisses < LIVE_MISSES_BEFORE_BACKOFF || this.polls % LIVE_REPROBE_EVERY === 0
    this.polls++
    if (probeLive) {
      const live = await fetchEvents(`${LIVE_URL}?since=${this.since}`)
      if (live) {
        this.liveMisses = 0
        this.status = 'live'
        this.ingest(live)
        return
      }
      this.liveMisses++
    }
    const mock = await fetchEvents(MOCK_URL)
    if (mock) {
      this.status = 'mock'
      this.ingest(mock.filter((e) => e.ts > this.since))
      return
    }
    this.status = 'error'
  }

  private ingest(events: MapEvent[]): void {
    if (!events.length) return
    for (const e of events) this.since = Math.max(this.since, e.ts)
    this.onEvents(events)
  }
}

async function fetchEvents(url: string): Promise<MapEvent[] | null> {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) return null
    const body: unknown = await res.json()
    const list = Array.isArray(body) ? body : (body as { events?: unknown }).events
    if (!Array.isArray(list)) return null
    return list.filter(
      (e): e is MapEvent =>
        !!e && typeof e.cellId === 'string' && typeof e.ts === 'number' && e.kind === 'restored',
    )
  } catch {
    return null
  }
}
