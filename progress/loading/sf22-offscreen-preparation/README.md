# SF22: prepare Nalati static override programs before entry

The existing StaticBake depth and contact materials now register with the scoped
engine offscreen-preparation port. The ordinary sliced precompile borrows their
actual cameras, targets, materials and current caster roots while the admitted
resident is hidden. No bake, shader, draw, clock or visibility law changed.

The first candidate added two unused programs: explicit compilation split a
position-only override by normal-attribute presence, whereas Three's real draw
cache reused its preceding representative. The opt-in `positionOnly` registration
keeps object flags (including instancing, batching and skinning) and that real
representative, without modifying geometry or shader sources. Material visibility,
geometry groups and camera layers follow the actual render list.

## Exact parity

Baseline `87f5757232bc1bda2582d634723b265849d9c9c2`; scheduling-only diagnostic
candidate `8145fb6278bcca6167f9d020cf7bfaf76e5d1eff`. Both used
`scripts/proof-nalati-look-parity.mjs`, muted Metal Chromium, iPhone 16 Pro DPR2,
pinned clock, six identical poses at each tier. Every raw RGBA SHA-256, draw count
and triangle count matched: **12/12 exact captures**.

| Tier | Programs before / after | Shader sources before / after | Labelled GPU bytes before / after | Native colliders |
| --- | --- | --- | --- | --- |
| phone | 142 / 142 | 216 / 216 | 228787512 / 228787512 | 2682, identical hash |
| desktop | 159 / 159 | 240 / 240 | 550454914 / 550454914 | 2770, identical hash |

Full shader-source-set hashes and collider hashes also matched. The rejected
candidate's +2 programs are not a pass and were corrected before this landing.
This proves unchanged materials and pixels; first-entry latency still needs the
matched SF22 route after the separate Pine effect-preparation slice.

14 focused tests across offscreen, shadow, composer and future-light preparation
passed; strict source projection and root-config typed lint of every touched TS
file passed. `look/bake.ts` is absent from both `nalatiPhysicsInputs` and the map
input closure, so no physics/map rebake or witness payload change is required.
The defining SDK facade adds one SDK → engine edge. No browser or preview remains.

Raw captures stayed in scratch; source receipts:
- before JSON SHA-256: `e8a3cb4ae5d918c22269d4a8df9707426a1736dc108d8fcebe323f7140bf6e05`.
- after-fixed JSON SHA-256: `d14ba49abb30ff1dba704738ddabb0ee99e1fdc2f9439683c4cca2527e4321e1`.
