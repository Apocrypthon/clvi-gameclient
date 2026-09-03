import type { DigResult } from './dig'
import { WATTS } from './energy'
import { formatWh } from './energy'
import { pigmentCss } from './palette'
import type { FeedStatus } from './feed'

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`missing #${id}`)
  return node as T
}

export class Hud {
  private restored = el('stat-restored')
  private feed = el('stat-feed')
  private readout = el('readout')
  private notice = el('notice')
  private cardLayer = el('card-layer')
  private noticeTimer: number | undefined

  constructor(onCloseCard: () => void) {
    el('build-stamp').textContent = `· ${__BUILD_STAMP__}`
    el('card-close').addEventListener('click', () => {
      this.hideCard()
      onCloseCard()
    })
  }

  setStats(restored: number, total: number, feed: FeedStatus): void {
    this.restored.textContent = `${restored} / ${total} restored`
    this.feed.textContent = feed === 'mock' ? 'feed · mock' : `feed · ${feed}`
  }

  setReadout(text: string): void {
    this.readout.textContent = text
  }

  notify(text: string): void {
    this.notice.textContent = text
    this.notice.classList.add('show')
    if (this.noticeTimer !== undefined) window.clearTimeout(this.noticeTimer)
    this.noticeTimer = window.setTimeout(() => this.notice.classList.remove('show'), 2600)
  }

  showCard(result: DigResult, pigment: number): void {
    const { artifact } = result
    el('card-rarity').textContent = `${artifact.rarity} · ${artifact.stratum}`
    el('card-rarity').style.color = pigmentCss(pigment, 0.95)
    el('card-name').textContent = artifact.name
    el('card-era').textContent = `${artifact.era} · recovered from ${result.cellId}`
    el('card-blurb').textContent = artifact.blurb

    const seconds = (result.ms / 1000).toFixed(1)
    el('card-stats').innerHTML = rows([
      ['Solve', `${seconds} s`],
      ['Hashes', result.hashes.toLocaleString()],
      ['Rate', `${Math.round(result.hps).toLocaleString()} h/s`],
      ['Difficulty', `${result.difficultyBits} bits`],
      ['Nonce', String(result.nonce)],
    ])

    el('card-energy').textContent =
      `Est. ${formatWh(result.wh)} — ${result.ms} ms at ${WATTS[result.deviceClass]} W ` +
      `(${result.deviceClass}, inferred). An estimate, not a measurement: assumptions in docs/ENERGY.md.`

    this.cardLayer.hidden = false
  }

  hideCard(): void {
    this.cardLayer.hidden = true
  }

  get cardOpen(): boolean {
    return !this.cardLayer.hidden
  }
}

function rows(pairs: [string, string][]): string {
  return pairs
    .map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`)
    .join('')
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
}
