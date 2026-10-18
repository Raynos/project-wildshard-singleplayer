# Drive resource preparation, 2026-10-18

Status: paired improvement measured; link-fence repair remains default-off.
The coordinator accepted the prior pair on 2026-10-18: no further exclusive
quiet window; one non-quiet DW desktop/Simulator sanity follows source checks.
This page records an engine defect repair, with zero shard-line reduction and no deleted runtime module.
It adds an option to the existing Build pacing Debug row, `links`
("On + prepare streamed resources"). The default remains `on`. A physical
phone reading is still required before enabling the rendering change by
default. No render scale, memory cap, warm-up deadline or look is changed.

## What the traces identify

The measured budgeted comparison pins assets and shard declarations at
`be3924670c374573564c7e31821d12fe01d2fa4a`; the candidate is
`bfd3f7133fe53fbb4837badfc3cab7df27ca34de`. Their `src/shards/` and
`public/` bytes are identical. Attribution uses separate diagnostic runs;
instrumented frame times receive no timing credit.

* Program discovery on a live node-material draw resolved every queued
  future layout. It now pairs the selected identity only; explicit
  preparation resolves each future program without selecting or drawing it.
* Compiled-node samplers were absent from the classic texture inventory.
  Preparation now reads their current values after compile, without a
  second resource registry or new assets.
* Stand-in light IDs missed the future node-program key. A synchronous
  compile borrows actual source-light identities and restores traversal
  and shadow-update state, including failure and cancellation.
* DW's resident-owned static services escaped runtime-child construction
  bindings during sliced world builds. Island and boat geometry reached
  the visible page scene, whose ordinary composer drew it early. Binding
  the resident keeps those services and their runtime descendants in the
  destination construction frame; unrelated page callbacks still suspend
  it. Camera staging recognizes that same resident ancestry. Cold retained
  services publish only after the existing afterPlay preparation.
* Pine's far-herd pages copied 16 rigs into multi-megabyte first buffers.
  Experimental paced pages cap destination geometry at 1 MiB, accounting
  for Uint16 skin indices, Float32 colours, Uint32 indices and shadow-only
  attributes. One larger rig receives one slot. A late frame cannot expire
  the cadence and grow those pages as loading-screen batches. Deferred
  animals retain their original rigs; tint, skinning and packing remain.
* Pine's view-dependent cover still had zero instance counts during warm-up.
  The page eye and destination-local eye differ by 555 metres on this road.
  A zero-step forest update now uses the inverse-transformed local eye,
  after placements register, before shader/draw warm-up. Shared viewer and
  gust uniforms are restored. Identified cover first draws moved before
  activation. One 841104-byte cabin shadow proxy remains hidden until entry;
  it is disclosed, not counted as prepared.
* The final experiment limits world/camera pre-draws to one drawable, one
  new material and 1 MiB per painted frame, and image batches to 1 MiB/4 ms.
  An indivisible larger upload or native compile can still exceed a slice.
  The existing 30-second preparation bound remains unchanged.

[Attribution](attribution.json) retains program IDs, first draws and native
call evidence from the diagnostic attempts. [Cull and first-draw evidence](cull-and-first-draw.json)
retains the later local-eye diagnostics, including the unprepared proxy. Unit tests exercise real node
handler pairing, light identities, construction ownership, cancellation,
retained publication, staged models and herd buffers. Three new test files
are registered in `scripts/gate-test-products.json`.

## Paired timing

Final protocol: A1/B1/B2/A2, desktop then iOS Simulator for each arm,
serially after every other lane's existing jobs ended naturally. Each
surface opens a fresh page and runs the fixed Sky, Pine and DW road-entry
harness, with 120 travel frames. The reported worst and p95 cover the full
road drive, including streaming. Normal GL census remains; task clocks,
GL wall clocks, CPU profiles and frame timelines are disabled. The runner
checks exact served revision, complete routes, errors, context loss and
harness hashes before and after every surface. Its maxima use drawn rAF
vsync intervals, as required by the fixed harness. Callback intervals are
also retained: they include preceding game work and can differ from vsync
cadence. Neither field alone measures physical display presentation.

[Budgeted paired results](budget-pair.json), 1056 seconds, all eight surfaces
complete with zero runtime errors/context loss and unchanged harness hashes:

| Road | Desktop worst before/after ms | Simulator worst before/after ms |
|---|---:|---:|
| Sky | 83.3 / 16.8 | 148 / 83 |
| Pine | 66.7 / 33.4 | 115 / 85 |
| DW | 66.6 / 50.0 | 97 / 78 |

Desktop p95 stays 16.7-16.8 ms. Simulator paired maximum p95 changes
Sky36->34, Pine35->35, DW38->35 ms. There is no whole-drive paired p95 regression. The fixed 120-frame Pine
desktop travel samples quantize from 16.7 to 16.8 ms; those samples remain
in the receipt and are not described as an exact p95 improvement.
Both candidate Simulator arms meet <200 ms. Sky and Pine desktop meet
<50 ms. DW B1 is rounded50.0 ms, at the boundary; B2 is33.4 ms. Strict <50 ms is
not proven for that road, and this is not called a full target pass. Its
B1 ordinary trace records zero frames strictly over50 ms and callback
max47.3 ms; it does not identify the boundary frame's synchronous cause.
The [separate desktop diagnostic](link-boundary.json) reproduces50.1 ms
inside afterPlay and shows issue and discovery in the same painted slice:
Renderer.compile starts86367.1 ms and takes17 ms; native getProgramInfoLog
starts86384.2 ms and takes17 ms. These are two successive steps, not an
indivisible34 ms native call. The later a6ba1e6c4 candidate inserts a painted
fence before discovery whenever a queued program remains. KHR readiness,
error diagnostics, owner cancellation and default pacing are preserved.
Four additional cases in the existing precompile test file pass locally and cover immediate
and deferred parallel completion, serial completion and the default-path
negative control. The compile/link split is the expected fix for that boundary. The
coordinator explicitly requested a non-quiet sanity instead of another
exclusive ABBA; it receives no paired performance-win claim.

The final [non-quiet DW sanity](nonquiet-sanity.json) uses the link-fence
runtime on desktop and Simulator. Both routes complete without errors or
context loss; desktop whole-drive p95/max is 16.7/33.4 ms and Simulator
is 34/78 ms. Other lanes remained active: this is a sanity result,
not a fresh paired performance claim. The original 50.0 ms remains at
the boundary, with the compile/link split as its expected fix.

The [prior completed pair](prior-pair.json), candidate `24521b16a`, is a
failed acceptance reading: Pine Simulator B1 reached 458 ms (B2 91 ms),
Pine desktop reached 50.0 ms and DW desktop 50.1 ms. No p95 regression
appeared. Those misses prompted the local-eye cull fix and smaller painted
batches; they are not discarded or presented as a passing pair. The
ordinary hook clock only overlaps the 458 ms frame with activation; a
separate instrumented run identifies cold geometry/pipeline work, not a
proven 458 ms synchronous JS activation call. Phone-tier far batching is
disabled, so that Simulator outlier was not assigned to the far herd.

## Look and memory evidence

[Native parity](look-parity.json) covers 52 views: DW12, Sky20, Pine20,
across desktop and phone tiers. Pixels, draw counts, triangles, executable
shader sources and colliders match. The later local-eye correction also
retains exact Pine pixels. DW/Sky full GPU census matches. Pine's strict
census comparison refuses only an additional 262144 bytes on both tiers;
that comparison is not described as fully green.

[Allocation evidence](pine-prefetch.json) identifies one existing
256x256 RGBA8 rain cover map, no mipmaps, now uploaded while dry by sampler
preparation. No allocation is removed. This earlier upload increases
observed dry-scene residency by 256 KiB; it introduces no asset or cap.

The memory chip's maximum came from Pine's retained worst-location
estimate even while playing DW at 916/1200 MB. The chip now names the
report owner and ESTIMATE/PAGE TOTAL stage. A fixture reproduces
`pine-hollow ESTIMATE · +140.1 MB`; a separate live muted iPhone16Pro DW
candidate drive reads `pine-hollow ESTIMATE · +140.8 MB`. Totals, reports,
thresholds and budgets are unchanged. The actual-landed phone tail checks live road travel, 2x rendering,
touch HUD and chip bounds.

## Source and landing checks

The [canonical source ruler](canonical-ruler.json) uses the official
source-basis inventory in a build mirror: +120 platform lines, zero shard
lines, no runtime file deleted. The earlier isolated budgeted version was
+116 ([receipt](isolated-ruler.json)). This repair is not counted as a custom
shard reduction. No declared map input is touched ([input check](map-inputs.json)).

[Isolated checks](isolated-checks.json) retain full source checks before
the final numeric batch limits, and exact-final root/layer/scripts types,
typed lint and source accounting. The preceding one-draw candidate also
passes the focused tests including all 17 shard-headless cases. The [canonical exact-tree checks](canonical-checks.json) pass generation,
strict all-ten products with zero map-stale warnings, root/layer/scripts
types, typed lint and all 67 focused tests including the 17 shard-headless
cases. Their post-generation tree is `5e7a531c28c495929b130e105d7b23226e163eb2`
on the six-map canonical parent `58b7c9399`. A [second official ruler](landing-ruler.json) on the later declared-proof
ruler parent confirms +120 platform lines and zero shard delta. The final
hook and landing composition retain later main changes.

Source-only G490: no map bake. Earlier strict all-ten commands on the
historical pin built ten products and refused its existing DW/Pine map
stamps; those receipts stay explicit. The canonical integrated check above
is strict-green with zero stale warnings. Generated outputs and raw profiles are not committed here.
