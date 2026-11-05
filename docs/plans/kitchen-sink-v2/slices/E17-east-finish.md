# E17: the east finish (memory, frame floor, grid-ready, Jake plays the east)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the east half of parent
**K10** (grid-ready: memory ≤ 1.2 GB Explorer, one-frame looks, baked tiles, entries, edge profile) and **K12** (Jake
plays it on the phone), the grid swap W12 deferred (W12 Q1 b: "only after the east is done too"), and **W21**'s docs for
every east feature (a SHARDS.md section and a template example row each). Deletes the remaining Developer rows the
east added (E0h's 30-Mite spawn, any left).

## 1. The showcase piece

The whole shard, one walk: arrive at level 1, the town, band 1 to band 6, the night shift, a rare, Big Pallet, the
stealth yard and the Keycard, storm hour, the Vault and its Warden, the night elites, the gauntlet and the Foreman, the
Titan gate, the portal, the intro, the Titan, the Cleaver, the shard-complete card.

## 2. Engine / game / host work, just in time

No new host. The heavy proofs AGENTS.md runs per milestone:

| Check | Tool | Bar |
|---|---|---|
| Memory | `scripts/grid-ready-memory.mjs` on the Simulator (`scripts/sim-lane.sh`, quiet window) at three peaks: band 1 full, a gauntlet court at 9 live, the Titan arena loaded with the surface's near tiles | ≤ 1.8 GB loading, ≤ 1.2 GB Explorer for the shard |
| Frame floor | `scripts/frame-floor-grid.mjs` on a served build of HEAD | the phone budget rows |
| Enemy cap | count awake and posed robots at the three peaks | ≤ 12 awake, ≤ 16 posed |
| Physics walk | `node scripts/physics-baseline.mjs --no-build --mode=walk` | 0 stuck, bands, Vault, courts, arena |
| Boot smoke, grid entries | the exact-SHA boot smoke; `scripts/grid-ready-chromium.mjs`, `scripts/physics-grid-entry.mjs` | green |
| One-frame looks | the goldens skill, the east cameras of the 24 | Opus reads every panel |

Then the grid swap: the hologram plot at [−1,−1] (`open-plot-sw`, `src/game/shared/grid/singleplayer.json`; W0a's finding) is
replaced by `showcase-template` once Jake's pass says so (G972 forbids a Developer-only cell: a public change, his call).

## 3. Other shards in this slice

None changed. The grid swap re-bakes the neighbours' seams (`scripts/bake-grid-seams.mjs`) and re-proves their entries.

## 4. Done when, hours, blockers

**Done when:** every check is green with the numbers in the commit; the docs are in; the iPhone check is the final row
(Jake's east play at ~99 % with live = main); his notes are the verdict; the plan's STATE says the east is done.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 0 | 2 h (neighbour seams) | 22 h (checks, fixes, docs) | **24 h** + whatever the play finds |

**Blockers:** every other east slice; W12.

## 5. Risks

- Peak memory is the Titan arena with the surface's near tiles resident (E10a Q1); if it is over, the fallback is
  unloading the surface behind the portal (a longer exit fade).

## 6. Questions for Jake

1. **When the showcase replaces the hologram in the grid.** (a) after your east play, as a public cell (the whole shard
   still Developer-gated inside if you want); (b) keep it out of the grid, reachable from Select a shard only.
   **Recommended (a):** both halves are done by then, and W12 deferred the swap to exactly this point.
