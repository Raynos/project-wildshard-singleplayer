# Pine Hollow textures: A images / B KTX2 (sp-o110, 2026-10-13)

[board-ab.jpg](board-ab.jpg): standalone Pine Hollow, phone tier, Chromium on Metal
as "iPhone 16 Pro" at 2×, muted, base `c899d4d01`. Same poses as
`scripts/proof-pine-look-parity.mjs` (gate, ranger cabin, mill). A is Settings ▸ Debug ▸
Loading & memory ▸ GPU textures = Images; B is the same row = KTX2 (Pine's existing
UASTC / ETC1S set; in the grid, B uses the ASTC 6×6 trim overlay of G180 B2).

## What the grid warm-up uploads (Simulator, phone tier)

A URL-tagged `--gl-time` run of the grid Pine route found **no 2048² bitmaps**. On the
phone tier the warm-up uploads 1024² terrain layers (`texSubImage3D`, 6–8 ms each), the
1024² Poly Haven prop maps (6–8 ms each), 512² capped set maps (~3.4 ms each, 53 calls)
and the 1024×512 tree cards (~5 ms). Every one already has a KTX2 stand-in, so no new bake.

## Measured

Simulator: `scripts/frame-floor.mjs --shards=grid --surface=sim --grid-scenario=milestone
--devserver --grid-routes=pine-hollow-road-entry`. A is the base with standard settings.
B is `--setting=tex=ktx2` on a measure-only commit (`6f748842a`, on no branch) that skips
the KTX2 capability probe. The iOS Simulator's own probe vetoes KTX2, because it reads
the mips of sRGB ASTC / ETC2 as zero, so the Simulator's B pixels are wrong. Only its
timing stands for a device.

| Run | Travel p95 / drive max ms | Drive p95 | GPU (glMB) | Modelled MB |
| --- | ---: | ---: | ---: | ---: |
| Sim A1 | 52 / 103 | 35 | 526 | 1755 |
| Sim A2 | 58 / 117 | 39 | 526 | 1755 |
| Sim B1 | 38 / 148 | 36 | 240 | 1009 |
| Sim B2 | 38 / 112 | 36 | 282 | 1009 |
| Desktop A | 16.8 / 183 (FAIL, one between-hooks frame) | 16.8 | 1837 | 1739 |
| Desktop B | 16.8 / 50 (PASS) | 16.8 | 1169 | 979 |

Standalone phone tier (the board run): GPU texture bytes 566 MB with A, 230 MB with B.
Download (Pine's phone boot list): images 31.4 MB; KTX2 96.0 MB standalone, 61.0 MB with
the grid's ASTC 6×6 overlay.
