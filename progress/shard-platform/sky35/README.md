# op-sky35: a shard's own sky, light and loadout inside its grid cell (SHARD-PLATFORM G321 / G324, E435, 2026-10-10)

Captures: muted Metal iPhone 16 Pro portrait, phone tier, 2×, Developer on, Memory saver on, DEVSERVER builds
(`serve-build.sh --devserver`): **before** = HEAD `776e2ab8a`, **after** = HEAD + this change (candidate `df0b8ca16`; the
landed commit drops the environment-intensity seed, which the readout below shows was wrong). `capture.mjs` is op-look28's
with a sky / light / loadout readout (`readout.json`), `TAG=` naming and `POSES=` for a grid-only run; `sheet.py` is
op-look25's board maker. 0 page errors and 0 console errors in every shot.

## G321: what lost the sky, and the fix (generic, `src/engine/world/backdropLayer.ts`, `skyRig.ts`)

A grid cell already laid its level's sky backdrop over the page's one sky (G223 / G232). Four things in that layer made Sky
Reach and Signal Dunes lose theirs (readout "before": the road's grey dome, the road's key light
`[1, 0.8, 0.66] × 2.4` and fill, the sun disc on, no layered dome drawn):

| what | before | fix |
|---|---|---|
| the dome | a backdrop that hands its dome over as `clouds` (Signal; the engine's data look) never reached the layer: only what it added to its holder scene was drawn | `attach` joins `clouds` to the holder; kept on the camera and scaled out to ≥ 0.75 × the camera's far plane (1950 m), since the layer draws it depth-tested after the world (Signal's dome is 120 m) |
| the key light | `sky.setKeyLight` in a backdrop wrote the page's shared light directly; the blend then overwrote it with the layer's stale copy of the page light | the factory's `sky` routes `setKeyLight` to the layer's targets (`layerKeyedSky`), blended by the weight |
| everything a fixed clock never writes | blended toward a copy of the page's light taken when the layer was laid | the layer starts from its level's declared light (`seedLayerTargets`: key colour / intensity / direction, fill, fog sun tint and densities) |
| the sun disc / halo | always the page's | hidden from half weight on where its look's `sky.sun` or its clock hides its own |

Sky Reach also needed one shard change (`look/render.ts`): its painted dome was built in its compose, which a cell never runs.
It is now its backdrop's `clouds` (standalone `SkyRig.build` attaches it and Game keeps it on the camera; its shader reads the
direction from the camera, so the standalone picture is the same), and its clock writes its fog colour (the cell's air).

Readout "after" (Sky Reach / Signal, inside the cell): key light, sun direction, fill and fog colour equal SHARD SELECT's to the
third decimal; disc off; one layered dome drawn. Boards: `far-reach-board.jpg`, `sunscar-dunes-board.jpg` (SHARD SELECT ·
grid before · grid after, same pose). The road keeps the G242 dawn sky, cross-faded across the 16 m band as before.

Every other shard (`others-board.jpg`, SHARD SELECT vs grid after): Driftwood and Pine Hollow match SHARD SELECT (key,
fill, fog equal or within 0.02); Nalati keeps its own sky and light.

Not carried yet (Sky Reach): its sun-glow cards, cumulus puffs and painted cloud sea are world dressing its compose builds;
a cell has none of them, so the sun has no bloom. Its directional "rose fog" shader patch is compose-built too. The
environment map stays the page's (standalone it has none of its own); its intensity is 1 in both.

## Nine Dragon with the composite on by default (G322)

`nine-dragon-stack-board.jpg`: the crowd (303 instances, as standalone) and the diners draw in the cell, NdJiehuaEffect at 1,
the engine's colour effects at 0.

## G324: the cell's own loadout

Entering a cell already swapped the page's equipment to the region's own kit (`EnteredEquipment`), and leaving gave the
road's back, but the regional kit was built without the shard's own sword viewmodel (`ShardManifest.sword`), so Nine
Dragon's Jian drew as the engine's wooden sword. `regionalRuntime.ts` now hands it over as the standalone loadout does.
Readout inside Nine's cell: `sword` (the Jian) with `tool.fei-zhua`; Sky Reach `far-fan`; Signal `sunscar-whip`. Test:
`test/grid-regional-runtime-factory.test.ts` (built with the manifest's sword, equipped on entry, road kit back on leave).
