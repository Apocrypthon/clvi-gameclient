# ENERGY

Every artifact card prints what its solve probably cost. This file is the set of
assumptions behind that number, so the estimate can be argued with.

## The formula

```
estKwh = (ms / 3.6e9) * WATTS[deviceClass]
```

Frozen in SEED.md and implemented in `src/energy.ts`. `ms / 3.6e9` converts
milliseconds to hours and then to the kilo- scale; multiplying by watts gives
kilowatt-hours. The card shows watt-hours, because a solve is a fraction of one.

| deviceClass | watts | how it is guessed |
| --- | --- | --- |
| phone | 3 | `iPhone`/`Android Mobile` in the UA, or touch with a short edge under 820 px |
| tablet | 5 | `iPad`, or touch-capable `Macintosh` (iPadOS lies about being a Mac) |
| laptop | 15 | the fallback |
| desktop | 45 | no touch and a short edge of 1000 px or more |

## What this number is not

**It is not a measurement.** No browser API reports power draw. The Battery Status
API gives a level and a charging flag, nothing else, and it is unavailable in
Safari entirely — which is the platform this client targets first.

So the estimate is: *whole-device active power for a device of this class,
multiplied by wall-clock solve time.* Every one of those words is a compromise:

- **Whole-device, not marginal.** A phone with the screen on and the radio awake is
  already drawing most of that 3 W. The solve's *marginal* cost — the extra draw
  from running one core hot for a few seconds — is smaller, plausibly by half. The
  estimate is therefore an **over**-estimate of the incremental cost, and that is
  the direction we want to be wrong in.
- **Wall-clock, not CPU time.** The worker batches 512 concurrent digests and
  awaits them; the device is not pinned for the whole interval. Again: over, not
  under.
- **Class, not model.** An A18 and a five-year-old mid-range Android are both
  "phone" at 3 W. The bucket is coarse and the card says so.
- **The device class is inferred from a user-agent string**, which is a string
  anyone can change and which browsers are actively making less informative.

An honest single sentence: *this is the right order of magnitude, biased high, and
it is not a meter.*

## What it comes out to

At 17 difficulty bits the median solve is `ln(2) * 2^17 ≈ 90 900` hashes. Measured
in headless Chromium on the build container at 41 000–105 000 h/s (the spread is
container CPU contention), that is 0.9–2.3 s there. A phone is expected to be
several times slower — **expected, not measured**; no real device was reachable
from the bootstrap environment, and closing that gap is the top FIND item in
docs/STATE.md#Next. The table below assumes the phone figure:

| device | median solve | est. energy | in other terms |
| --- | --- | --- | --- |
| phone @ 3 W | ~2–5 s | 0.002–0.004 Wh | ~1/1000th of charging a phone 1 % |
| laptop @ 15 W | ~2 s | ~0.008 Wh | |
| a full day at the 60-solve cap, phone | | ~0.2 Wh | less than one minute of charging |

The cap exists so that last row stays true. A player who exhausts the daily cap has
spent, on this estimate, a rounding error against the energy of loading the page
that showed it to them.

## The guardrails, and why each one is there

| guardrail | value | where | why |
| --- | --- | --- | --- |
| daily cap | 60 solves | `dig.ts`, `strata.solves.v1` | an upper bound on the day's total, disclosed in the HUD |
| hard cap | 30 s | `mockLedger.ts`, enforced in the worker | a solve that is not landing stops, rather than grinding |
| backoff | −4 bits | `dig.ts` | on the cap, ask for an *easier* challenge — never a longer grind |
| low battery | −2 bits | `solver.ts` `batteryIsLow()` | under 20 %, ask for relief **before** starting, not after |
| difficulty floor | 8 bits | `mockLedger.ts` | backoff cannot spiral; the dig always terminates |
| one worker | 1 | `solver.ts` | the ceiling on parallelism is structural, not a setting |

The daily cap is a **courtesy, not a security boundary**. It is client-side
localStorage; anyone who wants to clear it can. That is fine — it is there to keep
the honest default honest, and the real cap will be server-side when the ledger
lands.

## Tuning difficulty without breaking the stance

`DEFAULT_DIFFICULTY_BITS` in `src/mockLedger.ts` is the one knob, and it moves the
energy estimate exponentially: **each added bit doubles the expected work, the
expected time, and the estimated watt-hours.** The target in SEED.md is a 3–6 s
median on a phone, and it is a target for *player feel*, not for throughput.

Before changing it, measure — `npm run verify` prints the local hash rate and what
it implies. Do not raise it because solves feel fast on a desktop.

## If the stance is ever in tension with the mechanic

The mechanic loses. Cheaper to disclose than to justify is the wrong direction —
that is CLAUDE.md's rule, and this file is where the justification has to hold up.
