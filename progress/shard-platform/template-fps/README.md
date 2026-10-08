# Template copies in the public grid: fps and the desktop boot (template-fps, 2026-10-08)

## 1. The 16 fps template copies are gone

The red receipt `progress/frame-floor/a1c4f02b3-34443-1791472018070.json` (template travel 16.39 fps, centre 16.95 fps on the
Simulator) was measured on a1c4f02b3, which does **not** contain `abba21fc3` (the borrowed-home no-thrash count fix). That receipt
still showed `pending: [template-3, template-4]` at the centre and 700–950 ms hitches: the prefetch churn.

On current main the same public plan (`--developer=off --grid-scenario=template`) runs at the 30 fps cap on the Simulator:

| receipt | spawn | deck / crossroads | road travel / interior | template travel / interior |
| --- | --- | --- | --- | --- |
| `2ed39b862-27895-1791478874100.json` (load 64) | 30.3 / p95 37 | 30.3 / 35, 43 | 30.3 / 39, 38 | 30.3 / 36, 40 |
| `9af9952cc-79280-1791479421623.json` | 30.3 / p95 34 | 30.3 / 34, 34 | 30.3 / 34, 34 | 30.3 / 36, 37 |

Medians pass everywhere; the remaining misses are p95 36–37 ms against the 35 ms limit at the template centre only (spawn and road
p95 34 in the quieter run). No look change was needed or made.

Attribution at the template-1 centre (`attribution-8121efd79.json`): Chromium phone-tier GL census 126–156 draws, ~200k triangles,
no readbacks, uploads or syncs per frame (spawn: 324 draws, 1.43M triangles). A Simulator Safari A/B at the same spot (hiding the
deck, the far cells, the borrowed home's props, the follow meshes, the template itself, or skipping the shadow pass) left the
median at 30.3 fps every time: nothing in the template view is over budget once the thrash is gone. The borrowed Driftwood props
(60 casters) stay in the scene but are frustum-culled from the camera and the shadow cascades.

## 2. The public desktop boot was refused by its own composer (fixed, 9af9952cc)

At 2880×1800 the desktop look allocates 587,522,748 bytes of composer targets (AO, volumetrics, bloom mips, SMAA…). The page
allocator charged all of it against the phone's 1.0 GB playing envelope, so a Developer-off page threw
`Composer admission deferred by the shared budget` at `bindComposer`, before any region loaded. The error renders in
`.ws-load-error`, which the floor harness never read, hence the 240 s "did not finish loading" timeout.

Fix: `composerReservation(bytes, tier)` in `src/game/grid/pageResidency.ts` reserves a phone composer at its actual allocation (the
G226 calibration credit of 13,140,636 B is unchanged) and a desktop composer at that phone calibration. The 1.0 GB cap is unchanged.
`scripts/frame-floor.mjs` now reads `.ws-load-error` and fails fast with its message. Tests: `test/grid-composer-reservation.test.ts`.

After the fix the desktop public grid reaches its first pose and completes every leg (`9af9952cc-79280-…`).

## 3. Open: a clean desktop reading

Both desktop halves after the fix ran while another lane drove the shared Mac GPU: the first under load 37–50 with a Simulator
booted (medians 59.9 fps, p95 33.4 ms everywhere, template interior 30.0 fps); the second
(`9af9952cc-92103-1791479861231.json`) during sp-x3's 30-minute Simulator soak (every pose 30.0 fps, including Driftwood spawn).
The halving hits every pose, Driftwood too, not just the template, so neither reading measures the template. The desktop half must
be re-run with no Simulator booted and the 1-minute load under 12.
