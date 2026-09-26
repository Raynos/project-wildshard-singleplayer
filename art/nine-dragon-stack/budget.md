# Nine Dragon Stack: the phone budget (P0-5c)

**State:** 2026-09-26. The caps below are in force. Every addition is paid for by a cut in the same lane (the
coordinator's triangle freeze). Latest measure: the working tree of 2026-09-26 ~05:30 (export ex18), with the per-instance
culler, the crowd and lantern LODs, P8's rigged arms and the domes' first cuts in.

## The gate

On the phone frame (402×874 @3, tier phone, the shard's portrait FOV), every ruler pose must stay at or under
**2.3 M triangles and 180 draw calls**. The lane caps below add up to about 2.0 M and 175 draws, which leaves about
0.3 M of headroom.

Both are inside the gate now: the worst pose is 160 draws and 1.53 M triangles. Draw calls are still the tighter of the
two.

## The ruler

`node scripts/nine-dragon-budget.mjs --url=<served build>` (under the browser lock).

**Poses.** The 72 dome cameras (`round-15-eight-domes/<dome>/cameras.json`) plus the four mockup cameras
(`src/chunks/nine-dragon-stack/mockupCameras.ts`). Each is posed with a free camera and the viewmodel on.

**Passes.**
- Pass 1 records the frame's draws and triangles at every pose.
- Pass 2 runs at each dome's view 5, the mockup cameras and the three worst poses. It renders each top-level child of
  the fragment alone through the whole composer, subtracts the empty frame, and splits the cost into lanes.

**Lane split.**
- A kit goes to its lane by name where the dome names it for its region: `well-c-*` / `well-x-*` → B2, `well-l-*` →
  D2, `well-r-*` → B1/D1, `stair-terraces|far` → C2, `stair-foot` → C1.
- Everything else goes to the lane of the region its triangles or instances stand in: the facade dressing, lanterns,
  crowd, instanced dressing and shared kits.
- The facade dressing's draws are one per visible piece type, wherever the pieces stand. They are a shared lane of their
  own.

## The frame now

| | Worst pose | Mockup A | Mockup B | Mockup C | Mockup D |
|---|---|---|---|---|---|
| Before the culler (all 72 poses) | 2.81 M / 174 | 2.62 M | 2.44 M | 2.08 M | 2.22 M |
| ex16: culler + crowd / lantern LODs | 1.51 M / 179 | 1.36 M / 158 | 1.21 M / 155 | 0.75 M / 133 | 0.83 M / 128 |
| **ex18: + the rigged arms (P8), the domes' first cuts** | **1.53 M / 160** | 1.52 M / 147 | 1.37 M / 140 | 0.89 M / 139 | 1.11 M / 116 |

- The worst pose is C2·3 for draws and A1·2 for triangles.
- The rigged arms cost 214 k triangles and 25 draws, drawn once. They sit out n8ao's transparency pre-pass
  (`treatAsOpaque`), which had drawn them a second time; an A/B of the frame shows no visible difference.

## The lanes: caps and where each stands

"Now" is the lane's worst over the 17 pass-2 poses (the ex18 run). Numbers in **bold** are over their cap. Until the
ruler shows a lane under its cap, the lane's owner cuts before adding anything. The frame gate stands either way:
every pose must be ≤ 2.3 M triangles and ≤ 180 draws.

| Lane | Owner | Cap tris | Cap draws | Now tris | Now draws | What it is / the lever |
|---|---|---|---|---|---|---|
| A2 square | dome B | 0.42 M | 18 | 0.40 M | 18 | Kits 174 k (`kit:paifang` + `kit:props`, merged), canopy 81 k, TRELLIS props 72 k, crowd ≤ 58 k. |
| B1/D1 Well rim + galleries | dome C | 0.15 M | 12 | 0.14 M | **13** | Kits, crowd, dressing, lanterns. |
| B2 crossings + run north | dome B2 | 0.35 M | 16 | **0.355 M** | **17** | Band kits `well-c-*` / `well-x-*` (now 6 meshes). |
| D2 lower Well | dome D2 | 0.15 M | 10 | 0.12 M | 10 | Deep bands: `ctx.far`. |
| C1 stair foot | dome D | 0.10 M | 6 | 0.07 M | **8** | |
| C2 upper stair | dome C2 | 0.30 M | 12 | **0.32 M** | **15** | Terraces, the stair gate (`ctx.far` 120 m), the stair walls' dressing. |
| Towers + street | dome D | 0.30 M | 12 | 0.29 M | 12 | The facade dressing's triangles on the tower fronts plus the tower kits. |
| Facade batches (draws only) | port lead | — | 20 | — | **28** | One draw per visible piece type (29 types + windows). The lever is multi-draw (three's BatchedMesh). Baking the rare types would cost ~60–90 MB of vertices on the phone, so it is out. |
| Look | render agent | 0.03 M | 11 | 0.015 M | 9 | |
| Viewmodel | P8 | 0.25 M | 24 | 0.21 M | **25** | The skinned arms, jian, Fei Zhua, cloth, halo, trail. |
| Post chain (the empty frame) | render agent | 0.03 M | 38 | 0.023 M | **39** | |
| **Sum** | | **2.08 M** | **179** | | | |

## The engine levers (port lead)

**Landed**
- **Per-instance culling** (`world/cull.ts`). The facade dressing, lanterns and instanced dressing each spanned the
  fragment (bounding spheres of 200–300 m), so nothing was ever frustum-culled. Now each batch is packed each frame to
  the instances in a widened view, with no draw added.
  - The facade's small clutter is also dropped past 85 m, where its shader has already shrunk it to nothing.
  - It runs in the render hook's `frame`, with the camera final, so Explore, captures and cutscenes all cull right.
  - Effect, together with the two LODs below: 2.81 M → 1.51 M at the worst pose (the culler alone was not re-measured after the move to the frame hook).
- **The domes' switches** (`world/ctx.ts`):
  - `ctx.far(name, m)` draws a kit only within m metres of the camera.
  - `ctx.kit(ctx.cell(name, x, z, 32))` splits a region's kit into 32 m cells that the frustum can drop.
  - Each cell is a draw when in view, so use cells of 24–40 m, not finer.
- **Crowd LOD** (dome B, `crowd.ts`): per-figure culling, a ~320-triangle copy past 35 m, none past 130 m. About 550 k
  → about 60 k.
- **Lantern LOD** (render agent, `look/lanterns.ts`): near and far buckets. About −390 k.

**Next**
- **Facade draws.** Move the dressing to one multi-draw batch (three's BatchedMesh, per-instance culling built in). That
  needs `WEBGL_multi_draw` on the iPhone and a batching path in the Jiehua material.
- **Merge the domes' fragmented kits.** C2's stair and the Well's band kits run 10–20 draws each for 50–250 k
  triangles.
- **Phone milliseconds.** Re-bench the four mockup cameras on the culled build. The ex9 numbers, from before the
  culler, were 9.5 ms at the spawn and 3.1–3.7 ms at the others.
