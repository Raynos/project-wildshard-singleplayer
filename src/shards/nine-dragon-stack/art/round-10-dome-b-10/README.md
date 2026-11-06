# Round 10 · dome B, round 10 (E169, 2026-09-26): polishing the dome in the engine

Same capture as round 9 (`scratchpad/domeb/capeng.mjs`, a private snapshot of the working tree on `:5263`, phone tier,
iPhone UA, the real HUD on the spawn), same targets (`../round-10-dome-b-1/target-*.jpg`).
`eye-check.jpg`: round 9 · round 10 · style-A for the spawn; round 9 · round 10 · target for views 5, 6, 1.
`sheet-ingame-3x3.jpg`: all nine views and the spawn.

## Gaps read this round (views 1–9 vs their targets)

- 1: the gate's lintels are flat painted panels; target-1's are gilded relief.
- 5 (back toward the spawn): the hawker stall's back is a bare brown slab; everything else reads.
- 6 (up at the gate and the banyan): the new root curtain reads as a bar code of straight tubes from below.
- 3, 4: close to their targets in content; the gap is the ground's wet reflections and the light (the render lane).

## What changed (and reverts)

| Change | File | By eye |
|---|---|---|
| A carved gold dragon among clouds in the cartouche of every painted beam (both faces; `relief()` in gilt) | `gate.ts` | 1: the lintels read carved, as in target-1 |
| The SW root curtain 110 → 70 roots, thinner (0.012–0.03 m), each wandering in 4 points instead of 3 | `banyan.ts` | 6: less of a bar code; still denser than target-6's braided cords (next round: bundle them) |
| The hawker stall's back: a blue tarp tied over the back wall, stacked crates and stools, a water barrel, a posted notice | `stalls.ts` | 5: reads as a stall's cluttered back (the first try had the tarp's winding reversed: invisible from the north; fixed) |

Nothing reverted this round.

## Rulers

- Draw calls 100–127, triangles 1.86–2.30 M per frame (round 9: 94–122, 1.62–1.95 M). Dome B's share of the rise is
  small (the beam reliefs ~15 k, the stall's back ~3 k; the curtain −8 k); the rest arrived in the working tree between
  the two captures (other lanes). View 8 is the high point at 2.30 M: close to the 2.5 M budget — worth watching.
- Gates: `tsc --noEmit` clean; oxlint clean on dome B's files.

## Waiting on

The per-shard portrait FOV (the port lead): then the spawn is re-shot against style-A and the right third re-balanced.
