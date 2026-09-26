# Nine Dragon Stack: the phone budget (P0-5c)

**State:** 2026-09-26. The caps below are in force. Latest measure: a clean export of `f962b730` with the F8 facade
batch, three Fei Zhua hook sculpts and the corrected B2 bridge camera. All 76 portrait ruler poses pass the whole-frame
gate on Chrome/Metal with and without multi-draw. Five lanes still exceed their own caps; iPhone frame time and resident
memory are unmeasured.

## The gate

On the phone frame (402×874 @3, tier phone, the shard's portrait FOV), every ruler pose must stay at or under
**2.3 M triangles and 180 draw calls**. The lane caps below add up to about 2.0 M and 175 draws, which leaves about
0.3 M of headroom.

The current multi-draw build peaks at **139 draws** and **1.65 M triangles** (not the same pose). The tested
no-multi-draw fallback peaks at **160 draws** and **1.67 M triangles**. That leaves at least 20 draw calls and 0.63 M
triangles of whole-frame headroom in this ruler. It is a Chrome/Metal phone-profile test, not an iOS PWA frame-time test.

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
- The facade dressing's draws are a shared lane. With `WEBGL_multi_draw`, the large pieces are one BatchedMesh draw,
  small distance-shrunk pieces remain instanced and the windows remain one draw. The ruler reads BatchedMesh's rendered
  instance IDs and geometry ranges to assign only visible triangles to their world regions. Without the extension it
  keeps the original per-piece InstancedMeshes.

## The frame now

| | Worst pose | Mockup A | Mockup B | Mockup C | Mockup D |
|---|---|---|---|---|---|
| Before the culler (all 72 poses) | 2.81 M / 174 | 2.62 M | 2.44 M | 2.08 M | 2.22 M |
| ex16: culler + crowd / lantern LODs | 1.51 M / 179 | 1.36 M / 158 | 1.21 M / 155 | 0.75 M / 133 | 0.83 M / 128 |
| ex18: + the rigged arms (P8), the domes' first cuts | 1.53 M / 160 | 1.52 M / 147 | 1.37 M / 140 | 0.89 M / 139 | 1.11 M / 116 |
| **Current: facade multi-draw + three sculpted hooks** | **1.65 M / 139** | 1.65 M / 130 | 1.41 M / 122 | 0.82 M / 117 | 1.17 M / 116 |
| Current: no-multi-draw fallback | 1.67 M / 160 | 1.66 M / 147 | 1.43 M / 141 | 0.82 M / 136 | 1.17 M / 117 |

- In the current multi-draw run, A2·9 has the most draws (139) and A1·5 has the most triangles (1.645 M). In the
  fallback run A2·9 has 160 draws and A1·2 has 1.673 M triangles. The B2 first-person cameras now stand at the
  built timber bridge's center, clearing the railing seen in the previous camera 5 capture.
- The rigged arms cost 214 k triangles and 25 draws, drawn once. They sit out n8ao's transparency pre-pass
  (`treatAsOpaque`), which had drawn them a second time; an A/B of the frame shows no visible difference.
- The three Fei Zhua dragon-hook sculpts share one 17,875-vertex geometry and one instanced draw. They add up to
  **53,967 triangles** when all three render. The 489 KiB GLB has two 1024² textures (color and normal); the renderer
  reported 85 textures with the sculpt versus 83 in the otherwise comparable build without it. At RGBA8 with full
  mipmaps, those two textures can occupy about **10.7 MiB** of GPU memory after decoding. Texture count and that
  estimate are not a measurement of total iOS process memory.

## The lanes: caps and where each stands

"Now" is the lane's worst over the 13 distinct pass-2 poses in the current multi-draw run. Numbers in **bold** are over their cap. Until the
ruler shows a lane under its cap, the lane's owner cuts before adding anything. The frame gate stands either way:
every pose must be ≤ 2.3 M triangles and ≤ 180 draws.

| Lane | Owner | Cap tris | Cap draws | Now tris | Now draws | What it is / the lever |
|---|---|---|---|---|---|---|
| A2 square | dome B | 0.42 M | 18 | 0.338 M | 17 | Paifang, canopy, props, crowd and dressing. |
| B1/D1 Well rim + galleries | dome C | 0.15 M | 12 | **0.266 M** | **14** | Mockup D includes 54 k sculpted-hook triangles, 72 k lion triangles and 48 k crowd triangles in this region. Rebalance or cut before adding more. |
| B2 crossings + run north | dome B2 | 0.35 M | 16 | **0.355 M** | **17** | Band kits `well-c-*` / `well-x-*`; the bridge-center camera exposes the overage. |
| D2 lower Well | dome D2 | 0.15 M | 10 | 0.125 M | 10 | Deep bands: `ctx.far`. |
| C1 stair foot | dome D | 0.10 M | 6 | 0.066 M | **10** | The mockup C pose has four more draws than its lane cap. |
| C2 upper stair | dome C2 | 0.30 M | 12 | 0.232 M | 11 | Terraces, stair gate and stair-wall dressing. |
| Towers + street | dome D | 0.30 M | 12 | 0.278 M | 12 | Tower kits and facade triangles on their fronts. |
| Facade batches (draws only) | port lead | — | 20 | — | 9 | One BatchedMesh for large pieces, six small-piece batches, windows and shell; uses multi-draw only where supported. |
| Look | render agent | 0.03 M | 11 | 0.014 M | 9 | |
| Viewmodel | P8 | 0.25 M | 24 | 0.214 M | **25** | Rigged arms, jian, Fei Zhua, cloth, halo and trail. |
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
- **Facade multi-draw** (`world/facade/batch.ts`, `look/facadeMaterial.ts`): the large kit pieces are one BatchedMesh
  on the tested Chrome/Metal renderer. The shared facade lane falls from 28 to 9 draws at its measured maximum; small
  clutter and windows keep their old paths. The fallback stays under the whole-frame gate without the extension.

**Next**
- **iOS validation.** Check `WEBGL_multi_draw` and frame time on the portrait Safari PWA, plus process memory with
  another shard resident. The Chrome fallback total passing the gate does not establish 60 FPS on the phone.
- **Lane cap reconciliation.** B1/D1, B2, C1, viewmodel and post are over their agreed caps even though the whole
  frame passes. The B1/D1 hook sculpt is a deliberate new cost; give it room through a measured cut or an approved
  lane rebalance before further additions.
- **Merge the domes' fragmented kits.** C2's stair and the Well's band kits run 10–20 draws each for 50–250 k
  triangles.
- **Phone milliseconds.** Re-bench the four mockup cameras on the culled build. The ex9 numbers, from before the
  culler, were 9.5 ms at the spawn and 3.1–3.7 ms at the others.
