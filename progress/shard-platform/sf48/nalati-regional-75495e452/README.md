# Nalati regional runtime diagnostic — E435 / SF48-g

Pin `75495e4528bf76d1b58be660e8fddacddc93915d`; real grid entry from the main-menu card, muted iPhone 16 Pro portrait, browser-lane. This is a diagnostic, **not acceptance**.

`regional-runtime.mjs --url=<pinned preview> --out=<json>` waits for the normal reveal, places the traveller once on Nalati's west road, and uses real movement input thereafter. It reached world `(305.035, 0.021, 0.001)` through road → Nalati without falling or a recovery teleport. Interior gameplay preparation failed before the first complete visit: `unknown animal kind 'wolf' (registered: deer, elk, boar, bear)` in `AnimalManager.spawn → Wildlife.spawnPack/build → attachAnimals → regional afterKit`. The pending gameplay fence stopped further input; the bounded route timed out.

The old regional frame selected the resident world child, a sibling of the runtime row-registration child. `SpeciesService.get` filters by `entry.scope.belongsTo(app.levelScope)`, so it missed Nalati's rows. Generic commit `5abd5b40c` subsequently selects their common runtime owner. The fresh native fixture now checks actual wolf resolution and entered-only real Impacts callbacks. A fresh full-browser proof is still required.

Teardown recorded four errors: `null.dispose` twice, `undefined.maxSlopeClimbAngle`, and `undefined.delete`. Independent counters and native census returned to the starting values and the scope census was zero, but these errors prevent a leak pass. Browser and preview closed. The screenshot shows the truthful over-cap Developer warning; this run is not memory-budget acceptance.

The seam source is admitted data: `GridSession → gridShardfileProduct` reads manifest `gridShardfile`; `readGridEdges` clones `source.edge`, which Nalati's declaration copies from `NALATI_EDGES`. Its terrain-bake fallback is not used. Native terrain and edge rows remain unchanged; the platform rendering seam cap/taper belongs to the Opus seams lane.
