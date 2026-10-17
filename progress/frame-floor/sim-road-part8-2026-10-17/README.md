# Simulator road, normal player texture path (2026-10-17)

The standing 30–60 fps goal is open. This pass makes the normal capability
probe the primary measurement; the skipped-probe pair is continuity only.
A row earns floor credit only when both quiet AFTER runs have p95 at most
35.0 ms and maximum at most 200 ms. Simulator results describe Mac-backed
Mobile Safari, not the physical iPhone.

## Method

BEFORE uses the exact part-seven served DEVSERVER game
`17ef0c2e8e56bbbe86b1e72fa4d6f253afbb6a9d`, build
`17ef0c2-mvcvojod`, on port 4480. The standard harness drives the actual
roads in this order: Sky, Nalati, Pine, Driftwood. Each pair uses 120-frame
travel/interior windows, whole-drive sampling through all entry hooks,
phone tier, 2× scale and the shipped 30 fps cap. The texture-selection pin
is KTX2 on both paths; only the continuity pair skips the capability probe.
A normal probe may overrule that selection and load images, as it does for
players when a compressed family fails its sampling controls.

BEFORE runs under ordinary shared machine load. No CPU hold is requested
for BEFORE or attribution; these readings receive no quiet timing credit.

The native diagnostic adds Time Profiler on all host processes, then
retains only the game's Simulator WebContent identity and sampled stacks.
Two `(performance.now(), Date.now())` anchors fence the route; their
wall/page offsets must agree before matching individual frames to the
trace start date. Main-thread sampled weights are not stopwatch times.
Nested samples and exact calls are never added as independent costs.

A temporary harness observer records synchronous Promise reactions, Wasm
constructors, image decode requests and GL texture allocation/upload/mipmap
calls with input dimensions/byte lengths and page timestamps. Native
`await` continuations can bypass `Promise.prototype.then`; absence of an
observed reaction is not evidence of idle time. Decode promise latency
includes queueing and worker execution; only its call's synchronous span
belongs to the main thread. GL API wall time is not GPU execution.

Game modules and assets are unchanged for this first native attribution.
Diagnostic timing is excluded from floor credit. Raw trace/XML data stays
under the task's ignored scratch directory until compact evidence has
been extracted, then is deleted.

## Paired BEFORE under shared load

All four runs complete without runtime errors. The cohort runner exits 0
because every measurement completed; each individual floor command exits 2.
No quiet BEFORE pass is claimed.

### Normal capability probe (primary)

| Row | p95 A/B (ms) | Max A/B (ms) |
| --- | ---: | ---: |
| spawn | 34/34 | 42/35 |
| grid-deck-east | 34/34 | 38/34 |
| grid-crossroads | 34/34 | 34/34 |
| grid-far-reach-road-entry-travel | 35/34 | 155/187 |
| grid-far-reach-road-entry-drive | 44/44 | 155/187 |
| grid-far-reach-road-entry | 34/34 | 35/43 |
| grid-nalati-grasslands-road-entry-travel | 46/46 | 70/75 |
| grid-nalati-grasslands-road-entry-drive | 35/36 | 73/86 |
| grid-nalati-grasslands-road-entry | 34/35 | 42/44 |
| grid-pine-hollow-road-entry-travel | 46/53 | 115/147 |
| grid-pine-hollow-road-entry-drive | 41/43 | 239/275 |
| grid-pine-hollow-road-entry | 34/34 | 35/35 |
| grid-driftwood-isle-road-entry-travel | 42/36 | 59/59 |
| grid-driftwood-isle-road-entry-drive | 42/36 | 79/85 |
| grid-driftwood-isle-road-entry | 35/35 | 35/35 |

### Skipped capability probe (continuity)

| Row | p95 A/B (ms) | Max A/B (ms) |
| --- | ---: | ---: |
| spawn | 44/34 | 48/44 |
| grid-crossroads | 34/34 | 34/34 |
| grid-deck-east | 34/34 | 34/34 |
| grid-far-reach-road-entry-travel | 35/34 | 145/156 |
| grid-far-reach-road-entry-drive | 35/34 | 145/156 |
| grid-far-reach-road-entry | 34/34 | 35/35 |
| grid-nalati-grasslands-road-entry-travel | 43/42 | 69/97 |
| grid-nalati-grasslands-road-entry-drive | 35/34 | 82/97 |
| grid-nalati-grasslands-road-entry | 34/34 | 36/40 |
| grid-pine-hollow-road-entry-travel | 35/36 | 117/115 |
| grid-pine-hollow-road-entry-drive | 35/35 | 262/287 |
| grid-pine-hollow-road-entry | 34/34 | 37/35 |
| grid-driftwood-isle-road-entry-travel | 41/43 | 58/69 |
| grid-driftwood-isle-road-entry-drive | 35/38 | 95/76 |
| grid-driftwood-isle-road-entry | 35/35 | 38/35 |

## Native attribution and selected fixes

The normal probe chooses **images**, not ASTC or ETC2, on this Simulator.
Linear `RGBA_ASTC_4x4` passes its individual control, but sRGB ASTC returns
zero at mip 1. ETC2 controls also fail. The family-level veto leaves no
compressed target for either UASTC or ETC1S. The KTX2 transcode path already
uses a scoped worker pool; moving that transcode off the main thread would
not address the normal player path observed here.

[Pine native evidence](pine-native-before.json) records both clock anchors
(zero drift), every sampled interval over 35 ms, exact Wasm constructor
spans, bitmap requests and the retained large GL calls. A 69 ms travel
interval (page 43195–43264 ms) has 68 ms sampled main-thread execution,
including 56 ms in a `WebCore::PendingImageBitmap` completion. The
`createImageBitmap` call itself returns in 0 ms: its async API does not
prove that WebKit completes decoding away from the page thread.

A 215 ms play interval (48262–48477 ms) has 168 ms sampled main-thread
execution, including 111 ms GC nested inside `Wasm::Memory::tryCreate`.
Five fresh 64 KiB v1 memories are constructed consecutively, each about
30–33 ms, while installing four elites and the king. Module/instance
construction is 0–1 ms each. Nested GC and Memory weights are not added.
The uninstrumented BEFORE pair independently reproduces play maxima of
239/275 ms with the normal probe and 262/287 ms with the skipped probe.

The fixes stay on existing shared paths. Admitted page counts prepare
fresh, fixed-size decision memories one per drawn frame; the ordinary
constructor consumes each once under its owner. Guest initialization,
seeds and snapshots remain at their original construction point. Both
Pine and Driftwood already use this page decision authority. Image loads
use one page-owned serial worker with the original Blob and bitmap options
and transfer the resulting bitmap. Unsupported/error paths retain the
original decoder. Fetching, texture formats, mipmaps and sampling remain
unchanged. The tests exercise cancellation, isolation, exact initialized
guest memory, transfer ownership and error cleanup.

The observer retained eight 1024² and nineteen 512² RGBA array-layer
uploads plus one small LUT, with 99 ms combined synchronous GL API spans
and individual 6–7 ms calls.
Those are API wall spans, not GPU duration. Earlier small grid canvas
updates filled its 10,000-call ring, so this first trace is explicitly an
incomplete texture inventory. A filtered follow-up is required before
claiming complete format/byte counts. Diagnostic observers retain stack
strings and can increase GC pressure; their timing earns no floor credit.

## Driftwood standalone attribution

The requested exact `427023fff` normal-probe diagnostic completes at
spawn/beach/wreck p95 **49/48/49 ms**, maximum **57/61/55 ms**, under shared
load. [Native evidence](dw-native-diagnostic.json) retains the three poses
and clock anchors (at most 1 ms drift). The worst intervals contain
37–47 ms sampled main-thread work, including 15–27 ms of GC-related
stacks. Exact composer/render calls reach 30–38 ms, while the shard CPU
owner is about 2 ms p95. These nested spans must not be summed. The
observer's allocations can amplify GC, so this is attribution evidence,
not a replacement for sp-x4's uninstrumented 69/52/53 ms standalone floor
or proof that the renderer/GPU alone causes the deficit. A control attempt
could not run because the supplied port 4404 had already closed.
## Shared-path host bar

Both changes score **6/6** against `docs/HOST-BAR.md`:

| Test | Evidence |
| --- | --- |
| Two real users | `src/shards/pine-hollow/runtime/index.ts:244` and `src/shards/driftwood-isle/runtime/index.ts:68` use page decisions. `src/shards/pine-hollow/world/treeFactory.ts:67` and `src/shards/nalati-grasslands/species/hulls.ts:78` use image loaders. |
| No shard nouns | `src/engine/script/decisionModule.ts:19`, `src/engine/boot/imageDecode.ts:54`: generic allocation/decode paths. |
| Data-driven | `src/game/shardfile/borrowedDecisions.ts:64` reads admitted pages; `src/engine/boot/bytes.ts:173` preserves Blob/options. |
| Server-safe or client presentation | `test/decision-host.test.ts:197` runs renderer-free; `src/engine/boot/imageDecode.ts:50` documents the page/worker presentation path. |
| Deletion test | Either page authority consumer survives removal of the other. Texture decoding serves independent Pine and Nalati texture consumers. |
| Data-only API | `src/engine/script/decisionModule.ts:19` accepts page counts plus lifecycle scope; `src/engine/boot/imageDecode.ts:54` accepts Blob/options. No shard callback or reflection API is added. |

The immutable candidate `9e74fa537` passes all 40 tests in the five focused
files, including all 17 shard-headless cases, root types, layer types,
lint and all ten product builds. The real pre-commit hook independently
checks typed lint. The inherited Pine map stamp is stale after
`9cc43b4e9`; the G490 single-owner batch policy assigns that refresh to
sp-x10. This change authors no shard map inputs. No strict-map-green claim
is made for that stale inventory.

A second BEFORE capture removes Promise/GL stack collection and filters
small canvas traffic. Its [complete retained upload ring](pine-upload-before.json)
contains 794 allocation/upload/mipmap calls, below its 20,000 cap. It sees
**no compressed upload calls** during Pine entry. Array layers use RGBA
UNSIGNED_BYTE: eight 1024² layers (32 MiB total, 56 ms API spans) and
nineteen 512² layers (19 MiB, 52 ms). Each event retains its containing
frame and page timestamp. Storage includes RGBA8 and SRGB8_ALPHA8; these
sizes are raw base-level upload bytes, not mip allocation, retained memory
or network bytes. This run again has 133 main-page bitmap requests and
consecutive fresh Wasm memories around 30 ms each. Travel p95 is 49 ms;
whole-drive maximum is 209 ms. It remains diagnostic/shared-load evidence.

A control now uses the still-served part-seven build: the diff between
`17ef0c2e8` and `427023fff` over `src/`, `public/` and the generation-job
manifest is empty, so runtime/asset sources match the requested DW
baseline exactly. It removes the temporary GL/Promise observer and keeps
only the task clock, frame timeline and native profiler. This distinguishes
repeated render cost from diagnostic stack allocations before assigning
the DW tail.

The [DW control](dw-native-control.json) completes at p95 **41/40/34 ms**,
max **54/46/37 ms**, without the temporary observer. Its worst spawn
54 ms interval has 50 ms main-thread samples, including 22 ms GC-related
stacks. The 46 ms beach interval has 20 ms main samples (2 ms GC); the
37 ms wreck interval has 16 ms (no GC category). Those unaccounted tails
cannot be assigned to renderer CPU or GPU execution from this trace.
The control retains exact task-call overlaps and source/asset tree hashes
for both runtime-equivalent SHAs. Standing DW has a separate GC/render/
scheduling tail; it is not evidence of main-thread KTX2 transcode.

[Pixel equality](pixels.json): the production worker transferred bitmaps
for an alpha PNG, Pine forest leaves and Pine bark. All nine cases (normal,
flipped, resized with the existing medium filter) compare every canvas
RGBA byte with the original main-page decoder; **zero differing bytes**.
This covers the decoder/options change, rather than claiming full-scene
physical-device parity.

[Source-basis ruler](ruler.json): all ten shards are unchanged, **net -0
shard lines**. The candidate's complete inventory was generated/measured
in check3. The exact parent inventory reuses sp-x10's verified mirror
receipt (SHA256 in the JSON); a redundant queued build was cancelled.
The performance priority earns no line-cut or runtime-file deletion
credit. Shared engine/game source grows by 161 physical net lines.

The [candidate diagnostic](pine-upload-candidate.json), still under shared
load and excluded from floor credit, records the production image worker
and no main-page bitmap requests on Pine entry. Fresh memories are paced
across frames before controller installation. Pine travel p95 is 42 ms,
whole-drive p95 37 ms/max 117 ms; the largest play-tagged frame is 59 ms.
This demonstrates adoption without claiming a quiet AFTER pass.
