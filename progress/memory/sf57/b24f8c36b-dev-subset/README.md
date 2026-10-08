# SF57 Developer subset — b24f8c36b

Pinned runtime `b24f8c36b31f40d6584e3639209a0b401c69c844`, including Pine compressed-array fix `aaed58103`. One owned queued preview, HTTP/disk `b24f8c3-muzih586`, served both attempts. Developer ON, phone tier, portrait, 2x render scale, mute, live owned grid; road hover at the production 30 m/s cap and walking inside cells. No GC, reload, manual eviction or proxy substitution.

Route: **Driftwood → Pine → Nalati → template-2 → Driftwood**; the first full lap adds all sixteen crossroads. The Developer catalogue has one template copy because Sky Reach and Signal Dunes replace the other template placements. Those two shards, the shipped layout and road-only coverage remain open. This approved subset is functional/diagnostic evidence, never the qualifying full-catalogue SF57 gate.

Observer: light `c132d0f9a` GL observer plus coalesced exact-state journal; **raw storage tracing and call-site stacks OFF**, no extra GPU probes. WebContent physical footprint and fresh interval high are sampled every second; live labelled GL and allocator accounting are captured separately. The ruler is **game WebContent + live GL** during play (conservative all-WebContent overlap + GL during loading). GPU-process footprint remains separate, never added. Complete journal replay can cover a blocked JS timer; missing samples are not interpolated and the actual-census join stays at 1.5 seconds.

`protocol.json` records exact source hashes. The committed `788482c19` borrowed-home harness opt-in landed while waiting for the Simulator and is explicitly recorded; these SF57 plans omit that option, retaining strict entered-residency checks. Twenty-two observer/owned-route Node checks and eleven frame-route Vitest checks passed before starting.

## Five-minute rehearsal

Command: `scripts/browser-lane.sh --max 20 node scripts/soak/soak.mjs --prepared=<rehearsal/manifest.json> --borrowed-preview`. The child borrows the parent-owned preview so the same build survives for the long run; the owner stops it after both phases.

**Functional PASS: 307.458 seconds.** All four real subset entries and source-runtime retirements verified, errors 0, GPU losses 0, missing GL samples 0, sampling true, unload leak census zero. First D/P/N/template/D traversal took 166.716 seconds; the remaining rehearsal drove the road tour, reaching four crossroads before the duration cutoff. It completed no full lap including the road tour; that partial lap is not counted complete.

**Memory cap FAIL:** playing peak **1,037,386,120 bytes** (1,037.386 MB), **37.386 MB over** the 1.0 GB ruler cap. Loading peak 777.277 MB. The duration is also shorter than the thirty-minute gate; `memoryPass` and `gatePass` remain false. This is not a phone reading or a credited native saving.

The rehearsal's Safari, Inspector, proxy and sampler closed; Simulator/browser lanes were 0/1 and 0/4. Its complete failure-inclusive raw evidence is retained before the long run.

## Thirty-minute run

Command: `scripts/browser-lane.sh --max 45 node scripts/soak/soak.mjs --prepared=<soak/manifest.json> --borrowed-preview`. Started after the coordinator called GPU quiet, on the same pinned preview and observer, using a freshly created device `28F80221-7EEF-491C-A267-FD011B3E2625`.

**FAILED at the first Driftwood → Pine crossing.** The native drive phase contains 24 samples over 23.2 seconds. The connected game canvas lost its context at **13:46:46.662 UTC**, 23.7626 seconds after driving began; the document was replaced with the main menu. The strict document fence refused the run and the process exited 1. No entry witness or full lap completed. The successful rehearsal and failed long attempt both remain in the evidence; no failed attempt was discarded or silently retried.

Observed playing peak **678.398 MB**, loading peak **669.288 MB**: these are truncated observations before the failure, **not a memory-cap pass**. `functionalPass`, `memoryPass`, `gatePass`, recovery and leak-zero are false. No unloaded memory baseline exists. The partial lap's allocator peak was 710.603 MB; GPU-process phase peak was 301 MB, reported separately from WC + GL. No lap-over-lap stability conclusion is possible.

Matching native report: `/Users/raynos/Library/Logs/DiagnosticReports/com.apple.WebKit.GPU-2026-10-08-084648.ips`, GPU PID **70471**, capture 13:46:46.6626 UTC, **EXC_BAD_ACCESS / SIGSEGV**. Stack: `_platform_memmove` → ANGLE `UploadTextureContents` → `setPerSliceSubImage` → `setCompressedSubImage` → **`compressedTexSubImage2D`**. This is a compressed **2D** upload fault; the historical array failures were in the 3D path. `soak-crash.json` preserves the original report hash and relevant symbol/image identities, excluding personal crash headers.

## Offline attribution

The last three compressed 2D storage records in the original document occurred together at **13:46:46.331 UTC**, 331 ms before context loss. All have 512 × 512 base size and ten mip levels:

| Shader input / journal identity | Exact labelled asset | Format | Storage bytes |
|---|---|---|---:|
| `tRockD` / `texture:2078` | `/assets/pine-hollow/astc6/tex/mossy_rock/diffuse-bf493a74.ktx2` | ASTC 6×6 sRGB, `0x93d4` | 158,432 |
| `tRockN` / `texture:2079` | `/assets/pine-hollow/astc6/tex/mossy_rock/nor_gl-bcd9bcf8.ktx2` | ASTC 6×6 RGBA, `0x93b4` | 158,432 |
| `tRockA` / `texture:2080` | `/assets/gpu/tex/mossy_rock/arm.phone-ebb00dd2.ktx2` | ETC2 RGB8, `0x9274` | 174,776 |

`world/crags.ts` creates these through **awaited** `PineCrags.load` → `loadPBR("mossy_rock")` → `cragMaterial`. The `pine.crag` shader patch closes over `u`, then copies it into `shader.uniforms`; it supplies **no `opts.textures` registry**. The material itself has neither these map properties nor a `uniforms` property. `collectTextures` therefore cannot discover them. `ForestLandmarks` awaits loading before building the crags: this is a hidden-uniform registry miss, **not an async fetch arriving after warm-up**.

The source flow and late ordering support first upload during the composer draw after Phase C. The light run has no timestamped warm-up-completion hook or compressed-subimage call trace: **the exact texture/mip in flight at the native fault remains unproved**. Storage records are not GPU completion timestamps. The six registered arrays uploaded earlier on separated slices (last bark array at 13:46:46.073 UTC). `soak-upload-candidates.json` retains all 120 compressed 2D identities, exact source excerpts/hashes and these inference limits; `soak-failure.json` retains the document/context events and last pre-fault actual census. The rendering owner received the finding; this receipt changes no renderer code.

Safari, Inspector, proxy and sampler closed. Simulator/browser lanes verified **0/1 and 0/4**; explicit release went to sp-x4 and the coordinator. SF57 stays open pending the general upload fix, matched fresh-device counterfactual and soak retry.

## Reproduction and raw evidence

`summary.json` preserves the unchanged grades and per-lap model. `rehearsal.json.br` and `soak.json.br` are Brotli JSON containers with original UTF-8 files under `files`: manifest, result, native samples, GL samples, exact-state events, raw-upload file (empty by policy), phase and command transcript. `archives.json` gives archive and original SHA-256 hashes; all sixteen raw files were round-trip checked. `fixture.html.br` preserves the exact injected script. Decode with Node `brotliDecompressSync`, then `JSON.parse` for the container. Compressed evidence: **444,576 bytes**. The original grades' generic refusal text predates expanded catalogue coverage; absence of an entry witness in this failed attempt is not a separate proven admission refusal.
