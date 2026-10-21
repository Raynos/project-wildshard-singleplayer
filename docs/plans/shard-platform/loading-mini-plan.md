# Loading and download screen: mini plan (G543)

Jake, 2026-10-20 (G537, G543): *"if it says 12, but it downs 145, it has to be fixed. You have to fix all download counter
stuff. You have to fix the loading stuff. And then you have to optimize it. First let's have the loading be accurate. And
then let's optimize it later … one of the lanes that the builder has can be spent on this whole mini plan, just
continuously working on the loading screen until it's fixed."*

Audit: [Loading Screen Audit](https://claude.ai/artifact/5muMsLzQ8dBoAiuJs2oYoH) (live 97915af6c). One builder lane owns
this plan end to end and stays on it until every row is done; it is an M2 gate (G537): Jake's three phone
playtests wait for Phase 1 acceptance. The lane tests the real 5 x 5 on Chromium and Simulator now (coordinator clarification).

**Owner:** dedicated loading lane (`sp-x1`), 2026-10-20. L1 source landing first; each row stays open until its exact-build proof passes. STATE.md remains coordinator-owned.

## Phase 1: accurate (nothing hidden, every number true)

| Row | What | Code (from the audit) | Effort (est.) |
|---|---|---|---|
| **L1 — accepted `8264f6dca2`; source `0e5a42feb3`; pushed** | Step number and name always match; time between steps becomes an explicit row ("gap after X · 75.7 s") so no second is unaccounted | `Loading.ts:174`, `:206`; `boot/plan.ts:232`, `:274` | 0.5 day |
| **L2 — cold accepted and pushed `8264f6dca2`; warm revalidation `bf332be4cc` proof pending** | **The download counter counts every byte**: shardfile file reads, grid neighbour products, everything fetched; cache hits shown separately ("from cache"); totals from each product index's sizes; never 100 % while files remain | `boot/steps.ts`, `session/data.ts:41`, `shardfile/product.ts`, `grid/products.ts` | 1 day |
| **L3 — accepted `8264f6dca2`; source `583123db2a`; pushed** | A `waitFor(label, promise)` registry at admission, file reads, Wasm, workers and shader linking; a live "Now waiting for: …" line with its age and files in flight | new in `engine/boot`; call sites per the audit | 0.5–1 day |
| **L4 — accepted `8264f6dca2`; source `c54a3c5c54`; pushed** | A step table per load path (shardfile, grid entry, grid crossing; legacy comparison retained) replacing the fixed 16-row legacy table; page-shell rows dropped; every unreported await moved into a step | `session/loadout.ts:63-134`, `session/play.ts:99-121`, `session/finish.ts:26-55`, `grid/liveSession.ts:533-556` | 1–2 days |
| **L5 — accepted `8264f6dca2`; source `91a491c8a8 / 390a57867c`; pushed** | Numbers inside every long step that move at least once a second: admission files N/M, world scenes N/M, home region scenes/models N/M, shaders built/linked N/M, textures N/M, first frame pass N/5 | `shardfile/product.ts:240`, `grid/products.ts:52`, `game/shardfile/worldScenes.ts`, `driftwood-isle/world/build.ts:85`, shader precompile | 1 day |
| **L6 — accepted `8264f6dca2`; source `977a0d1303`; pushed** | Stall text in amber after 10 s with no progress, naming the open wait; "Last reload" and "Longest page pause" removed or relabelled; Physics/Trees rows report the real region, not the empty shell | `Loading.ts:211-244`, `boot/lastEnd.ts`, `engine/core/bootstrap.ts:95`, `:106`, `play.ts:168` | 0.5 day |
| **L7 — accepted `8264f6dca2`; source `8dd0eeaa0e / 09bdb72199`; pushed** | A realistic bar: per-path stage weights from a committed table measured on the iOS Simulator at phone tier, blended with the device's own runs (keyed by tier, path, shard); a running step without counts eases toward its share (1 − e^(−t/T)); no 99.5 % freeze; admission weighted by time | `boot/timing.ts:17-21`, `boot/plan.ts:216`, `Loading.ts:115-185` | 1 day + a Simulator session |
| **L8 — cold matrix accepted and pushed `8264f6dca2`; added warm proof pending** | Acceptance: on both SHARD SELECT and the grid path, stage rows add up to the wall time within 3 s; the detailed text changes at least once a second; the byte counter matches network bytes within 5 %; measured in the Simulator and Chromium; a test fails if any unlabelled gap exceeds 2 s | test + a capture for Jake | 0.5 day |

## Phase 2: fast (after Phase 1 is accepted)

| Row | What | Code | Effort (est.) |
|---|---|---|---|
| **O1 — done `02fb4e4288`, `8f220455e8`, `94bf308bc1`** | Grid edges read from each neighbour's product index only, not the whole product (today 3,237 requests, 137.5 MB, 75.7 s) | `grid/edgeSources.ts:73-86`, `grid/products.ts:42-60`, `grid/session.ts:305-322` | 0.5 day |
| **O2 — source `c6324ac9ca`, `3ed2458d4a`, `3150c243ab`, `bf332be4cc`, `4a2bed9f6f`; native warm bytes pending** | Content cache: the worker stops giving up at 64 pending; batched index writes; running byte and entry totals instead of rescans and sorts per write | `boot/contentCacheWorker.ts:109`, `boot/contentCache.ts:100-178` | 1 day |
| **O3 — accepted `32cde80543`; receipts `fd69ae2b29`; carrier pending** | Home region reads files in parallel / prefetched from the product's file list (the old one-request finding is closed) | `game/shardfile/worldScenes.ts` (~lines 88, 118, 146, 170, 178, 244), `grid/liveSession.ts:533-556` | 1 day |
| **O4 — source `0f63b7b167`, API `4c025e81bd`; batch green `68aa1e372c`; served proof pending** | Shardfile admission without waves of 4 that wait for the slowest file | `shardfile/product.ts:259` | 0.5 day |
| **O5 — pulled forward: `b2e4c86d92`; desktop AO repair `32cde80543` first frames green; native warm/full acceptance pending** | Shader cost on shardfile/grid (~10 s main-thread vs ~1 s legacy): source-mapped profile, then fix (likely the node-material graph builder) | profile first | investigate |
| **O6** | Close the shardfile-vs-legacy gap for Driftwood (3.6x slower, 3x the bytes) | after O1–O5; frozen legacy comparison only (G498/G531), outside the Phase 1 gate | investigate |

Target after Phase 2: the grid Driftwood load at or under about 20 s at 4x CPU in Chromium, measured again in the Simulator.

Current calibration is committed in `progress/loading/g543/calibration-47f83b6/`
(`8dd0eeaa0e`): Simulator shardfile 14.4 s, grid 14.9 s, legacy 17.3 s.
Legacy remains an O6 comparison baseline: its 1.274 s audio and 1.193 s Props
gaps and 27.44% old byte error are recorded, not Phase 1 gate failures. G498
keeps its internals sealed. The required entries are shardfile and grid; crossing
keeps its unobstructed view and separate phase table.

Earlier Simulator calibration is committed in
`progress/loading/g543/calibration-8042d30/`: SHARD SELECT 17.8 / 20.1 s,
grid 44.9 s; stage sums differ by less than 0.1 s. These are explicitly
calibration-only receipts: byte accounting misses SW background transfers
(6.5–6.7%) and grid detail cadence reaches 1.83 s on that old build.
`3d5f984897` adds worker transport receipts, `0153521910` fixes decimal MB,
`19c10b2c0c` slices shader jobs and `ccecd7678f` slices plot ground preparation.
L8 remains open for the served committed build to pass all surfaces.

The L1 receipt at `0e5a42feb3` stalled in Props for 240 s (no first frame).
Rows account for 238.1 / 239.9 s. It did not recur at `e1799246dd`:
SHARD SELECT first frame 33.5 s and grid 32.8 s. Stage sums are 33.769 /
32.824 s; observed HTTP byte errors 1.46% / 4.07%. Cadence remains open
(1.69 / 1.24 s), with shader/first-frame and assembly gaps retained in
`tmp/loading-lane/current-chromium/` until final evidence is committed.

The `7a8d7ab209` candidate reached first frame in Simulator SHARD SELECT
in 19.4 s (stage sum 19.440 s, network error 4.33%, detail gap 973 ms).
Its worker observer delivered 173 batches on Safari. The second Safari
path lost its recorder; harness `ec56ae5f4d` gives each path a fresh origin.
A new profile reproduced the phone grid gap at 1.376 s and mapped 403 ms
to duplicate `plotCellColliders` generation in `GridSession.attach`.
`e0b3064e09` reuses the already sliced meshes and yields completed assembly.
Desktop profiles had 198 / 454 ms detail gaps; the earlier 4.35 / 2.33 s
first-frame pauses did not recur. All remain diagnostic receipts: final
acceptance must include the newer worker accounting and collider reuse.

The `47f83b6aca` six-case proof is retained in
[`diagnostic-47f83b6`](../../../progress/loading/g543/diagnostic-47f83b6/README.md)
(`98b14708b3`): five entries pass, phone grid fails cadence at 1073.3 ms;
every byte error is within 5% and every stage sum balances. Schema checks
now yield between completed validations. Batch `0c1f42bb2f` passed types,
lint and 1246 tests but failed Nalati's inventory fixture; `9e2f4db11c`
repairs its generator input. The replacement batch passed on `90efdf502c`
(1101.8 s). Its queued browser build was superseded before execution by the
named-cache fix `0912242443`: a fully offline descriptor had falsely kept
18,105 fixture bytes pending. The regression failed first, then all 20
descriptor/download/residency tests and strict lint passed. Final source
batch `0912242443` passed in 940.4 s. Its first preview built successfully
but lost port 4400 during startup (coordinator-routed X15); no browser cases
ran. The replacement fast-path preview uses explicit port 4443 on the same
SHA. Phase 1 remains open for six entries and three real crossing receipts.

The six valid `0912242443` entry receipts pass, and native/desktop real
crossings pass. They remain diagnostic because a later phone grid entry
has a 1117.9 ms detail gap, its focused profile has 1049.2 ms, and the old
phone driver did not return from the road. The retained evidence is in
[`diagnostic-0912242`](../../../progress/loading/g543/diagnostic-0912242/README.md).
`5d61c19194` reverses the input driver on the actual road transfer instead
of requiring one exact coordinate. The profile maps 443 ms to unchanged
schema validation plus cache-index and other queued work; factoring
`9d40530bad` was already present. `fb4b943579` shares schema checks across
products with a paint before each validator; `4313fc6482` coalesces index
metadata in the existing flush window, preserving durable blob writes.
All 23 focused descriptor/cache/residency/download tests and strict lint
pass. Source batch `4313fc6482` passed in 786.1 s. Its served proof uses
recorder v2 (`6324155e85`): wait ages cannot count as progress, while real
byte/cache counters, dependencies and completed units do. The serialized
recorder check and strict lint pass. Phase 1 remains open for those receipts.

The `4313fc6482` receipts are retained in
[`diagnostic-4313fc6`](../../../progress/loading/g543/diagnostic-4313fc6/README.md):
all six entries balance their stages and bytes; five pass cadence, while phone
grid reaches 1070.8 ms. All three surfaces pass the actual road exit and home
re-entry, with the five crossing phases summing exactly to transition time.
The phone profile attributes 370 ms of the remaining gap to the unchanged
validator, followed by consumer work. `91a491c8a8` restores a paint after each
completed validation as well as before it; `390a57867c` shows completed counts
from parallel stages without charging their overlapping time twice. All 23
focused tests and strict lint pass. The source batch at `390a57867c` stopped
before loading checks because generation omitted its new snapshot helper.
`c6a7a68b9d` repairs that staging inventory. The `6b3f3f58ec` batch passed
types, lint and 769 tests, then refused its real first frame because the
deck placement referenced a model outside its site catalogue. `6e92de3486`
restores the deck and trail's direct placements. The next batch was stopped
after 26 s when the coordinator reported a separate frozen-legacy type red;
`801a9a6850` restores those frozen types. Its source batch passed in 623.1 s.

All six entry accuracy cases now pass at `801a9a6850`; their four viewed
portrait frames and compact receipts are committed in
[`diagnostic-801a9a6`](../../../progress/loading/g543/diagnostic-801a9a6/README.md)
(`abb4275bf0`). Byte errors are at most 0.37%; all stage sums balance.
Phone detail gaps are 556.7 / 651.0 ms, native 250 / 360 ms, desktop
158.1 / 190.4 ms. Native and desktop crossings both return. Phone returns
stop at z -256.649 on foot and in normal hover (`0ed2dba967`); X17 is
assigned to this lane and blocks the remaining gate. The registered
readiness wall's width, capsule radius and controller skin stop feet
6.65 m outside the cell, before its unchanged <=6 m entry trigger.
Eight native regressions reproduce that original stop on all four mouths
in walking and hover modes. The collider-data fix and physical proofs
follow separately. Phase 1 stays open; O2 has only unapplied scratch work.

X17 data fix `e77e887075` moves only the registered readiness-wall centres
one metre inward. The unchanged transfer fence still holds outside the
cell; all three readiness parts and a real motor reframe remain required.
All eight native mouth/mode cases now pass, along with four crossing and
admission checks (12 tests total) and strict lint. One exact-SHA source
batch, the six entries/three crossings and the required grid physics walk
were queued on that fix. The sp-x6 B6 quiet window released both surfaces
before its checks resumed. The source batch passed types, lint and 750
tests, including the fence regressions, but stopped on two Pine native
quest witness mismatches. Its dependent preview and physical proofs did
not run. Coordinator-confirmed repair `5e7c50bd89` is in newer HEAD; one
replacement batch passed at `e245b2d5a7` in 792.1 s after its consolidated
compatibility verdict. No Phase 1 acceptance is claimed yet.

The `e245b2d5a7` diagnostic is committed in
[`diagnostic-e245b2d`](../../../progress/loading/g543/diagnostic-e245b2d/README.md)
(`911cca6b3e`): all six entry accuracy cases pass, and the required phone
CPU 4x grid physics walk passes all eight routes with zero stuck and zero
page errors. Native/desktop crossings return, with 28.1 / 9.6 s in home
preparation. Phone return now reaches the independent transfer fence at
z -255.985 and requests home, so the collider gap is fixed; preparation
remains pending past 120 s amid 4,921 observed requests, mostly for other
products. The failed return remains visible beside four viewed portraits.

`b284b0cc61` gives actual regional world construction priority over
speculative product network/cache reads at their next IO boundary. Older
serialized world construction can drain; shared holds are reference counted,
and disposal rejects unstarted reads. No validator/parser/worker slot is held
while waiting and no cap changes. Strict lint, 16 focused tests and all ten
native admission outcomes pass with no leaked claims. Read-only final-state
diagnostics `47ff229154` and API notes `4d715a664f` follow it. One source batch
at `4d715a664f` passed types, lint and 751 tests including priority, but stopped
on a separate platform-chargeback assertion: Pine was counted as an
`ArenaBossScript` user alongside Nalati. The coordinator routed that repair
to sp-x9; no preview or physical cases ran on this pin. One replacement batch
follows the repair and CPU quiet release. Phase 1 stays open for the phone
return; O2 remains unapplied scratch work.

The repaired source batch at `6c1495e588` passed in 367.5 s. Its receipts
are retained in [`diagnostic-6c1495e`](../../../progress/loading/g543/diagnostic-6c1495e/README.md)
(`ec1b514938`): all three real crossings now return, including phone home
preparation in 52.483 s. The eight-route CPU 4x grid physics walk has zero
stuck results and zero page errors. All bytes are within 5% and all stages
balance. Five entry cadence cases pass; native SHARD SELECT has a 1,486 ms
Pass 0 to Pass 1 gap, so Phase 1 remains open. A separate GL-call/Timeline
diagnostic tests the coordinator's shader-link poll suspect. Owner fix
`2f9eb0dc08` restores loading-time polling; the affected proof uses a newer
served build. O2 remains unapplied scratch work until this gate passes.

Phase 1 acceptance is green at served committed `8264f6dca2`; compact
receipts and four viewed, labelled portrait frames landed in `83deb8e562`:
[acceptance receipt](../../../progress/loading/g543/acceptance-8264f6d/README.md).
All six entries pass (phone 21.0 / 22.4 s, native 13.4 / 14.8 s, desktop
9.4 / 9.0 s); every stage sum is within 0.08 s, byte error is at most
1.43%, and the maximum phone detail gap is 416.3 ms. All three real road
returns pass, including phone home preparation in 33.595 s. The retained
physics walk and all-four-mouth walking/hover regressions are green;
the walk keeps its true earlier SHA and unchanged-collider evidence.
The 250 ms poll did not explain the old standalone gap: the same old build
showed 8 ms shader polls, zero first-frame polls and a 165 ms first frame.
That diagnostic remains separate from this valid acceptance. Carrier push
is pending for the new rendering fix; O2 now proceeds from the green gate.

O2 source landed: `c6324ac9ca` queues excess validated cache commands behind
the unchanged 64 posted slots, retaining request/idle/lifetime/close deadlines
and FIFO checked fallback. `3ed2458d4a` maintains running byte/entry totals
and LRU order after one recovery sort; quotas, pins and integrity stay intact.
API notes are `3150c243ab`. Eighteen focused cache/worker/residency tests and
strict lint pass. One combined source batch is pinned to `bf332be4cc`.

The added same-origin warm baseline exposed a real L2 follow-up, retained
in [`cache-baseline-8264f6d`](../../../progress/loading/g543/cache-baseline-8264f6d/README.md)
(`6f1e827c6f`): two full unchanged service-worker script checks transfer
about 41 KB that page resource timing cannot observe. Warm shardfile/grid
byte parity fails 23.46% / 10.50%; stage sums and cadence pass. These bytes
remain in the independent network denominator. Coordinator-approved
`bf332be4cc` changes only the worker HTTP policy to `no-cache`, so every
update still revalidates its ETag. A real preview HTTP test proves an
unchanged 304/no body and a changed 200/full new body; strict lint passes.
The served cold/warm proof closes that added L2/L8 follow-up before O2
sign-off. Revisit harnesses `7886446dc2` / `bb9374ade6` preserve each real
origin/context and record HTTP response status without changing the app.

The O2 replacement source batch at `bd459dadaf` passed (368.4 s inner).
Its eight outcomes and a separate native GL diagnostic are retained in
[`diagnostic-bd459da`](../../../progress/loading/g543/diagnostic-bd459da/README.md)
(`49c39e9232`). All four phone cold/warm cases pass, including actual
unchanged-worker 304 responses and warm byte errors 3.99% / 0.97%.
Native cold grid passes; native cold SHARD SELECT has a 1,149 ms link
completion gap and a 1,916 ms post-chain first draw, with 120 programs
before and after. The separate fresh-origin GL diagnostic did not reproduce
that stall (400 ms maximum gap); it does not establish a particular slow pass.
Both native warm captures are invalid: controlled fixture/JSON navigation
replaced the cached app shell, returning the entry to title. Harness fixes
`7fc9a635db` / `df0f9ede29` inspect and reload the real title, applying save
fixtures through Inspector while retaining the same origin and real caches.

Coordinator-assigned O5 is pulled forward to unblock that proof. Initial
loading now issues post links before world/shadow jobs and draws one linked
post material per painted task under Shaders (`b2e4c86d92`). Internal pass
targets are borrowed, full-sized and restored; simulation/effect clocks do
not advance. Live entered-world preparation is unchanged. Twenty-two focused
shader/post tests and strict lint pass; the immediate test-only type repair
`2d603918ea` also passes root tsc. API notes are `072e36da10`. One new source
batch and served cold/warm proof cover the pending cuts. O2 and the added
warm L2/L8 follow-up remain open; the earlier cold acceptance stays retained.

The `49c39e9232` shader batch passed in 833.2 s, but its phone-tier first
frames missed a desktop regression: optional post stand-in draws reached
N8AO before its real pass had bound sample arrays (`toArray` failure).
`32cde80543` leaves those programs linked and defers only unsafe optional
draws to their real pass; no samples are fabricated and AO stays enabled.
The actual N8AO regression, six post tests and strict lint pass; root tsc
also passes. A real desktop grid entry on committed `32cde80543` proves AO
present/enabled with first frame in 11.4 s and a 174.1 ms detail gap. Phone
SHARD SELECT passes in 26.6 s with a 352.7 ms gap. Both byte errors are
under 0.05%. The viewed phone portrait and compact receipts are committed
in [`post-ao-fix-32cde80`](../../../progress/loading/g543/post-ao-fix-32cde80/README.md)
(`1e53d45c22`). The old queued matrix was cancelled before launch when
this regression was confirmed. The repair's one exact-SHA source batch
passed in 345.4 s; the corrected native cold/warm matrix still owns O2
and warm L2/L8 closure.

Carrier verification: `origin/main` at `62556d91e3` includes the accepted
`8264f6dca2` cold build, its receipt/plan and O2 source through `bf332be4cc`.
The Phase 1 cold rows above are pushed; their old pending-push notes were
historical. The newer post warm-up and `32cde80543` repair are still carrier
pending. Native warm acceptance and the remaining optimization rows stay open.

O6 inspection distinguishes production encoding from local preview bytes.
The three largest live Driftwood GLBs return HTTP 200 with Brotli; the
14.61 MB hibiscus GLB transfers a 3.96 MB encoded body. The local preview
serves those GLBs without that encoding, and its retained network counters
remain accurate for that server. Raw meshopt savings alone therefore do
not justify replacing the SDK's existing compressed-size selection. A
like-for-like Brotli comparison follows before any payload change; no
compression, content, tier, admission or cap policy has changed here.

O4 source `0f63b7b167` refills each of the same four immutable transport
slots immediately after verification. A refusal stops new launches and
drains every started read before authored-order refusal or publication.
Reservation, byte/hash checks and the one page-wide GLTF parser are
unchanged. The held-oldest regression fails on the old waves and passes
on the new window; strict lint and 40 product/descriptor/residency tests
pass. API notes are `4c025e81bd`. Its next batch and served proof remain
separate from the in-flight exact-`32cde80543` cache acceptance matrix.

That matrix completed: all six cold entries, both phone warm entries and
all five real returns pass. Native warm entries reach first frame with
417 / 610 ms detail gaps but fail byte parity (45.69% / 21.88%). WebKit
refetches an unchanged 20,449-byte worker script; its many 304 metadata
responses also expose Resource Timing's fixed 300-byte header estimate.
The actual observed wire remains the only denominator. The coordinator
directed worker revalidation plus fewer hash-verified metadata requests,
not a new body-only metric or guessed byte credit.

`4a2bed9f6f` reuses URL-cached first-party indexes only when their hash
belongs to this bundled build, and cached sections only under the index's
size/hash checks. Stale or oversized hints fall through to transport;
identity and complete admission checks remain. Forty-seven focused tests
and strict lint pass. The minimal native worker-mode probe follows under
sim-lane before the next combined batch and cold/warm proof. O4's separate
source batch at `68aa1e372c` passed in 473.6 s; its queued preview did not
replace the retained diagnostic after the native warm failure.

O3's cold-entry evidence is retained in
[`parallel-reads-32cde80`](../../../progress/loading/g543/parallel-reads-32cde80/README.md)
(`fd69ae2b29`): all four observed paths have 238 GLB reads with peak overlap
four. Indexed prefetch already fulfills this row; the page-wide parser
stays one. The separate source-mapped profile (`a33c82a6c2`) retains
6.446 / 3.742 s of nested node-builder CPU on phone SHARD SELECT/grid.
O5's remaining CPU cost stays open with sp-o2's light/key work; the
post-warm first-frame cadence passes on the measured native cold/warm paths.

The native worker probe is decisive under the unchanged `no-cache` header:
default `imports` sends no ETag and returns 200/full for unchanged bytes;
`all` returns 304/no body both before and after Safari restart. A changed
body still returns 200 in full. `8e3d697c79` selects `all`; strict lint and
the real preview policy test pass. The 47-test metadata fix is
`4a2bed9f6f` (API `1928f28637`). One next source batch covers these pending
cuts; its new served cold/warm matrix keeps the actual wire denominator.

The complete diagnostic and four viewed portraits are retained in
[`diagnostic-32cde80`](../../../progress/loading/g543/diagnostic-32cde80/README.md)
(`f9d4b1b80e`). The standalone native HTTP comparison is
[`worker-cache-native-20261021`](../../../progress/loading/g543/worker-cache-native-20261021/README.md)
(`cd1c3e49c6`). The separate
[`wire encoding inspection`](../../../progress/loading/g543/wire-encoding-32cde80/README.md)
(`0acfe51797`) shows all three raw-size meshopt candidates grow under
Brotli; the existing selection stays intact and O6 remains open.
