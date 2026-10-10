# op-sky40: a grid cell's own camera, grass and horizon (SHARD-PLATFORM G321 part 3, E435, 2026-10-10)

Captures: muted Metal iPhone 16 Pro portrait, phone tier, 2×, Developer on, Memory saver on, DEVSERVER builds
(`serve-build.sh --devserver`): **before** = HEAD `67291d278`, **after** = candidate `4277e2bae` (this change).
`capture.mjs` is op-sky36's with a camera / grass / void-floor readout (`look.camera`, `look.scene`); `sheet.py` is the board
maker. 0 page errors and 0 console errors in every shot. Readouts: `*-capture-before.json`, `*-capture-after.json`.

## What differed, and the fix

| difference | cause (readout) | fix |
|---|---|---|
| **camera** wider in the cell | the road kit's sword writes a Hor+ field of view (`fovForAspect(72)` = 86.8° at the page's aspect); Sky's fan never writes one, so the road's 86.8° carried into the cell. SHARD SELECT draws Sky at the boot camera's 72°. Near / far / eye height already matched (0.08 / 2600 / 1.68 m) | generic, `src/game/grid/frame.ts` `lens`: each live region keeps its own field of view (the boot camera's `CAMERA_FOV`, new in `engine/core/config.ts`, until its kit writes one); a write since the frame's own last one belongs to the owner holding the frame; the camera draws the owners' fields of view blended by their weights across the edge band, and the road's comes back exactly (its writer's cache still matches). The shadow cascades refit (`GridFrameHost.refit`) |
| **grass**: no meadow blades | Sky's meadow followed the page-frame camera (`uCam` z −560.5 against its root at −555), and its program placed blades with no model matrix, so they grew 555 m away | shard-local (`far-reach`): the meadow and the ray wakes take the eye in their own frame (`mesh.worldToLocal`), and the meadow program places blades with `modelMatrix` (identity standalone: SHARD SELECT is unchanged) |
| **horizon**: the road's cyan void floor below the cloud sea | the void floor is always drawn | generic: the frame tells `horizon` consumers how much the live regions' own skies own the frame (their weights' sum); the void floor (`voidLook.ts`) dithers out across the band (a uniform, same program) and is not drawn at 1, so the shard's backdrop meets the sky |

Boards (SHARD SELECT · grid before · grid after, same pose): `far-reach-board.jpg` (camera, meadow and cloud sea now as
SHARD SELECT), `sunscar-dunes-board.jpg` (Signal had the same 72° vs 86.8° camera and the floor: both fixed),
`others-board.jpg` (Driftwood, Pine Hollow, Nalati, Nine Dragon: unchanged; their kits already write their own view).

## Still different (not this row)

- Signal Dunes: the neighbour cells' far proxies / road deck stand on its horizon (grey silhouettes), not its dunes.
- Nalati: its grid grass is sparser and darker than SHARD SELECT's; Nalati and Nine draw no region sky layer, so the void
  floor stays at their horizon.
- Sky Reach's physics bake and witness checkpoints were regenerated (runtime/index.ts is an input; colliders unchanged).
