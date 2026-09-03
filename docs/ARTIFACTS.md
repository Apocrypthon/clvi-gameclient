# ARTIFACTS

Twenty finds, in `src/registry.ts`. This file is the reasoning; that file is the
data. They must not drift.

## What counts as a find

Paradise is a young site with an unusually legible stratigraphy. A pull-tab dates
to a decade because the ring-tab was legal to drop and then abruptly was not. A
cancelled die dates to a house. Casino carpet fibre is solution-dyed nylon
engineered to hide everything, and it outlasts the property it was woven for.

So the registry is **industrial and municipal ephemera**, dated by manufacture and
disposal, in the strata that a 150 m cell would actually yield. Depth in the
`stratum` field is narrative, not survey — it exists so the cards sort into a
felt sense of "shallow and common" versus "deep and rare".

**Deliberately excluded: Indigenous material.** The Southern Paiute were here
before any of this and are here now. Their artifacts are not loot, not a rarity
tier, and not a reveal animation. The registry starts at the ranching era and
works forward. If a future session wants pre-1900 Paradise in the game, that is a
consultation question, not a content question.

## Rarity and the draw

| tier | weight | count | share of draws |
| --- | --- | --- | --- |
| common | 100 | 6 | ~62 % |
| uncommon | 45 | 6 | ~28 % |
| rare | 14 | 5 | ~7 % |
| legendary | 4 | 3 | ~1.5 % |

`drawArtifact(seed)` walks the registry accumulating weights against one
mulberry32 draw. The seed is `seedFrom(cellId + ":" + challengeId)` — FNV-1a over
that string — so a given cell and challenge always yield the same find. That is
the testability contract: `npm run verify` asserts reproducibility, that 20 000
draws reach every entry, and that commons outnumber legendaries by more than 5x.

Note what the seed is *not*: it is not the nonce. The find is decided by the
challenge, not by how long you hashed. Grinding does not improve your draw, and
that is on purpose — see `docs/VISION.md`.

## The registry

### Common — surface to 15 cm

- **Pull-Tab Stratum** (1965–1975) — a compacted layer of aluminium ring-tabs,
  datable to the decade the tab was legal to litter.
- **Swamp Cooler Pad Fibre** (1940–1990) — aspen excelsior, salt-crusted. The
  valley cooled itself by evaporating the thing it had least of.
- **Plastic Swizzle Stick** (1955–1990) — styrene, moulded with a property that no
  longer exists.
- **Casino Carpet Fibre Bloom** (1970–1995) — a pattern engineered to hide
  everything. It hid nothing from the soil.
- **Matchbook Cover, Unstruck** (1940–1980) — a phone number three digits short of
  dialable today.
- **Keno Pencil** (1950–2000) — eight inches of statistical optimism.

### Uncommon — 10 to 30 cm

- **Payphone Coin-Return Flap** (1960–1998) — checked by every passer-by for forty
  years.
- **Drive-In Speaker Grille** (1950–1970) — from a lot that is now a lot.
- **Motor-Court Key Fob** (1948–1972) — lucite teardrop, postage guaranteed.
- **Slot Handle Return Spring** (1955–1980) — music wire, fatigued, retired by the
  button.
- **Linen Postcard, Fragment** (1935–1955) — the valley was already selling a
  version of itself.
- **Jet-Age Baggage Tag** (1960–1979) — arrived, and did not leave.

### Rare — 20 to 50 cm

- **Atomic-Era Bottle Glass** (1951–1962) — sun-purpled manganese glass from a
  dawn-picnic thermos. People drove north to watch.
- **Showgirl Sequin Cluster** (1957–1985) — gelatin sequins fused into one
  iridescent lens by a hot summer.
- **Cancelled Dice, Drilled** (1960–2005) — drilled through the six so it can never
  be played again.
- **Neon Tube Shard** (1946–1990) — lead glass, phosphor still banded inside. Held
  argon and one specific promise.
- **Ranch Fence Staple** (1900–1940) — from the alfalfa and dairy years, before the
  Strip, when this was water and dirt.

### Legendary — 30 to 60 cm

- **Silver Strike Token** (1988–1999) — .999 silver in a brass ring, paid out for a
  jackpot nobody redeemed.
- **Clay Chip Fragment** (1931–1970) — an inlay from a house that closed before the
  moon landing.
- **Imploded Concrete Aggregate** (1993–2007) — rebar-scarred, edges rounded: the
  signature of a controlled demolition and a crowd that cheered.

## Adding to the registry

Keep it at 15–20 entries — the seed is explicit about that, and a registry that
grows without bound dilutes every card already minted. Replace before you append.
Each entry needs `id`, `name`, `era`, `rarity`, `stratum`, and a blurb that earns
its place: one fact, one turn. Then re-run `npm run verify`.
