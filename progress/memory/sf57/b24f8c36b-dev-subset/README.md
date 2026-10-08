# SF57 Developer subset — b24f8c36b

Pinned runtime `b24f8c36b31f40d6584e3639209a0b401c69c844`, including Pine compressed-array fix `aaed58103`. One owned queued preview, HTTP/disk `b24f8c3-muzih586`, is retained between the rehearsal and long run. Developer ON, phone tier, portrait, 2x render scale, mute, live owned grid; road hover at the production 30 m/s cap and walking inside cells. No GC, reload, manual eviction or proxy substitution.

Route: **Driftwood → Pine → Nalati → template-2 → Driftwood**; the first full lap adds all sixteen crossroads. The Developer catalogue has one template copy because Sky Reach and Signal Dunes replace the other template placements. Those two shards, the shipped layout and road-only coverage remain open. This approved subset is functional/diagnostic evidence, never the qualifying full-catalogue SF57 gate.

Observer: light `c132d0f9a` GL observer plus coalesced exact-state journal; **raw storage tracing and call-site stacks OFF**, no extra GPU probes. WebContent physical footprint and fresh interval high are sampled every second; live labelled GL and allocator accounting are captured separately. The ruler is **game WebContent + live GL** during play (conservative all-WebContent overlap + GL during loading). GPU-process footprint remains separate, never added. Complete journal replay can cover a blocked JS timer; missing samples are not interpolated and the actual-census join stays at 1.5 seconds.

`protocol.json` records exact source hashes. The committed `788482c19` borrowed-home harness opt-in landed while waiting for the Simulator and is explicitly recorded; these SF57 plans omit that option, retaining strict entered-residency checks. Twenty-two observer/owned-route Node checks and eleven frame-route Vitest checks passed before starting.

## Five-minute rehearsal

Command: `scripts/browser-lane.sh --max 20 node scripts/soak/soak.mjs --prepared=<rehearsal/manifest.json> --borrowed-preview`. The child borrows the parent-owned preview so the same build survives for the long run; the owner stops it after both phases.

**Functional PASS: 307.458 seconds.** All four real subset entries and source-runtime retirements verified, errors 0, GPU losses 0, missing GL samples 0, sampling true, unload leak census zero. First D/P/N/template/D traversal took 166.716 seconds; the remaining rehearsal drove the road tour, reaching four crossroads before the duration cutoff. It completed no full lap including the road tour; that partial lap is not counted complete.

**Memory cap FAIL:** playing peak **1,037,386,120 bytes** (1,037.386 MB), **37.386 MB over** the 1.0 GB ruler cap. Loading peak 777.277 MB. The duration is also shorter than the thirty-minute gate; `memoryPass` and `gatePass` remain false. This is not a phone reading or a credited native saving.

The rehearsal's Safari, Inspector, proxy and sampler closed; Simulator/browser lanes were 0/1 and 0/4. Its complete failure-inclusive raw evidence is retained before the long run.

## Thirty-minute run

Started after the coordinator called GPU quiet, on the same pinned preview with the same observer. **In flight; no completed-soak claim yet.** Failures and cap overruns will remain in the result. The Simulator goes to sp-x4 after final cleanup.

## Reproduction and raw evidence

`summary.json` preserves the unchanged grades and per-lap model. `rehearsal.json.br` is a Brotli JSON container with original UTF-8 files under `files`: manifest, result, native samples, GL samples, exact-state events, raw-upload file (empty by policy), phase and command transcript. `archives.json` gives archive and original SHA-256 hashes; all were round-trip checked. `fixture.html.br` preserves the exact injected script. Decode with Node `brotliDecompressSync`, then `JSON.parse` for the container. Current compressed evidence: 310,664 bytes.
