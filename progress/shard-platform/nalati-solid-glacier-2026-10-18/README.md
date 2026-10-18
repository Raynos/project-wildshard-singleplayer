# Nalati static rock contacts and glacier bake

Source proof: candidate tree `b41f3858bc2dc5863b9eac0ddad1b4d177e5369c`
against parent `c2edddcdad46473b519625399b05f7af3c9fa21a`.

The original fitted rock geometry, all ordered support hulls and both glacier
coordinate frames are retained in `generators/`. The live world reads their
lossless float data through its existing baked-place reader. The parameter
catalogue is build-only and now lives with its generator consumers.

Deleted whole runtime modules: `world/solid.ts`, `data/campParams.ts`.
`world/solid.d.ts` retains only the keep-out box type. The original glacier
specimen module retains its small model binding and exact painterly/shadow
flags; it performs no terrain sampling or geometry construction.

## Native view proof

`proof-nalati-look-parity.mjs` reports exact equality on all twelve poses
(six phone and six desktop), captured muted as iPhone 16 Pro portrait at DPR 2
on Metal. Every pixel, draw/triangle count, shader source, program count,
fixed-paint slot/atlas and collider descriptor is identical.

| Tier | GPU bytes | Collider count | Registry pieces | Programs |
|---|---:|---:|---:|---:|
| Phone | 229,193,048 | 2,682 | 81 | 145 |
| Desktop | 553,133,502 | 2,770 | 82 | 161 |

The new fixture `test/fixtures/nalati-static-contacts.json` was recorded from
the original runtime constructors at `62e14486d`. It checks all eight complete
geometry attribute/index/bounds snapshots and all six ordered hull digests.
It is independent of the packed reader. The existing static-landmark fixture
also checks the passage, hood, stairs, porch and ledge floors without change.

## Source ruler and gates

The exact post-generation all-ten-product source inventory reports Nalati
**19,225 → 18,950: net −275 custom lines** (C1 −117, C2 −1, C9 −157).
Platform attribution stays 1,384; platform source grows by zero. AS stays
204 / 2,837 lines. The denominator and ruler are unchanged.

Root and layer types, typed lint, seven focused checks, all seventeen
shard-headless cases, native 100 + 30 tick old-save continuation and generation
ordering pass. All ten products build. The official twelve-leg Nalati phone
collision walk finishes with **0 stuck and 0 page errors**.

The source-only all-ten build reports the expected Nalati map-input stamp
warning. It does not claim strict map freshness: the eighteenth canonical map
refresh and its strict post-generation product proof belong to sp-x10 (G490).

## Ownership retained

- `world/terrain.ts`: the manifest and native runtime still query its authored
  analytic masks, trail distances and height profile.
- `world/placeBake.ts`, `world/index.ts` and `world/painted.ts`: existing
  material, cloth/smoke, named model registration and nonrectangular floor
  bindings; the current cut removes only fixed rock/glacier construction.
- `world/dressing/layer.ts` and `life.ts`: live visibility packing and ambient
  motion, with the original instance ordering and material state.
- `world/KurganDungeon.ts`: live encounter presentation and moving hazards.

No platform API, host, AssemblyScript law, look or gameplay changes. The
remaining C1 work stays in the existing W3 mini-plan batches B8/B9. Source-only
landing under G490; sp-x10 owns the eighteenth map refresh and reserves the
render/contact fact book `boot/poiPaint.json` as a direct map input.
