# G227 platform atlas: the road-sign atlas from 22.37 MB to 6.64 MB GPU (E435)

**What changed** (`src/game/grid/roadLook.ts`): the grid's shared sign atlas (`grid-signs`) was a 1024 × 4096 sRGB RGBA8
canvas (every unique sign line is a 512 × 64 cell; 75 lines with Developer ON, so 2432 rows rounded up to the next power
of two). It is now a **1024 × 2432 RG8 data texture**: exactly as tall as its rows (WebGL2 mips any size), two bytes a
texel instead of four.

Every texel the signs sample is the sign green, the sign white, or the canvas's antialiased blend of the two. Each texel
stores its **linear-light coverage** t (how far it sits from green to white, in linear light) for the red channel and for
the green channel. The material computes `mix(greenLinear, whiteLinear, t)` per channel, with blue's t a fixed blend of red's
and green's. That formula is affine in t, so every filter the GPU runs on t (mips, trilinear, anisotropic) gives the same
linear-light result as the old sRGB texture, which was decoded first and filtered after. A texel lands within 1 LSB of
the canvas in green, 1.4 in blue and 4 in red at the dark end. The grey posts and board backs no longer sample a texel:
their uv sits on a sentinel row the material paints the same grey. The shader edit goes through `patchShader` (chained),
so the inherited fog hook still runs.

Rejected on the way, measured: **R8 with sRGB rebuilt in the shader** (3.32 MB) filtered in encoded space, which gave
SSIM 0.997 at 7 m. **Linear-light coverage in one channel** was off by up to 35 LSB in red on antialiased texels.
**Splitting or dropping the open-plot atlases** saves nothing at Nalati centre, because three open plots sit within the
900 m visibility of the cells beside them. Their textures are full-colour pictures (13.1 MB) and multi-colour text
(4.2 MB): neither has a lossless smaller form.

## GL bytes by label (desktop Chromium/Metal, iPhone 16 Pro, phone tier, dpr 2, Developer ON, home settled)

| | before `fa4ab4355` | after `ded796a4b` (candidate) |
|---|---:|---:|
| `grid-signs/map` | 22.369628 MB (1024×4096 SRGB8_ALPHA8) | **6.640976 MB** (1024×2432 RG8) |
| `grid-open-plot-billboards/map` | 13.107172 | 13.107172 |
| `grid-open-plot-signs/map` | 4.194300 | 4.194300 |
| all GL (textures + buffers + renderbuffers) | 194.729067 | **179.000415 (−15.73 MB)** |

Receipts: `gl-before-fa4ab4355.json` and `gl-after-ded796a4b.json`. The admission plan (`road.signs`) charges the same bytes:
`test/grid-road-bytes.test.ts` measures RG8 × the full mip chain, and the data array goes on upload.

## Pixels: 11 fixed poses, before and after (`compare-before-after.json`, `before-after-diffx8.jpg`)

The poses: three boards nearest the start, each read from 7, 22 and 70 m, plus two views from the spawn inside the cell.
Each pose is captured twice: the full frame with the HUD hidden, and the same frame with every drawable except
`grid-signs` hidden (signs only).

- **Signs only:** SSIM ≥ 0.99995 at 10 of 11 poses (seven are 1.000000). The exception, sign2-70m (0.99971), comes from
  the cell screen's printed build id (`BUILD fa4ab43` / `BUILD ded796a`), which stays visible there; the sign pixels match.
- **Full frames:** these sit inside the same-build noise floor (`noise-before-before2.json`, two runs of the before build:
  animated creatures and water). Example: sign0-7m is 0.999967 before/after, against 0.999910 before/before2.

Tools: `capture.mjs <base> <out> <label>` (through `scripts/browser-lane.sh`) and `compare.py <dir> <a> <b> [out]`.
`signs.json` holds the Developer-ON layout's sign positions the poses are aimed from.

Plan-State: unchanged (the coordinator owns SHARD-PLATFORM.md).
