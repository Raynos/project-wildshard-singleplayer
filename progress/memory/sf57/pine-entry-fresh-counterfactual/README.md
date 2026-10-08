# Pine compressed-array upload: fresh-device counterfactual

Five **freshly created Simulator devices per arm**, alternating baseline then fix. Baseline `cdad59776201998220705ca0c6fc16a5e7dd38b5`; isolated fix `71f385a525bf9d54f4b55ee58df04ee68c3e1e2d` has that sole parent and only four runtime changes (22 insertions, 6 deletions): precompile, shader texture registry, terrain registration and Pine bark registration. Main fix is `aaed58103019ddd208115f0580e5dad7cacb7232`.

**Baseline: 2/5 entry GPU losses, 3/5 settled. Fix: 0/5 losses, 5/5 settled.** Zero boot failures, unresolved outcomes or upload-trace overflow. Every completed entry retained the same document through a 20-second Pine settle and had a zero unload leak census. Five trials per arm support this fix on the tested route; zero observed fixed failures does not establish absence of future failures.

Developer ON, phone tier, portrait, render scale 2, mute; cold Safari, cleared origin storage/service workers/cache, identical Driftwood road-to-Pine socket route. The exact driver and frozen source hashes are retained in `driver.mjs.br`, `protocol.json` and `summary.json`. Command: `scripts/browser-lane.sh --max 45 node <archived-driver.mjs>`; each worker invokes the existing soak harness through sim-lane. Baseline01 was completed before the fixed preview was ready and explicitly adopted once by the driver; it was not rerun or counted twice. Every other attempt was newly created in alternating order. Short diagnostics intentionally exit 1 because they do not meet the soak duration; entry verdicts use the explicit connected-canvas loss / 20-second-settle witnesses.

| Pair | Baseline | Fix | Baseline six-array span (ms) | Fix span (ms) |
|---|---|---|---:|---:|
| 1 | settled | settled | 2 | 167 |
| 2 | GPU loss | settled | 1 | 168 |
| 3 | settled | settled | 1 | 168 |
| 4 | GPU loss | settled | 1 | 169 |
| 5 | settled | settled | 12 | 170 |

These spans measure **first storage allocation notifications**, not upload transfer duration. The bounded stack sample shifts from `warmComposerFrame` / `composer.render(0)` in the baseline to `runPrecompile` / `renderer.initTexture` in the fix. Exact bundle hashes, source excerpts and per-attempt stacks are in `analysis.json`. The registered arrays now warm on separately fenced paint slices before the composer draw. No extra GL queries were added to the observer between arms.

The same six arrays appear in every attempt: ground diffuse/normal 1024x1024x4 (ASTC 6x6 sRGB/unorm), ground ARM 512x512x4 (ETC2 RGB8), bark diffuse/normal 512x512x5 (ASTC 6x6 sRGB/unorm), bark ARM 512x512x5 (ETC2 RGB8). `analysis.json` retains exact asset identities, dimensions, internal formats, mip counts, bytes and call sites per attempt. Terrain uniforms `tDiff/tNorm/tArm` and bark `tBarkD/tBarkN/tBarkA` were injected through shader patches and missed by the old material-own-value collector. The native fault identifies compressed 3D upload, **not one exact array or mip**.

Both failed baseline GPU PIDs match native reports:

- Pair2, PID **68305**, `/Users/raynos/Library/Logs/DiagnosticReports/com.apple.WebKit.GPU-2026-10-08-064458.ips`, capture 06:44:58.0936 Panama.
- Pair4, PID **86680**, `/Users/raynos/Library/Logs/DiagnosticReports/com.apple.WebKit.GPU-2026-10-08-065445.ips`, capture 06:54:45.4098 Panama.

Both are **EXC_BAD_ACCESS / SIGSEGV**, `_platform_memmove` -> ANGLE `UploadTextureContents` -> `setCompressedSubImage` -> `compressedTexSubImage3D` on the RemoteGraphicsContextGL work queue. Their original hashes and sanitized symbol stacks are retained; personal crash-report headers are excluded. These are recorded segmentation faults, not recorded jetsam terminations.

Memory is a separate, unresolved result. Entry API peaks overlap: baseline 228.726–232.694 MB, fix 229.199–232.694 MB. Fixed03 completed despite a native WebContent interval high of **1.829 GB** (sampled 1.163 GB); failed baseline04 reached 1.831 GB (sampled 1.820 GB). Fixed01 raw `sampling` grade is false; its successful entry witness is retained without converting it into a memory pass. All raw grades remain unchanged. API bytes exclude driver-private/transient storage; per-mip notifications are neither literal GL call counts nor transferred bytes. GPU-process footprint stays separate from the WC + live labelled GL ruler.

`archives.json` records ten Brotli JSON containers, each preserving six original UTF-8 files under `files` (60 raw files total), plus both exact injected fixtures and the driver. All original and archive SHA-256 hashes were round-trip checked. Total compressed bytes: **2,013,983**. Decode using Node `brotliDecompressSync`; JSON containers then parse with `JSON.parse`.

Simulator/browser lanes were 0/1 and 0/4 on release; Safari, Inspector, proxy and sampler closed. Both borrowed preview servers were retained; only the exact archived SF57 fixture blocks were removed. No phone-cap, native-saving, full-catalogue or 30-minute SF57 claim. The qualifying soak remains open.
