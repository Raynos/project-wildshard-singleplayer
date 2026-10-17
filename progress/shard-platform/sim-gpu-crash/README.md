# Simulator GPU-process crash: 2026-10-17 (OM)

The Simulator grid drive's "graphics recovery" (*"the GPU process restarted: every canvas was wiped"*, plus the follow-on
`window.__wildshard.world` TypeError) is **a WebKit GPU-process crash, not a memory ceiling and not a code regression.**

## Evidence

- 15 `com.apple.WebKit.GPU` crash reports from in-game runs on 10-17, 04:53–06:10 (`~/Library/Logs/DiagnosticReports`).
  Every one is a SIGSEGV in `_platform_memmove` ← ANGLE `rx::UploadTextureContents` ← `TextureMtl::setPerSliceSubImage`
  ← `compressedTexSubImage3D` (two are `2D`). Each read runs past the end of its payload buffer, most often a 16 KB IPC
  Mach-message region.
- A traced build (an upload beacon on every `compressedTex*` call) crashed during an upload batch that contained
  `COMPRESSED_RGB8_ETC2` (0x9274) array levels.
- Standalone repro (a 30-line page, Simulator Safari): texStorage plus `compressedTexSubImage2D/3D` of **RGB8 ETC2**
  crashes the GPU process every time (2D and 3D, edge 512). RGBA8 ETC2/EAC, ASTC 4×4 / 6×6 (sRGB and linear) at sizes
  up to 1024×4 layers, and nonzero unpack state all survive.
- The KTX2 probe already turns ETC2 off on the Simulator. Only the G386 measurement pin (`--textures=ktx2
  --ktx2-probe=skip`) leaves it on, so opaque ETC1S files transcode to RGB8 ETC2. OT's unpinned 7afedf243 run completed
  8/8 for that reason. The pinned runs (sp-x7, OP3, OP5) were the ones that crashed. Crossing 1.2 GB did not cause it:
  Nine settles at 1,242 MB in the passing runs below.

## Fix

`0e9f5d4c9` fix(ktx2): under the probe-skip pin, every probe-filtered KTX2 loader widens RGB8 ETC2 to RGBA8 ETC2/EAC.
It puts an opaque EAC alpha block in front of each colour block, and the colour half decodes identically. Those few
textures cost twice the bytes (about 2 MB of uploads on the milestone drive). Shipped pages are unchanged: the probe
still sends the Simulator to images.

## Proof (one served build of 0e9f5d4c9, Sim, G386 pins, memory saver off, no CPU hold, no timing credit)

| Route | Settled MB run 1 | Settled MB run 2 | Journey peak MB |
| --- | ---: | ---: | ---: |
| Template interior | 598.44 | 598.44 | 903.4 |
| Template return / Driftwood | 904.17 | 904.17 | 904.6 |
| Nine Dragon road entry | 1,242.40 | 1,242.40 | 1,242.4 |
| Sky Reach road entry | 739.23 | 739.23 | (Nine's carried) |
| Nalati road entry | 801.76 | 801.76 | 805.7 |
| Pine road entry | 767.40 | 760.30 | 801.8 |
| Signal road entry | 639.27 | 639.27 | 767.4 |
| Driftwood road entry | 904.12 | 904.12 | 904.1 |

Both milestone runs completed 8/8 with zero runtime errors and no new GPU crash report. A separate Pine road route run
also completed (settled 767.88 MB, peak 775.2 MB). Memory is the frame floor's residency model. The largest Simulator
WebKit process peaked at 2.07 GB RSS on the Pine run and 3.18 GB RSS on the milestone run (Mac RSS, not phone
footprint). The frame floor still misses its timing bars; those runs had no CPU hold.
