import { PIGMENTS } from './palette'

const PARTICLES = 150
const CLOUDS = 7
const DURATION_MS = 1200
const DRAG = 0.0026

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  max: number
  ci: number
}

interface Cloud {
  x: number
  y: number
  r: number
  grow: number
  life: number
  max: number
  ci: number
}

/**
 * A4 — the Holi reveal. Procedural pigment burst: canvas particles over
 * additive blending, ~1.2 s. No video: iOS alpha-video is unreliable
 * (see docs/ARCHITECTURE.md).
 */
export class Holi {
  private particles: Particle[] = []
  private clouds: Cloud[] = []

  get active(): boolean {
    return this.particles.length > 0 || this.clouds.length > 0
  }

  burst(sx: number, sy: number, pigment: number): void {
    const palette = [pigment, (pigment + 2) % PIGMENTS.length, (pigment + 4) % PIGMENTS.length]
    for (let i = 0; i < PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 60 + Math.random() * 380
      const max = DURATION_MS * (0.55 + Math.random() * 0.45)
      this.particles.push({
        x: sx,
        y: sy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        r: 2 + Math.random() * 7,
        life: max,
        max,
        ci: palette[(Math.random() * palette.length) | 0],
      })
    }
    for (let i = 0; i < CLOUDS; i++) {
      const angle = (i / CLOUDS) * Math.PI * 2 + Math.random()
      const dist = Math.random() * 40
      const max = DURATION_MS * (0.6 + Math.random() * 0.4)
      this.clouds.push({
        x: sx + Math.cos(angle) * dist,
        y: sy + Math.sin(angle) * dist,
        r: 18 + Math.random() * 26,
        grow: 90 + Math.random() * 150,
        life: max,
        max,
        ci: palette[(Math.random() * palette.length) | 0],
      })
    }
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000
    const drag = Math.max(0, 1 - DRAG * dtMs)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dtMs
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= drag
      p.vy = p.vy * drag + 320 * dt // pigment settles
    }
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i]
      c.life -= dtMs
      if (c.life <= 0) {
        this.clouds.splice(i, 1)
        continue
      }
      c.r += c.grow * dt
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'

    for (const c of this.clouds) {
      const t = c.life / c.max
      const p = PIGMENTS[c.ci]
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r)
      grad.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${(0.42 * t * t).toFixed(3)})`)
      grad.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const p of this.particles) {
      const t = p.life / p.max
      const col = PIGMENTS[p.ci]
      ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${(0.85 * t).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * (0.4 + 0.6 * t), 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}
