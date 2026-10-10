# op-look25: grid Nine Dragon against SHARD SELECT (SF63 / G158, E435, 2026-10-10)

Successor of op-frame22 (`../frame22/README.md`), whose open item was grid Nine B missing SHARD SELECT's wet-floor streak
reflections on the phone, the crowd and the brighter neon.

## Why each was dropped in a grid cell

**One cause for the streaks, the halos, the light pools and the steam: the root's frame.** A grid region's content stands
under its view root at the cell's render offset (Nine at (+1, −1): the root at (555, 0, −555) in the page), while Nine's
programs assumed its root stands at the origin. Its runtime wrote `uCam` from the page camera (page space) while
- the streak cards (`data/streaks.ts`), the phone's light halos (`data/light.ts`) and the steam (`data/look.ts`) build their
  positions from root-local attributes and project them with `viewMatrix` alone: drawn 785 m from the square;
- every world program's `vWorld` came from `modelMatrix` (page space) but is compared with root-local data: the light
  volume's box (`poolLight`: the lantern and neon pools, "the brighter neon"), the Well's shaft rect, the flagstone
  layout, the card planes and clips.

Fix (Nine's own folder, no relocation): one shared uniform `uRootAt`, the root's world translation (0 standalone), written
by the runtime from `world.root.matrixWorld`. The programs shade in the root's frame: `uCam` is the camera seen from the
root (`NdRuntime.camera` is `FrameCamera(world.root).of(page camera)`, the engine's SF63 stand-in), every `vWorld` is
root-local (`m[3].xyz -= uRootAt` / `wp.xyz - uRootAt`), and only the projection adds `uRootAt` back. The cell composite's
depth reconstruction (Jiehua's `uCamWorld`, the desktop reflect / haze / bleed passes) reads a root view posed before each
frame reads it (`look/render.ts` `rootView`, a draw-free `PoseView` pass at the head of the desktop side passes).
Standalone `uRootAt` is 0 and the root view is never built: the same shaders, the same numbers.

**The crowd: its culler never ran.** `FigureCrowd` starts empty and fills per figure in `update(camera)`, which Nine calls
from its look's `frame` hook. A region runs a look's `frame` only through its scoped look (`SkyRig.scopeLevelLook`), which is
null for a look whose light and fog change nothing on the page (Nine's). `regionalWorld.ts` now runs such a look's `frame`
while its cell is entered, in the `late` phase (Game runs it after the late hooks), behind the existing default-off
**Grid cell own composite** row. Nine's `frame` in a cell culls with the root-frame camera, keeps its lanterns' LOD and
writes its line widths and buffer size from the page renderer (`cellBuffer`).

## Captures

`capture.mjs` (muted iPhone 16 Pro portrait, phone tier 2x, Developer on, Memory saver on; candidate `0f4fb1b66`, DEVSERVER
build), readouts in `nine-capture.json`: SHARD SELECT `frame [0,0,0]`, crowd 303 figures drawn; grid A (row off) and B
(row on) `frame [555,0,-555]`, `uCam` identical to standalone (1, 126.7, 7.5), crowd 0 in A, 303 in B, 0 page errors.
`nine-dragon-stack-board.jpg`: B now carries the streak runs, the halos, the pools and the crowd. A also gains the streaks
and pools (the root-frame fix is not a look choice: they were drawn in the wrong place); its crowd stays empty.

**Still different** (`nine-dragon-stack-probe.jpg`): grid B reads hazier and paler than standalone in the distance, and
the tall pink and cyan blade signs and the overhead cables above the square are missing (in A too). Switching off every
page colour effect but the composite, then hiding every page scene object outside the region, leaves the haze: it is in
Nine's own content as the region builds it, not the page's post or objects. Not traced in this lane.

## Floors with the row on

`scripts/frame-floor.mjs --rev=0f4fb1b66 --devserver --shards=grid --grid-scenario=cell --grid-cell=nine-dragon-stack
--grid-cell-pose=0.95,125,7.5,-12 --setting=gridCellComposite=on --surface=both` (result
`progress/frame-floor/0f4fb1b66-37424-1791652764370.json`, not committed): Nine's interior and its city pose hold both
floors (desktop 59.88 fps / p95 16.7 ms, Simulator 30.30 / 34). The road rows that miss (desktop deck-north and entry
travel at p95 33 ms, Simulator crossroads p95 36 ms and entry travel 29.4 / 44) missed the same way with the row off in
op-frame22 (the cell's entry hitch and a loaded machine), not this change.

The landed commit differs from the measured and captured candidate only by the uniform's name (`uFrame` → `uRootAt`, after
`@wildshard/sdk/looks/neonText`'s own `uFrame`) and the signs' fog reading the root frame (`world/build.ts`); that last
part is covered by the typecheck and the focused tests, not by a capture.

## Not done in this lane

- Gap 2 (every shard in the grid against SHARD SELECT): `capture.mjs <url> <out> driftwood-isle,pine-hollow,...` does it
  (each shard's standalone spawn pose, then the grid A / B at that local pose); not run (time and the quiet windows).
- Gap 3 (SF23: the far skirts hiding G90's retaining walls): `64865a3c1` (2026-10-04) already leans each border skirt's foot
  3 m in (`FAR_SKIRT_INSET`) so the wall draws in front; the hidden-wall panel (`../sf17b/look2-retaining-wall.jpg`) predates
  it by 37 minutes. `wall.mjs` finds the tallest walls in the grid and shoots each drawn and with the far proxies hidden;
  not run yet, so the row's open item is unverified, likely stale.
