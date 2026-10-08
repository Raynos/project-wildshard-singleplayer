# G223 (pine-sky): Pine's own sky inside its grid cell, A / B (E435)

Built on `d4d1f2d6f` (Settings ▸ Debug ▸ Sky & weather ▸ **Region sky**: **A** one grid sky, the default · **B** the
region's own, reloads). Captured on build `688845354` (`scripts/serve-build.sh --head`), iPhone 16 Pro portrait, muted, one
browser through `scripts/browser-lane.sh`, Developer ON (G216: Pine enters past the memory envelope; the Developer grid
boots G226's owned neutral shell). `capture.mjs` spawns on the road east of Pine, walks in through the east entry with real
input, stops at three cell-local poses (day clock paused), walks out, back in, and out again. Standalone Pine is
`?chunk=pine-hollow` at the same poses.

| pose | standalone | A: one grid sky | B: the region's own |
|---|---|---|---|
| east-inside 231,0 | `standalone.east-inside.jpg` | `grid-shared.east-inside.jpg` | `grid-own.east-inside.jpg` |
| east-deep 180,0 | `standalone.east-deep.jpg` | `grid-shared.east-deep.jpg` | `grid-own.east-deep.jpg` |
| east-deep, turned up-left | `standalone.east-deep-up.jpg` | `grid-shared.east-deep-up.jpg` | `grid-own.east-deep-up.jpg` |

**What it shows.** On A, Pine inside the grid is lit by the shell's sky: the forest goes near-black against a pale sky and
the path turns orange. On B, Pine's own HDRI sky, key light, fog and environment light it, and it reads as Pine again: lit
trunks, green canopy, grey-blue haze. B is still cooler and clearer than standalone, which has a warm backlit haze. That
comes from Pine's LUT / curve / vibrance, which the layer doesn't carry yet (it needs a colour-pass effect). Some of A's
darkness may also come from the neutral shell's known shader errors (`uToonNight` / `uFogZenith` undeclared, owned by the
neutral-look lane). They appear on both A and B.

**Road sky returns exactly** (`grid-*.json` `roadSky`): the key, fill and hemisphere light (intensity, colour, direction),
fog, environment and background read on the road before entry are identical, to 1e-6, after leaving, and after re-entering
and leaving again, on A and on B. On the road, the frame's `skies` readout is empty (`grid-own.road-*.jpg`).

**GL census** (labelled WebGL bytes, `glMB`):

| stop | standalone | A | B | B − A |
|---|---|---|---|---|
| road before entry | — | 130.73 | 133.80 | +3.07 |
| east-inside | 294.69 | 360.19 | 386.31 | +26.1 |
| east-deep | 294.62 | 362.26 | 386.61 | +24.4 |
| road after leave | — | 234.88 | 237.98 | +3.10 |
| re-entered east-inside | — | 465.22 | 490.81 | +25.6 |
| road after re-enter + leave | — | 306.93 | 310.03 | +3.10 |

The region's sky inside the cell holds 20.0 MB and is charged 28.0 MB (`sim-sky:pine-hollow`, its ceiling), weight 1, drawn.
Draw calls inside: B 144 / 146 / 116 against A's 122 / 128 / 109 (standalone 127 / 137 / 115).

**Open:**
- B also costs +3.07 MB on the road, before the first entry and after every leave, while `skies` is empty. The extra
  resources are two PMREM cube-UV targets plus a depth buffer, a sphere dome, and a 1.28 MB "belly" mesh, so part of the
  build is on the GPU outside its claim. The cost is bounded: it does not grow per visit.
- Every re-entry grows GL by about 105 MB on both A and B. Leave plus re-enter adds +104 MB on the road and +105 MB inside.
  That is the region residency, not the sky.
- `scripts/test-facade-instancing.mjs` passes on this build: desktop, phone tier, and iPhone desktop quality, 0 batches.
