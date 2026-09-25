# Handoff — Nalati dressing (look-pass lever 6, "density")

**Status (2026-09-23, Phase C): ✅ done** — open item 1 (grass through rocks) is in: the v2 grass mask multiplies
`1 − dressingCover`; item 2 went another way: the boulders / slabs are the generated rock GLBs (their own painted
atlas); the final look round thinned the loose boulders on the green slopes (`place.ts`, progress/nalati-final/04).
**Left for Phase D:** denser flowers to the track edge and small rocks round the camp (item 3), painted camp clutter
(4), bigger butterflies / kites (5), a phone measurement of `planDressing`'s boot cost (6). The sections below are the
history of the handoff.

Owner until now: the dressing agent. Code: `src/world/nalati/dressing/` (+ the Dressing section in `src/nalati/index.ts`).
Commits: `0422a8a`, `e734a51`, `4226eb8`, `ba4e99e`, `e81a609`.

## What is built (wired into the real shard)

- **Instanced scatter layers** (`layer.ts` = `DressLayer`; `models.ts` makes the shapes; `place.ts` places them):
  boulder, slab, stone, juniper, wild rose, dwarf willow, lupin, daisy (edelweiss + buttercup) and reed. Each layer is one
  InstancedMesh on the shared painterly material with instanceColor. Every instance has its own draw distance
  (`far`), and each layer's far is scaled down on the phone. An instance shrinks into the ground over the last 18 % of
  its range. Culling uses 24 m cells plus per-instance range and frustum tests, and only re-runs when the view moves
  ≥ 1 m or turns ≥ 2°.
- **Placement** (`place.ts`, deterministic from the seed). It keeps clear of the POI clearings, road beds, river water,
  the brook, snow and spruce trunks. An occupancy hash stops big items overlapping each other. The passes:
  - camp edges and the Kunes banks by the camp (`campAndBanks`, round-4 gap #10);
  - boulder clusters (slopes, gully walls, banks, the massifs, erratics);
  - stones along both road verges;
  - pebbles, cobbles and driftwood on the gravel bars;
  - shrubs;
  - flower drifts centred on `flowerPatchAt`, mostly white and yellow with purple patches;
  - reeds;
  - logs and stumps near the spruce;
  - ovoo cairns and ribbon poles at the viewpoints;
  - guard fences on the sky road and a ribboned gateway where it tops the rim.
- **One-off props** (`statics.ts`): logs, stumps, driftwood, ovoos, poles, fences and the gateway are merged into 4
  region meshes. Camp clutter is `buildCampClutter`, run from `addTo()` after the POIs so it keeps 1 m clear of their
  colliders. It sits in the yard mouth and on the spur-track verges (where the camp approach sees it), behind the yurts,
  and round the summer camp. Clutter kinds: firewood, dung cakes, chopping block, pots, sacks, felts, kumis churn.
- **Ambient life** (`life.ts`): pollen and seed fluff drifting on the `Wind`, butterflies over nearby drifts, and 3 kites.
- **`dressingCover(x, z)`** (0–1) is exported for the grass seeder, so blades can stay out of rocks and shrubs.
- **Budget:** about 17–19 draw calls. Dressing triangles on the phone are 75–175 k depending on the pose. At the 9 camp
  poses the whole shard measures 106–120 calls and 1.48–2.00 M triangles on the phone tier.
- **Shots:**
  - `progress/nalati-look-dress-*.jpg` (close-ups);
  - `progress/nalati-look/06-dressing-*` (the parity set);
  - `progress/nalati-look/camp9/dress-01-*` (camp 9-angle before | after | mockup; the "before" is an earlier HEAD
    export, so it also lacks the POI agent's yard).

## Open

1. **Grass through rocks:** the grass agent has not adopted `dressingCover`. Suggested: `height *= 1 - dressingCover(x, z)`
   and reseed once the dressing is built.
2. **Painted granite on the boulders is not done.** The painterly material has no texture or triplanar path, and the
   blob geometry has no UVs. This needs a triplanar `map` option in `src/world/painterly.ts` (look-director), after which
   the boulder, slab, stone and ovoo stones can use `rock` from `nalatiTextures.ts`.
3. **The camp mockups are denser:** more flowers right up to the track edge, and small rocks scattered through the
   meadow near the camp. The camp-ring pass (`campAndBanks`) could be pushed further.
4. **Camp clutter is simple primitives**, not painted textures. The churn reads dark in FP-front.
5. **Butterflies and kites are small** at normal viewing range.
6. `planDressing` takes ~0.1–0.8 s depending on machine load. It yields between passes, but a phone measurement of the
   boot cost is still owed.
