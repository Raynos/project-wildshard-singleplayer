# Pine entry GPU restart: historical ten

Runtime `cdad59776201998220705ca0c6fc16a5e7dd38b5`; harness `3b6227349` + `7e9b594cc`. Developer ON, phone tier, portrait, render scale 2, mute, one owned Simulator; every attempt cold Safari + local/session/service-worker/CacheStorage reset, same Driftwood-to-Pine road/socket route, 20-second Pine settle.

Observed **1/10 GPU losses, 9/10 settled entries**, zero boot failures/unresolved outcomes/upload-trace overflow. **Attempt 1 created a fresh device; the other nine reused it after shutdown.** This ordering prevents treating the result as ten independent fresh-device boots. The next protocol alternates five freshly created devices per baseline/fixed arm.

Command: `scripts/browser-lane.sh --max 45 node scripts/soak/pine-rate.mjs http://127.0.0.1:4401/ <fresh-output> cdad59776201998220705ca0c6fc16a5e7dd38b5`. Each worker uses sim-lane; all resources closed. Short diagnostics intentionally exit 1 because they do not meet the five/30-minute soak duration; outcomes come from the explicit entry witness.

| Attempt | Outcome | Max sliding 1s growth (MB) | Entry live API peak (MB) |
|---|---|---:|---:|
| 1 | GPU loss | 111.300 | 228.726 |
| 2 | 20s settled | 117.877 | 232.691 |
| 3 | 20s settled | 118.764 | 232.694 |
| 4 | 20s settled | 118.761 | 232.691 |
| 5 | 20s settled | 118.761 | 232.691 |
| 6 | 20s settled | 118.764 | 232.694 |
| 7 | 20s settled | 118.764 | 232.694 |
| 8 | 20s settled | 118.764 | 232.694 |
| 9 | 20s settled | 118.761 | 232.691 |
| 10 | 20s settled | 118.764 | 232.694 |

Successful entries have **higher**, overlapping bursts and peaks. Even the 16ms maximum overlaps (failure 20.378 MB, success 20.424 MB). These data do not establish a budget/size threshold. `analysis.json` retains 16/50/100/250/500/1000ms windows. API bytes exclude driver-private/transient memory; notifications count per-mip storage bookkeeping and are not literal GL call or transferred-byte counts.

The exact failed GPU PID **87505** matches `/Users/raynos/Library/Logs/DiagnosticReports/com.apple.WebKit.GPU-2026-10-08-061826.ips`, capture 06:18:25.7607 Panama: **EXC_BAD_ACCESS / SIGSEGV**, `_platform_memmove` → ANGLE `UploadTextureContents` → `setCompressedSubImage` → `compressedTexSubImage3D`. GPU identity changes to **92912** with a new kernel start identity; game WebContent **87472** remains. The report records a segmentation fault, not a jetsam termination. Sanitized signature, original hash/path and symbol stack are in `analysis.json`; no personal crash-report metadata is copied.

The sampled texture stacks resolve to `runPrecompile.initTexture`; buffer/3D-array stacks resolve to `warmComposerFrame` final `composer.render(0)` in the exact hashed bundle. Six compressed arrays first allocate in the final draw: ground diffuse/normal 1024²×4 and ARM 512²×4; bark diffuse/normal/ARM 512²×5. `arrays.json` has exact identities, formats, mip counts, labels and bytes. Their uniforms are injected by terrain/bark shader patches, outside the old material-own-value collector. The native stack identifies compressed 3D upload, **not one exact array/mip**. This supports the registered-texture warm-up counterfactual; it does not prove it yet.

Raw evidence: ten Brotli JSON containers each preserve six original UTF-8 files under `files`. Decode with Node `brotliDecompressSync`, then `JSON.parse`. `archives.json` lists each archive hash and every original raw hash; all 60 raw files were round-trip verified before scratch cleanup. `fixture.html.br` preserves the exact injected block.

No phone-cap, saving, full-catalogue or 30-minute SF57 claim. The existing wrapper's model/phone estimates are raw historical output, not accepted conclusions. The fresh-device isolated counterfactual remains open.
