import { CELL_M, type Vec2 } from './geo'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 8
/** Movement past this (CSS px) means the player is panning, not pressing. */
export const HOLD_SLOP_PX = 12
const GLIDE_DECAY = 0.0022 // per ms
const MIN_GLIDE_SPEED = 40 // px/s

export interface CameraHooks {
  onPressStart(world: Vec2, screen: Vec2): void
  /** reason: the gesture stopped being a press. */
  onPressCancel(reason: 'move' | 'multitouch' | 'cancel'): void
  onPressRelease(): void
}

interface Sample {
  x: number
  y: number
  t: number
}

/**
 * Touch camera (M3). Pointer Events only — one finger pans with an inertial
 * glide, two fingers pinch 0.5x-8x anchored at the midpoint.
 */
export class Camera {
  /** World metres at the centre of the viewport. */
  cx = 0
  cy = 0
  /** Multiplier over fitScale. 1x = the whole boundary fits the viewport. */
  zoom = 1
  fitScale = 1
  vw = 1
  vh = 1
  dpr = 1

  private worldW: number
  private worldH: number
  private pointers = new Map<number, Sample>()
  private pinchDist = 0
  private pinchZoom = 1
  private pinchAnchorWorld: Vec2 = { x: 0, y: 0 }
  private samples: Sample[] = []
  private vx = 0
  private vy = 0
  private pressing = false
  private pressOrigin: Sample | null = null

  constructor(
    worldW: number,
    worldH: number,
    private canvas: HTMLCanvasElement,
    private hooks: CameraHooks,
  ) {
    this.worldW = worldW
    this.worldH = worldH
    this.cx = worldW / 2
    this.cy = worldH / 2
    this.attach()
  }

  get scale(): number {
    return this.fitScale * this.zoom
  }

  /** Metres per CSS pixel — used by the renderer to pick line weights. */
  get cellPx(): number {
    return CELL_M * this.scale
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.vw = rect.width
    this.vh = rect.height
    this.canvas.width = Math.round(rect.width * this.dpr)
    this.canvas.height = Math.round(rect.height * this.dpr)
    // Fit the whole boundary with a small margin; that framing *is* 1x zoom.
    this.fitScale = Math.min(this.vw / this.worldW, this.vh / this.worldH) * 0.94
    this.clamp()
  }

  toScreen(wx: number, wy: number): Vec2 {
    const s = this.scale
    return { x: (wx - this.cx) * s + this.vw / 2, y: (wy - this.cy) * s + this.vh / 2 }
  }

  toWorld(sx: number, sy: number): Vec2 {
    const s = this.scale
    return { x: (sx - this.vw / 2) / s + this.cx, y: (sy - this.vh / 2) / s + this.cy }
  }

  /** Visible world rectangle, in metres. */
  viewport(): { x0: number; y0: number; x1: number; y1: number } {
    const a = this.toWorld(0, 0)
    const b = this.toWorld(this.vw, this.vh)
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }
  }

  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.toWorld(sx, sy)
    this.zoom = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM)
    const after = this.toWorld(sx, sy)
    this.cx += before.x - after.x
    this.cy += before.y - after.y
    this.clamp()
  }

  /** Inertial glide. Called once per frame with the frame delta in ms. */
  step(dtMs: number): void {
    if (this.pointers.size > 0) return
    const speed = Math.hypot(this.vx, this.vy)
    if (speed < MIN_GLIDE_SPEED) {
      this.vx = 0
      this.vy = 0
      return
    }
    const s = this.scale
    this.cx -= (this.vx * dtMs) / 1000 / s
    this.cy -= (this.vy * dtMs) / 1000 / s
    const decay = Math.exp(-GLIDE_DECAY * dtMs)
    this.vx *= decay
    this.vy *= decay
    this.clamp()
  }

  private clamp(): void {
    // Allow half a screen of overscroll so edge cells are reachable, no further.
    const marginX = this.vw / (2 * this.scale)
    const marginY = this.vh / (2 * this.scale)
    this.cx = clamp(this.cx, -marginX, this.worldW + marginX)
    this.cy = clamp(this.cy, -marginY, this.worldH + marginY)
  }

  private attach(): void {
    const c = this.canvas
    c.addEventListener('pointerdown', (e) => this.onDown(e))
    c.addEventListener('pointermove', (e) => this.onMove(e))
    c.addEventListener('pointerup', (e) => this.onUp(e, false))
    c.addEventListener('pointercancel', (e) => this.onUp(e, true))
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false })
    // Long-press on iOS otherwise raises the callout / selection UI.
    c.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private local(e: PointerEvent): Sample {
    const rect = this.canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() }
  }

  private onDown(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId)
    const p = this.local(e)
    this.pointers.set(e.pointerId, p)
    this.vx = 0
    this.vy = 0

    if (this.pointers.size === 1) {
      this.samples = [p]
      this.pressing = true
      this.pressOrigin = p
      this.hooks.onPressStart(this.toWorld(p.x, p.y), { x: p.x, y: p.y })
    } else if (this.pointers.size === 2) {
      this.endPress('multitouch')
      this.beginPinch()
    }
  }

  private beginPinch(): void {
    const [a, b] = [...this.pointers.values()]
    this.pinchDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
    this.pinchZoom = this.zoom
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    this.pinchAnchorWorld = this.toWorld(mid.x, mid.y)
  }

  private onMove(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return
    const prev = this.pointers.get(e.pointerId)!
    const p = this.local(e)
    this.pointers.set(e.pointerId, p)

    if (this.pointers.size === 1) {
      if (this.pressing && this.pressOrigin) {
        const moved = Math.hypot(p.x - this.pressOrigin.x, p.y - this.pressOrigin.y)
        if (moved > HOLD_SLOP_PX) this.endPress('move')
      }
      const s = this.scale
      this.cx -= (p.x - prev.x) / s
      this.cy -= (p.y - prev.y) / s
      this.samples.push(p)
      if (this.samples.length > 6) this.samples.shift()
      this.clamp()
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
      this.zoom = clamp((dist / this.pinchDist) * this.pinchZoom, MIN_ZOOM, MAX_ZOOM)
      // Keep the world point that was under the midpoint pinned to the midpoint.
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const now = this.toWorld(mid.x, mid.y)
      this.cx += this.pinchAnchorWorld.x - now.x
      this.cy += this.pinchAnchorWorld.y - now.y
      this.clamp()
    }
  }

  private onUp(e: PointerEvent, cancelled: boolean): void {
    if (!this.pointers.delete(e.pointerId)) return
    if (this.pointers.size === 1) {
      // Second finger lifted mid-pinch: re-seat panning on the survivor.
      this.samples = [[...this.pointers.values()][0]]
      return
    }
    if (this.pointers.size === 0) {
      if (this.pressing) {
        this.pressing = false
        this.pressOrigin = null
        if (cancelled) this.hooks.onPressCancel('cancel')
        else this.hooks.onPressRelease()
      }
      this.flingFromSamples()
    }
  }

  private flingFromSamples(): void {
    const n = this.samples.length
    if (n < 2) return
    const a = this.samples[0]
    const b = this.samples[n - 1]
    const dt = b.t - a.t
    if (dt <= 0 || dt > 120) return
    this.vx = ((b.x - a.x) / dt) * 1000
    this.vy = ((b.y - a.y) / dt) * 1000
  }

  private endPress(reason: 'move' | 'multitouch'): void {
    if (!this.pressing) return
    this.pressing = false
    this.pressOrigin = null
    this.hooks.onPressCancel(reason)
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const factor = Math.exp(-e.deltaY * 0.0016)
    this.zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top)
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
