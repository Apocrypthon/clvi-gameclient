// A1 — the strata registry. Vegas archaeology: what the valley actually leaves
// behind. Narrative notes live in docs/ARTIFACTS.md; this file is the data.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface Artifact {
  id: string
  name: string
  era: string
  /** Draw weight. Higher is commoner; see RARITY_WEIGHT. */
  weight: number
  rarity: Rarity
  stratum: string
  blurb: string
}

export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 100,
  uncommon: 45,
  rare: 14,
  legendary: 4,
}

function a(
  id: string,
  name: string,
  era: string,
  rarity: Rarity,
  stratum: string,
  blurb: string,
): Artifact {
  return { id, name, era, rarity, weight: RARITY_WEIGHT[rarity], stratum, blurb }
}

export const REGISTRY: Artifact[] = [
  a('pull-tab-stratum', 'Pull-Tab Stratum', '1965–1975', 'common', 'Surface / 0–5 cm',
    'A compacted layer of aluminium ring-tabs. Datable to the decade: the tab was legal to litter, then it was not.'),
  a('swamp-cooler-fiber', 'Swamp Cooler Pad Fibre', '1940–1990', 'common', 'Surface / 0–5 cm',
    'Aspen excelsior, salt-crusted. The valley cooled itself by evaporating the thing it had least of.'),
  a('swizzle-stick', 'Plastic Swizzle Stick', '1955–1990', 'common', '0–10 cm',
    'Styrene, moulded with a property that no longer exists. Bar-top ephemera outlasts the bar.'),
  a('carpet-fiber-bloom', 'Casino Carpet Fibre Bloom', '1970–1995', 'common', '0–10 cm',
    'Solution-dyed nylon in a pattern engineered to hide everything. It hid nothing from the soil.'),
  a('matchbook-cover', 'Matchbook Cover, Unstruck', '1940–1980', 'common', '5–15 cm',
    'Paperboard with a phone number three digits short of dialable today.'),
  a('keno-pencil', 'Keno Pencil', '1950–2000', 'common', '5–15 cm',
    'Blunt, waxy, crayon-cored. Eight inches of statistical optimism.'),
  a('payphone-flap', 'Payphone Coin-Return Flap', '1960–1998', 'uncommon', '10–20 cm',
    'Chromed steel, sprung. Checked by every passer-by for forty years.'),
  a('drive-in-grille', 'Drive-In Speaker Grille', '1950–1970', 'uncommon', '10–25 cm',
    'Perforated steel from a lot that is now a lot.'),
  a('motor-court-fob', 'Motor-Court Key Fob', '1948–1972', 'uncommon', '10–25 cm',
    'Lucite teardrop, room number still legible. Postage guaranteed if dropped in any mailbox.'),
  a('slot-handle-spring', 'Slot Handle Return Spring', '1955–1980', 'uncommon', '15–30 cm',
    'Music wire, fatigued. Retired by the button.'),
  a('linen-postcard', 'Linen Postcard, Fragment', '1935–1955', 'uncommon', '15–30 cm',
    'Textured stock, colours over-saturated at the press. The valley was already selling a version of itself.'),
  a('jet-age-baggage-tag', 'Jet-Age Baggage Tag', '1960–1979', 'uncommon', '15–30 cm',
    'Fibre stock, McCarran routing code. Arrived, and did not leave.'),
  a('atomic-bottle-glass', 'Atomic-Era Bottle Glass', '1951–1962', 'rare', '20–40 cm',
    'Sun-purpled manganese glass from a dawn-picnic thermos. People drove north to watch.'),
  a('showgirl-sequin', 'Showgirl Sequin Cluster', '1957–1985', 'rare', '20–40 cm',
    'Gelatin sequins fused into a single iridescent lens by one hot summer.'),
  a('cancelled-dice', 'Cancelled Dice, Drilled', '1960–2005', 'rare', '20–40 cm',
    'Cellulose acetate, edges shaved, drilled through the six so it can never be played again.'),
  a('neon-tube-shard', 'Neon Tube Shard', '1946–1990', 'rare', '25–45 cm',
    'Lead glass with phosphor still banded inside. Held argon and one specific promise.'),
  a('ranch-fence-staple', 'Ranch Fence Staple', '1900–1940', 'rare', '30–50 cm',
    'Hand-forged, from the alfalfa and dairy years — before the Strip, when this was just water and dirt.'),
  a('silver-strike-token', 'Silver Strike Token', '1988–1999', 'legendary', '30–50 cm',
    '.999 silver in a brass ring, paid out of a slot for a jackpot nobody redeemed.'),
  a('clay-chip-fragment', 'Clay Chip Fragment', '1931–1970', 'legendary', '35–55 cm',
    'Compression-moulded clay composite with an inlay from a house that closed before the moon landing.'),
  a('imploded-aggregate', 'Imploded Concrete Aggregate', '1993–2007', 'legendary', '40–60 cm',
    'Rebar-scarred concrete with rounded edges: the signature of a controlled demolition and a crowd that cheered.'),
]

export const TOTAL_WEIGHT = REGISTRY.reduce((sum, art) => sum + art.weight, 0)

/** mulberry32 — small, fast, and seedable so draws are reproducible in tests. */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a over a string — turns a cellId+challengeId into a draw seed. */
export function seedFrom(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Weighted draw. Same seed, same artifact — that is the testability contract. */
export function drawArtifact(seed: number): Artifact {
  const next = rng(seed)
  let roll = next() * TOTAL_WEIGHT
  for (const art of REGISTRY) {
    roll -= art.weight
    if (roll <= 0) return art
  }
  return REGISTRY[REGISTRY.length - 1]
}
