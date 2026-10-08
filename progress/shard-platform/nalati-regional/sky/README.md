# G223 / SF48-g: Nalati's light on the page's one sky (E435)

`capture.mjs` (through `scripts/browser-lane.sh`, iPhone 16 Pro, muted, Developer ON, phone tier) boots the grid, holds
the page's own day clock still, then walks through Nalati's west entry and back with real input. At each stop the camera
faces the same way and the page's shared light is read: the sky rig (key light, cascade colour / intensity / map size,
fill, sun disc and halo), every painterly uniform but its clock, the engine grade (saturation, contrast, brightness) and
the volumetric light.

`board.jpg`, left to right: road before entering · inside Nalati · road after leaving (fix, `4684f2112`, contains
`703119ed2`) · road after leaving on the build just before the fix (`a7b0d4aa2`).

| build | inside Nalati, channels changed | road after leaving, channels still changed |
| --- | --- | --- |
| `a7b0d4aa2` (before) | lights, mapSize, disc, painterly, grade, volumetrics | **lights, mapSize, disc, painterly, grade, volumetrics** |
| `4684f2112` (fix) | lights, mapSize, disc, painterly, grade, volumetrics | **none** (`sameLight: true`) |

Receipts: `sky.json` (fix), `sky-before-fix-a7b0d4aa2.json`. One visit each: a second entry hits a Rapier "recursive use
of an object" (`coIsEnabled`, the walk's trace read) on both builds, and both report five `Cannot read properties of null
(reading 'dispose')` teardown errors in `leak()`; both pre-date the light swap. Re-entry restoring the region's own light is
proven in `test/grid-region-light.test.ts`.

Standalone Nalati: `node scripts/parity.mjs --url=… --lane=m5 --shards=nalati-grasslands --tiers=phone
--only=fingerprint+poses` gives the same result on both builds (fix and `a7b0d4aa2`): the same nine reds against the stored
baseline (colliders 2776 vs 2772, HUD, bridge / plains calls and tris, pose SSIM camp 0.97440 / bridge 0.95568 / plains
0.94667 on both), i.e. baseline drift that pre-dates this change, and no difference between before and after. The swap is
installed only by `regionalWorld.ts`; a standalone page never runs it.
