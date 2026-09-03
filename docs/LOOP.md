# LOOP

The protocol every CLVI repo runs. **This file governs its own revision**: if a
session learns a better way to run the loop, it edits this file as part of that
session's increment.

## BOOT

1. `CLAUDE.md`
2. this file
3. `docs/STATE.md` — where the last session stopped and what is next
4. the last three entries of `docs/CHANGELOG.md`

Do not skim STATE.md. It is written for you specifically, by someone with your
job and none of your context.

## WORK

Take **the single smallest next improvement** from STATE.md#Next, across either
track. When both tracks are equally ready, alternate — MAP then FIND then MAP.

Implement it **completely**. One increment per session, finished, beats two
half-landed. "Completely" includes the docs that describe it: a feature whose
documentation says something else is not done.

If the increment turns out to be bigger than it looked, split it and land the
smaller half properly rather than landing the whole thing badly.

## VERIFY

In this order:

1. `npm run build` — `tsc --noEmit && vite build`. Non-negotiable.
2. `npm run verify` — the headless checks.
3. The browser checks in `docs/STATE.md#Verify`, when the increment touches
   anything a player can see.

**Verify by observation, not by intention.** If the increment changes what is on
screen, look at what is on screen — take a screenshot and open it. The bootstrap
session shipped a bloom that was mathematically correct and visually confetti;
the tests all passed, and one screenshot caught it.

**Measure before tuning.** Any constant that controls how something *feels* —
difficulty bits, diffusion rate, hold duration, batch size — gets a measurement
in the same session that changes it, and the measurement goes in the CHANGELOG
entry. A number chosen by intuition and defended by a passing test is a number
nobody can revisit.

## RECORD

- Rewrite `docs/STATE.md` so a stranger could continue. Not a diff of what
  changed: the current state of the world, with Next re-ordered.
- Append **one** entry to `docs/CHANGELOG.md`: date · what · why · files · verify
  result. Newest first. Include the numbers you measured.
- Update any doc the increment made wrong. A doc that describes a repo that no
  longer exists is a bug as real as a failing build.
- If the loop itself could run better, revise this file.

## SHIP

```
git add -A
git commit -m "loop: <summary>"
git push -u origin <branch>
```

The branch is whatever the session's harness designates — SEED.md says `loop`,
but a session started on a different branch ships to that branch and records the
divergence at the top of STATE.md. Never push to a branch you were not given.

## STOP

Leave the repo green. Build passing, verify passing, docs true.

If you are blocked after two attempts, stop attempting. Write the blocker at the
top of STATE.md — what you tried, what happened, what you would try next — and
spend the rest of the session on tests or docs instead. A well-described blocker
is a real increment; a third failed attempt is not.

## The rule behind all of it

There is no memory between sessions. The docs *are* the memory, and they are the
deliverable as much as the code is. Write them for the stranger who is you.
