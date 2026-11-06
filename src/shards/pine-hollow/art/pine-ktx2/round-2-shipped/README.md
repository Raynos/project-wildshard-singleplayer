# Pine Hollow textures shipped: KTX2 on the phone (G386, sp-o119, 2026-10-13)

Jake picked B on [../round-1-variant/board-ab.jpg](../round-1-variant/board-ab.jpg). Pine's
phone tier declares `textures: 'ktx2'` (c5e3f52fa); the engine-wide Debug row GPU textures
(`tex`) is gone. Tests and captures pin a mode with the harness pin
`window.__wildshardHarness.textures` (never a setting, row or URL switch).

## Look: [board-ab.jpg](board-ab.jpg)

`scripts/proof-pine-look-parity.mjs` on one DEVSERVER build of `993c54a46`, phone tier,
Chromium on Metal as "iPhone 16 Pro" at 2×, muted. B is the shipped default, A is the same
build with `--textures=img`. They look identical; the differences are compression noise:

| Pose | Mean abs diff | PSNR | Pixels off by more than 16 | more than 32 |
| --- | ---: | ---: | ---: | ---: |
| gate | 2.3 / 255 | 36.0 dB | 1.2 % | 0.08 % |
| ranger cabin | 3.3 | 32.6 | 4.7 % | 0.54 % |
| pond | 2.4 | 36.1 | 1.1 % | 0.09 % |
| mill | 2.3 | 34.8 | 3.1 % | 0.40 % |
| lookout | 2.5 | 32.5 | 6.5 % | 1.48 % |
| north | 2.3 | 35.6 | 1.4 % | 0.13 % |

Mean brightness matches within 0.6 / 255 on every pose. Draws, triangles and colliders are equal.
Desktop pixels are identical, as expected: the desktop tier still uses Auto (images).
GPU bytes on the phone tier: **274 MB with KTX2, 599 MB with images**.

## Simulator: what the KTX2 capability probe does

The probe (`src/engine/render/ktx2Probe.ts`) is **right about the Simulator and wrong about
phones**. The iOS Simulator's Safari really does sample the lower mips of sRGB ASTC / ETC2 as
zero, so KTX2 pixels there would be broken, and vetoing them is the correct call on that GPU.
That bug belongs to the Simulator's GPU path. A physical iPhone samples ASTC natively, and Sky
Reach's phone KTX2 ships on it. So the probe stays as it is, and real iPhones are not affected.

Because of the veto, every Simulator frame floor ran the images path, even though phones
use KTX2: since G188, Pine's images-first playing estimate (1.20 GB, over the 1.0 GB cap)
already chose KTX2 on a phone. The measurement-only harness pin `ktx2Probe: 'skip'`
(`scripts/frame-floor.mjs --ktx2-probe=skip`) skips the probe, so the floor times the KTX2
path a phone runs. Simulator pixels are wrong with it, so it is never a look proof. The
floor's metadata records `window.__wildshard.textures()`, so each run shows its mode.

## Simulator grid Pine route, KTX2 active (`993c54a46`)

`frame-floor.mjs --shards=grid --surface=sim --grid-scenario=milestone --devserver
--grid-routes=pine-hollow-road-entry --ktx2-probe=skip`. Both runs report `textures.mode = ktx2`
and the probe as skipped. The machine was under load (load average ~14, several builds running).

| Run | Travel p95 | Drive p95 / max | GPU (glMB) | Modelled MB | Spawn p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| [1](../../../progress/frame-floor/993c54a46-19555-1791893488542.json) | 42 ms | 35 / 174 | 287 | 1023 | 38 (FAIL) |
| [2](../../../progress/frame-floor/993c54a46-33150-1791893772030.json) | 41 ms | 35 / 127 | 245 | 1023 | 39 (FAIL) |
| round 1, A images | 52–58 ms | 35–39 / 103–117 | 526 | 1755 | — |

Travel improved from 52–58 to 41–42 ms, but it is still above the 35 ms Simulator gate. The
spawn row (the crossroads, before Pine) misses by 3–4 ms in both runs, and that is not Pine's
textures. Download is unchanged from round 1: the phone boot list is 61.0 MB in the grid
(ASTC 6×6 overlay) and 96.0 MB standalone, against 31.4 MB for images.
