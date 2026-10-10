# op-sky36: Sky Reach's whole sky inside its grid cell (SHARD-PLATFORM G321 part 2, E435, 2026-10-10)

Captures: muted Metal iPhone 16 Pro portrait, phone tier, 2×, Developer on, Memory saver on, DEVSERVER builds
(`serve-build.sh --devserver`): **before** = HEAD `795868b06` (op-sky35's G321 landed), **after** = candidate `fa54a61b9`
(this change; it also zeroed the page's environment intensity in a cell, dropped before landing: the readout shows the
grid page binds no environment map, so that changed nothing drawn). `capture.mjs` is op-sky35's with a `sky` readout
(the far.* dressing meshes drawn and their layer fade, the share of the region's world materials under the rose fog, the
environment map); `sheet.py` is op-sky35's board maker. 0 page errors and 0 console errors in every shot.

## What a cell still lacked, and the fix

op-sky35 carried the dome, key, fill and air. Sky Reach's compose (standalone only) also built its world-anchored sky
pieces and patched its world's materials; a grid cell never runs a compose.

| piece | fix |
|---|---|
| sun glow, cumulus puffs, painted cloud sea (+ maelstrom) | generic `SkyBackdrop.dressing` (engine `render/look.ts`): a backdrop's world-anchored sky pieces in its level's own frame. Standalone `SkyRig.build` adds them to the scene; a grid cell's `BackdropLayer` draws them in the page scene at the region's origin (`origin`, the region root), their programs reading the view, model-view and camera in the level's frame (`levelFrameSource`: the puffs billboard on their own `aAt`, the sea winds round a fixed point, so moving the node was not enough), faded by the owner weight (alpha, or the whole colour for `One`-blended glow cards), hidden at weight 0 |
| directional rose fog | generic `LookStrategy.worldPatch(material, scope)`: the look's own per-material patch; Sky's compose runs it on its scene, a grid cell's scoped look (`render/regionLook.ts` `sweep`) on every unshared material under the region root |
| environment map | nothing to carry: SHARD SELECT and the grid page both bind none (`envMap: null`, intensity 1) |

Sky Reach (`look/render.ts`): the dressing is built once (`makeDressing`, as the dome) and handed over as the backdrop's
`dressing`; the rose fog is its `worldPatch`. SHARD SELECT is unchanged (sky rows 0–900 px identical; the 0.6 % of pixels
over 16 levels are the foreground grass and fan sway).

Readout inside the cell (`capture-*.json`): before `pieces {}`, rose fog 0/39 materials; after `far.painted-sea`,
`far.painted-sea.upper`, `far.painted-maelstrom`, `far.cumulus` drawn at fade 1 (and the sun-glow cards, a camera-centred
group the readout's name filter misses; visible at the windmill), rose fog 39/39. Board: `far-reach-board.jpg`
(SHARD SELECT · grid before · grid after, same pose).

## The other shards

Signal Dunes (its compose sets only its fog and chain), Pine Hollow (empty compose), Driftwood (chain only) build no
standalone-only sky pieces; Nalati's panorama dome comes from its runtime's weather install, which its cell runs. Signal's
cell is unchanged (grid before vs after: 0 % of pixels over 16 levels).

## Still different from SHARD SELECT (not sky, not this row)

The grid's camera frames the same pose wider than SHARD SELECT; the cell's grass is not SHARD SELECT's lush carpet; the
road's cyan grid floor shows at the horizon below the cloud sea.
