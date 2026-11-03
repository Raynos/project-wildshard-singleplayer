# W12: the west finish (memory, grid-ready, the look, Jake's phone pass)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the west half of the old
**K10** (grid-ready: memory ≤ 1.2 GB Explorer, one-frame looks, baked tiles, entries, edge profile) and **K12** (Jake
plays it on the phone) for the west, plus **W21**'s docs for every west feature (a SHARDS.md section and a template
example row each).

## 1. The showcase piece

The whole west, as one walk: arrive, town, the tour quest, range, physics yard, hover park, movers, grapple and zip,
climb yard, the Rock and cave, riding, vistas, caches, Gold, FINDS, a natural storm, a night.

## 2. Engine / game / host work, just in time

No new host. The heavy proofs that AGENTS.md runs per milestone, not per slice:

| Check | Tool | Bar |
|---|---|---|
| Memory | `scripts/grid-ready-memory.mjs` on the Simulator (`scripts/sim-lane.sh`, quiet window) | **≤ 1.8 GB loading, ≤ 1.2 GB Explorer** for the shard |
| Frame floor | `scripts/frame-floor-grid.mjs` on a served build of HEAD | the phone budget rows in `data/budgets.json` (copied from the template) |
| Physics walk | `node scripts/physics-baseline.mjs --no-build --mode=walk` | 0 stuck, every course route included |
| Body cap | count awake dynamic bodies at the physics yard (W4a/b) | ≤ 40 on phone (`engine/physics/bodies.ts:84`) |
| Boot smoke | the exact-SHA boot smoke | green |
| Grid entries | `scripts/grid-ready-chromium.mjs`, `scripts/physics-grid-entry.mjs` | the four entries enter and leave clean |
| One-frame looks | the goldens skill, 24 cameras, new for this shard | Opus reads every panel |

Then the grid swap (W0a Q2): the hologram plot at [−1,−1] (`open-plot-sw` in `src/game/grid/singleplayer.json`) is
replaced by `showcase-template` once Jake's pass says so, still behind Developer if he wants (G972 forbids a
Developer-only cell, so this is a public change and his call).

## 3. Other shards in this slice

None changed. The grid swap moves the hologram plot out; its neighbours' edge profiles are re-baked
(`scripts/bake-grid-seams.mjs`) and their entries re-proved.

## 4. Done when, hours, blockers

**Done when:** every heavy check above is green with the numbers in the commit; the iPhone check is the final row
(memory: Jake's iPhone pass at ~99 %, live = main); Jake's notes are the verdict; the west half is declared done in the
plan's STATE.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 0 | 2 h (neighbour seams) | 16 h (checks, fixes, docs) | **18 h** + whatever the pass finds |

**Blockers:** every other west slice.

## 5. Risks

- The west has the most static geometry in any shard so far (35 houses, the tower, the Rock, five courses); memory and
  draw calls may need LOD and instancing passes that land as fixes inside this slice.

## 6. Questions for Jake

1. **When the showcase replaces the hologram in the grid.** (a) after your west phone pass, behind Developer as a whole
   shard but in the public grid cell; (b) only after the east is done too. **Recommended (b):** the public grid should
   not show a shard whose combat half is missing; the west pass happens in Developer from Select a shard.
