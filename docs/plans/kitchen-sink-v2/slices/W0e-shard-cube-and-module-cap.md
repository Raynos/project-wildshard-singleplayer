# W0e: the shard cube rule (19ad) and the decision-module cap

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the cube part of the old
**W15** (Jake 11-03, ruling 19ad) and settles BURN-DAMAGE-LIST **D59** (the decision-module cap) for the showcase.

## 1. The showcase piece

The showcase product validates under the new rule from its first build: its surface (y −6 cave to the 45 m tower), and,
reserved for the east, the Training Vault (y −40…−30) and the Titan arena (y −156…−80), all inside x/z ±250, y ±250,
no two volumes overlapping (round 5 `layerCheck`).

## 2. Engine / game / host work, just in time

**Cube rule.** Today the bake already refuses props, terrain and world GLB nodes outside the cell
(`src/sdk/bake/props.ts:227`, `terrain.ts:34`, `world.ts:58`), and `src/format/shardSchema.ts:293` checks the spawn. Not
checked: **portal destinations** (`src/format/portalLink.ts:10`, `destination.at`), **interior volumes** (Pine's cave
file `src/format/caveInterior.ts` holes/cuts, Nalati's arena room `src/game/boss/arenaRoom.ts`), and overlap between
declared volumes. Add to the shardfile validator (`format/shardSchema.ts` rules beside line 293): a declared
`volumes` list (id, box) built from interiors, portal destinations and arenas; every box inside the cube; no two
intersect; every portal's destination inside its own product's volumes. Document in `docs/SHARDS.md` (a "Your cube"
section).

**Finding: the practice rooms break the rule today.** Nalati's riding course and Nine Dragon's grapple course run in an
engine playground at **`PLAYGROUND_Y = 3000`** (`src/engine/practice/playground/Playground.ts:26`), declared by each
shard's `practice.course` client-plan feature (`src/shards/nalati-grasslands/generators/courseScene.ts`,
`src/shards/nine-dragon-stack/generators/courseScene.ts`). That is 2,750 m above the cube. But a playground is "a
standalone dev level for one shard's own verb, entered from the Explore hub" (`Playground.ts:1-13`), hung that high on
purpose so the whole shard is past the 2.6 km far plane and culled; play never reaches it. So the rule reads playable
volumes only, and Explore-hub playgrounds are listed as a dev-tool exemption, like the Practice arena (Q1). The
showcase's courses are in its world (W6d), not playgrounds.

**Decision-module cap.** `test/decision-module-cap.test.ts:10` pins **at most nine distinct decision modules per
product** (`src/format/decisionScripts.ts`, D59). The west alone needs about seven (course law, physics yard, skittles,
trick score, movers, quest chapter, range score); the east adds robots, elites, director, vault rooms and the Titan, well
past nine. Each module is one small Wasm page, so the cap is a count, not a memory bound. Raise it (Q2).

Layer: `format` (validator, cap). Guards: none new; `wildshard validate` runs the rule. Tests: extend
`test/author-cell-bounds.test.ts` and `test/headless-bounds.test.ts` with an interior outside the cube, two overlapping
volumes and a portal to another product's coordinates (each refused); update `test/decision-module-cap.test.ts`.

## 3. Other shards in this slice

| Shard | What the rule reads | Expected | Proof |
|---|---|---|---|
| Pine Hollow | crag cave holes/cuts (`caveInterior`) | inside | `wildshard validate out/pine-hollow` |
| Nine Dragon | `portal.ride` destination | inside | validate + `test/declared-portal-entry.test.ts` |
| Nalati | arena room; Explore playground y 3000 | arena inside; playground exempt (dev tool) | validate + `test/arena-portal.test.ts` |
| Driftwood, Sky, Signal, templates | no interiors | pass | validate |

No save risk: nothing moves.

## 4. Done when, hours, blockers

**Done when:** every product validates; the three refusal fixtures fail as intended; SHARDS.md has the cube section;
the cap reads Jake's number.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 8 h (Codex) | 4 h | 0 | **12 h** |

**Blockers:** none.

## 5. Risks

- An interior host that isn't declared as a volume slips past the rule; the rule must read every interior-like row
  (cave, arena room, portal destination, later the shrine host).

## 6. Questions for Jake

1. **The Explore playgrounds at y 3000** (Nalati's riding course, Nine's grapple course). (a) exempt them as dev tools
   entered from the Explore hub, like the Practice arena; (b) move them inside each cube. **Recommended (a):** play never
   reaches them, and moving them under the shard would draw the whole shard behind the room (they hang at 3 km so the
   shard is culled). The cube rule then binds every portal, interior and arena a player can reach.
2. **The decision-module cap.** (a) raise 9 → 32 per product; (b) replace the count with a memory budget (Wasm pages);
   (c) keep 9 and pack several laws into one module. **Recommended (a):** one line and a test; each module is a 64 KB
   page, so 32 is 2 MB; (c) would make the showcase's scripts unreadable as zone recipes (19m).
