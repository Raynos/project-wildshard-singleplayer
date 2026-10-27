# Loading and download screen: mini plan (G543)

Jake, 2026-10-20 (G537, G543): *"if it says 12, but it downs 145, it has to be fixed. You have to fix all download counter
stuff. You have to fix the loading stuff. And then you have to optimize it. First let's have the loading be accurate. And
then let's optimize it later … one of the lanes that the builder has can be spent on this whole mini plan, just
continuously working on the loading screen until it's fixed."*

Audit: [Loading Screen Audit](https://claude.ai/artifact/5muMsLzQ8dBoAiuJs2oYoH) (live 97915af6c). One builder lane owns
this plan end to end and stays on it until every row is done; it is an M2 gate (G537): Jake's three phone
playtests wait for Phase 1 acceptance. The lane tests the real 5 x 5 on Chromium and Simulator now (coordinator clarification).

**Owner:** `sp-x6`, 2026-10-24, continuing at L9 under G683 after sp-x1 released the loading paths. Earlier source/proof receipts remain attributed to sp-x1. Each row stays open until its exact-build proof passes. STATE.md remains coordinator-owned.

## Phase 1: accurate (nothing hidden, every number true)

| Row | What | Code (from the audit) | Effort (est.) |
|---|---|---|---|
| **L1 — accepted `8264f6dca2`; source `0e5a42feb3`; pushed** | Step number and name always match; time between steps becomes an explicit row ("gap after X · 75.7 s") so no second is unaccounted | `Loading.ts:174`, `:206`; `boot/plan.ts:232`, `:274` | 0.5 day |
| **L2 — cold accepted and pushed `8264f6dca2`; Safari warm accepted `de6833b8b7`; Chromium eviction residual in `9fd203d409`; reopened 2026-10-23 as L9/L10 (frame audit below)** | **The download counter counts every byte**: shardfile file reads, grid neighbour products, everything fetched; cache hits shown separately ("from cache"); totals from each product index's sizes; never 100 % while files remain | `boot/steps.ts`, `session/data.ts:41`, `shardfile/product.ts`, `grid/products.ts` | 1 day |
| **L3 — accepted `8264f6dca2`; source `583123db2a`; pushed** | A `waitFor(label, promise)` registry at admission, file reads, Wasm, workers and shader linking; a live "Now waiting for: …" line with its age and files in flight | new in `engine/boot`; call sites per the audit | 0.5–1 day |
| **L4 — accepted `8264f6dca2`; source `c54a3c5c54`; pushed** | A step table per load path (shardfile, grid entry, grid crossing; legacy comparison retained) replacing the fixed 16-row legacy table; page-shell rows dropped; every unreported await moved into a step | `session/loadout.ts:63-134`, `session/play.ts:99-121`, `session/finish.ts:26-55`, `grid/liveSession.ts:533-556` | 1–2 days |
| **L5 — accepted `8264f6dca2`; source `91a491c8a8 / 390a57867c`; pushed** | Numbers inside every long step that move at least once a second: admission files N/M, world scenes N/M, home region scenes/models N/M, shaders built/linked N/M, textures N/M, first frame pass N/5 | `shardfile/product.ts:240`, `grid/products.ts:52`, `game/shardfile/worldScenes.ts`, `driftwood-isle/world/build.ts:85`, shader precompile | 1 day |
| **L6 — accepted `8264f6dca2`; source `977a0d1303`; pushed** | Stall text in amber after 10 s with no progress, naming the open wait; "Last reload" and "Longest page pause" removed or relabelled; Physics/Trees rows report the real region, not the empty shell | `Loading.ts:211-244`, `boot/lastEnd.ts`, `engine/core/bootstrap.ts:95`, `:106`, `play.ts:168` | 0.5 day |
| **L7 — accepted `8264f6dca2`; source `8dd0eeaa0e / 09bdb72199`; pushed; reopened 2026-10-23 as L12 (frame audit below)** | A realistic bar: per-path stage weights from a committed table measured on the iOS Simulator at phone tier, blended with the device's own runs (keyed by tier, path, shard); a running step without counts eases toward its share (1 − e^(−t/T)); no 99.5 % freeze; admission weighted by time | `boot/timing.ts:17-21`, `boot/plan.ts:216`, `Loading.ts:115-185` | 1 day + a Simulator session |
| **L8 — cold matrix accepted and pushed `8264f6dca2`; Safari warm accepted; Chromium residual retained `9fd203d409`** | Acceptance: on both SHARD SELECT and the grid path, stage rows add up to the wall time within 3 s; the detailed text changes at least once a second; the byte counter matches network bytes within 5 %; measured in the Simulator and Chromium; a test fails if any unlabelled gap exceeds 2 s | test + a capture for Jake | 0.5 day |

## G554 follow-up: reopened accuracy

The earlier L1/L2/L8 receipts remain historical acceptances. G554 reopened
those rows for the current loading and mid-play cell paths.

| Row | State | Remaining proof |
|---|---|---|
| Counts and actual step (sp-x1) | Source landed: `64465aec04`, `a2c2cd7474`, `52cdb2c0e4`, `71e2129ece`, `5c3c41091a`. Scoped panels observe page activity without replacing boot accounting and show their actual running step. Wire traffic, cache reads, pending declarations and discovered disk-prefetch progress have separate labels. Missing wire measurements stay explicit and refuse byte acceptance. Download cannot claim 100% while discovered prefetch work remains. Focused checks pass. Source batch `71e2129ece` passes in 1220.3 s; final completion/type/latch delta `c5534eae4d` passes in 418.3 s after the generation repair. | Exact `71e2129ece` Chromium cold grid passes: phone 18.6 s, 471.2 ms maximum detail gap, 0.047% byte error; desktop 8.3 s, 181.1 ms, 0.263%. Real waiting-cell entries pass on both surfaces with controlled destination-network delay: scoped footer names its own step, page traffic is labelled, disk/known-so-far counts stay separate. Offline warm releases HUD/controls with actual zero wire bytes and 453.1/199.5 ms detail gaps; missing worker transfer sizes remain explicitly unavailable (167/193 requests), so byte acceptance is refused rather than invented. Native request S7 remains queued with sp-o5 and gates no M2 work. Warm wire acceptance stays open pending that verdict. |
| Whole known set (sp-o5) | Source `38163f5006`; neighbours first, disk-only verified cache writes, origin persistence/quota guard and quiet quota stop. The loading snapshot port is `52cdb2c0e4`; its known set is labelled “known so far”. | sp-o5 owns the prefetch and quota verdict. |
| Arrival release (sp-x1) | Fixed `2a1f3c89d3`: skip, wall-time release ceiling and background/menu cleanup release HUD and controls. Phone/desktop offline-warm and native S5 pass. | sp-o5 owns the separate `ringsReady` readiness defect; the ceiling remains a safety net. |

## Phase 2: fast (after Phase 1 is accepted)

| Row | What | Code | Effort (est.) |
|---|---|---|---|
| **O1 — done `02fb4e4288`, `8f220455e8`, `94bf308bc1`** | Grid edges read from each neighbour's product index only, not the whole product (today 3,237 requests, 137.5 MB, 75.7 s) | `grid/edgeSources.ts:73-86`, `grid/products.ts:42-60`, `grid/session.ts:305-322` | 0.5 day |
| **O2 — accepted `de6833b8b7`; receipts `9fd203d409`; Chromium cache-pressure residual documented; pushed** | Content cache: the worker stops giving up at 64 pending; batched index writes; running byte and entry totals instead of rescans and sorts per write | `boot/contentCacheWorker.ts:109`, `boot/contentCache.ts:100-178` | 1 day |
| **O3 — done; accepted `32cde80543`, receipts `fd69ae2b29`, pushed** | Home region reads files in parallel / prefetched from the product's file list (the old one-request finding is closed) | `game/shardfile/worldScenes.ts` (~lines 88, 118, 146, 170, 178, 244), `grid/liveSession.ts:533-556` | 1 day |
| **O4 — accepted `de6833b8b7`; source `0f63b7b167`; receipts `9fd203d409`; Chromium cache-pressure residual documented; pushed** | Shardfile admission without waves of 4 that wait for the slowest file | `shardfile/product.ts:259` | 0.5 day |
| **O5 — accepted `61e45099ae`; receipts `7e37b39b44`; source, receipts and tick pushed** | Shader cost on shardfile/grid (~10 s main-thread vs ~1 s legacy): source-mapped profile, then fix (likely the node-material graph builder) | profile first | investigate |
| **O6 — accepted `f8f5ee9a9d`; ordinary native receipt `28302b9183`; 20.7 s approximate target accepted; pushed** | Close the shardfile-vs-legacy gap for Driftwood (3.6x slower, 3x the bytes); retire 34,444,304 bytes of duplicate foliage transport | after O1–O5; frozen legacy comparison only (G498/G531), outside the Phase 1 gate | investigate |

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

The combined source batch at `3c696e1134` passed in 814.6 s after the Pine
config repair. Its ten entries all reach first frame and five real returns
pass; six entries pass all accuracy checks. The retained diagnostic has
three warm byte failures (both native paths and phone grid) plus a native
cold grid title-art gap of 1,002 ms. Metadata revalidations are eliminated,
but Origin-dependent worker checks and lost background-document timing
remain visible. No request or failure is excluded from the wire denominator.

`c8dcbc0b23` makes preview `/sw.js` invariant to Origin, matching production
(checked: no Origin variation, strong ETag, but live old `cdff44f21` still
has `no-store`). The unchanged response is 304 and a same-length changed
script is 200/full in the real preview regression. `41c2e21e54` clears a
full worker timing buffer at its existing capacity: the 320-request replay
regression fails before the fix, then recovers the latest response with
78 entries retained. `0c78b3da6a` names artwork queue/read/decode and lazy UI
awaits; no counter advances on a timer and wait ages do not count as work.
Strict lint passes. One combined source batch and exact-build cold/warm
matrix cover these cuts; warm L2/L8 and O2/O4 remain open until that proof.
Production `no-cache` plus ETag is checked again after the carrying release.

The exact `e8c4dba97e` matrix is retained in
[`diagnostic-e8c4dba`](../../../progress/loading/g543/diagnostic-e8c4dba/README.md).
Eight entries pass, all five real road exits/home returns pass, and every
entry passes stage accounting and detail cadence. Native cold shardfile/grid
are 14.3/10.6 s; warm 8.8/10.7 s. CPU-4x phone cold shardfile/grid are
24.1/29.2 s; warm 24.4/23.6 s. The ~20 s phone grid target remains open.
The original source batch passed types, strict lint and 762 tests; a foreign
preview shell syntax error stopped only its browser stage. After its owner
withdrew the edit, both official Driftwood/Pine first frames passed on this
same SHA (`loading-worker-handoff-resumed-boot-78213`); green source checks
were reused rather than repeated.

Two warm-grid byte residuals remain explicit. Native displays 28,992 against
26,728 actual wire bytes (+8.47%): seventeen GLB 304s contribute 1,989 bytes
of excess because Resource Timing reports 300 header bytes against 183 on
the wire. HTML/manifest/telemetry/version differences contribute the other
275 bytes. `de51698358` extends the existing bounded, hash-verified URL-cache
fallback to admission blobs and released-library rereads, removing avoidable
revalidations while preserving exact size/hash checks. Its new regression
failed before the change; strict lint and all 31 loader/residency tests pass.
Phone warm grid displays 57,302 against 78,045 actual: an automatic browser
worker-script check sends no validators, receives 20,539 gzip bytes plus
292 response-header bytes, then the explicit update returns 304. That
browser-owned download is absent from page/worker Resource Timing. The
Origin split is gone. Its exact residual is with the coordinator; there is
no body-only denominator, guessed header credit or excluded request.

O6's same-build frozen comparison is retained in
[`legacy-comparison-3c696e1`](../../../progress/loading/g543/legacy-comparison-3c696e1/README.md).
Cold phone legacy/shardfile/grid are 10.8/22.3/21.9 s with 21.80/175.50/170.88
MB actual wire. These sequential shared-machine measurements are not an
isolated A/B speedup claim. Legacy gaps remain outside the gate. Source
`48d648401a` stops publishing four retired palm/hibiscus binaries and their
eight URL/draw aliases: 32,463,904 raw product bytes duplicate the finished
foliage GLBs. GLBs, bake inputs and collider producers stay unchanged; the
new alias/model-path check and strict lint pass. The existing exact collider
parity fixture had a shared-tree baseline red before this cut (clean e8
source checks passed). One combined clean batch on a head carrying both
`48d648401a` and `de51698358` regenerates it and proves the source before
served phone/native measurements; no fixture expectation is weakened.

The combined clean `ff62a72304` batch passed in 326.8 s. Its full matrix
passes eight entries and all five real return routes. Native warm grid now
has no seventeen-GLB revalidation burst: 23,892 displayed / 23,617 actual
bytes (1.16% error), with a 776 ms detail gap. Cold phone shardfile/grid
wire totals are 143.85/143.37 MB; wall times are 30.1/26.7 s under shared
machine load. The ~20 s CPU-4x grid target remains open. Phone warm grid
still misses the full browser-owned worker-script check. Native warm
shardfile records three HTML responses but only two worker timing entries;
its separate no-Inspector-events diagnostic passes at 1.16% byte error.
A late Inspector command/control experiment did not confirm causality.
`7ce5ce17c9` retains safe request destination/Accept fields and a separate
late worker-buffer replay on byte failure; recorded counters and gates
remain unchanged, with the normal Inspector behavior still the default.

The coordinator chose a tiny revalidated worker bootstrap with an immutable
content-hashed import. `63dc1e12b4` emits a 95-byte `/sw.js`, importing
`/sw-core/<SHA-256>.js`; only that exact core path gets the one-year immutable
HTTP policy. Registration retains `updateViaCache: all`. The maintained
native regression `8c1c7c4fcc` proves unchanged imports stay cached across
restart and a same-length changed core reaches the controlled client.
Preview header/ETag tests and strict lint pass. Evidence is retained in
[`worker-bootstrap-63dc1e1`](../../../progress/loading/g543/worker-bootstrap-63dc1e1/README.md)
(`de6833b8b7`); full game accuracy remains a separate proof. `be7b843f6e`
also retires the unused 1,980,400-byte reef world binary, whose native
channels are already in the finished GLB; only custom aliases referenced
the old product transport. The original bake input stays. One combined
batch and served matrix cover these pending cuts without repeating the
already-green `ff62a72304` check.

The ten `ff62a72304` entry receipts, five successful returns and four
viewed portrait frames are retained in
[`diagnostic-ff62a72`](../../../progress/loading/g543/diagnostic-ff62a72/README.md)
(`46cfc3958a`). The combined bootstrap/reef source batch at `de6833b8b7`
passed in 793.2 s; its served cold/warm matrix remains the added warm
L2/L8 and O2/O4 gate. Independent panel cut `52860bd662` reuses unchanged
row paints at the existing cadence after the retained phone profile
charged about 0.5 s to panel painting. Strict lint passes; its performance
effect remains unmeasured. The ~20 s phone grid target stays open.

Coordinator acceptance, 2026-10-21: O2 and O4 are accepted with the
Chromium cache-pressure residual kept explicit in
[`diagnostic-de6833b`](../../../progress/loading/g543/diagnostic-de6833b/README.md)
(`9fd203d409`). Nine of ten entries and all five real returns pass. Both
native Safari warm paths have 1.16% byte error; every entry passes stage
accounting and cadence. Phone warm grid reaches first frame in 16.8 s,
but displays 57,300 against 78,273 actual wire bytes (26.79% error).
The Chromium fixture reuses the core before pressure; after 192 MiB of
ordinary cacheable responses, its next update refetches the unchanged
bootstrap/core without validators. The game's trace matches that miss.
The real wire denominator and failed byte verdict remain unchanged.
No production workaround or cap change is introduced. O5/O6 continue:
cold CPU-4x phone grid is 28.7 s, still above the roughly 20 s target.

The current cold shader CPU profile is retained in
[`shader-profile-de6833b`](../../../progress/loading/g543/shader-profile-de6833b/README.md)
(`4d80949abd`): node-material building takes 7.657 / 3.988 s inclusive
in SHARD SELECT/grid; nested costs are not summed. Maintained Chromium
eviction probe `f164da3f97` passes baseline and 192 MiB pressure runs.
Harness `e8dbe98b5c` reads existing bounded node-build diagnostics after
the recorded first frame without extending any measurement window.
The next O5/O6 proof is pinned to `97cb8c6723`, carrying panel row reuse
`52860bd662` and sp-o2's `d2c53597a4` / `bd71395512`. sp-o2 owns its one
combined Nine/Pine/Driftwood source batch; this lane reuses that verdict.

The shared `97cb8c6723` Nine/Pine/Driftwood source batch passed in 432.4 s;
its served phone cold entries pass accuracy at 22.3 / 23.6 s, with 395.5 /
464.9 ms maximum detail gaps. Source-mapped CPU and node counts are retained
in [`shader-profile-97cb8c6`](../../../progress/loading/g543/shader-profile-97cb8c6/README.md)
(`30213acf49`). SHARD SELECT has 75 node builds / 7.254 s JavaScript build
CPU; grid has 82 / 4.061 s. Generic material labels do not prove duplication.
Grid road construction samples 2.754 s inclusive. The approximate 20 s target
remains open. The failed Simulator about:blank readiness probe captured no
valid native result; owner repair `e79e168d6b` and the actual successful
10:58:10Z priming marker precede a native-only repeat. Completed phone and
desktop runs are retained; the failed 10:49:32Z prime is excluded.

Road allocation cuts `66b001ff18` / `f8f5ee9a9d` skip clipping polygons for
triangles already within one bin and memoize LOD representatives during exact
byte preflight. Strict lint and original/candidate boundary, UV, cull-sphere,
LOD-run and admission-count parity pass. The separate 60,000-triangle micro
probe has identical full output hashes and faster candidate samples; it
establishes no whole-entry savings. Evidence is in
[`road-allocation-66b001f`](../../../progress/loading/g543/road-allocation-66b001f/README.md).
One combined source batch and served comparison on `f8f5ee9a9d` follow the
corrected native baseline. Geometry, colliders, layout and caps are unchanged.

The corrected `97cb8c6723` matrix is green: all six cold entries and all
three actual returns pass, retained with four viewed portrait frames in
[`performance-97cb8c6`](../../../progress/loading/g543/performance-97cb8c6/README.md)
(`a078394b03`). Native SHARD SELECT/grid take 10.9 / 14.9 s; desktop takes
8.8 / 10.3 s with AO enabled. Worst wire error is 2.44%, and every stage
sum and cadence check passes. The measured device is `wildshard-loading`
(9FAD), which was not erased; the successful priming note belongs to the
separate frame-floor device (AC96). Both are recorded, without a reset-device
warm-cache claim. The approximate 20 s target remains open at 23.6 s on
phone CPU 4x; the next exact-build proof measures the road allocation cuts.

The `f8f5ee9a9d` candidate verdict is retained in
[`diagnostic-f8f5ee9`](../../../progress/loading/g543/diagnostic-f8f5ee9/README.md)
(`6dcc23c550`): CPU-4x phone SHARD SELECT/grid take 22.8 / 20.7 s,
both within accuracy limits. Native grid and both desktop entries pass,
as do all three road returns; native SHARD SELECT alone fails cadence at
1,943 ms during post-chain first frame. An independently controlled GL
trace does not reproduce the stall (333 ms maximum detail gap, 136 ms
first frame); it establishes no rendering fix or cause. Harness guard
`a003d8e8f4` waits for the real worker to claim the cold title before its
fixture reload. The ordinary affected native-only receipt follows; the
coordinator accepts 20.7 s as meeting the approximate 20 s O6 target once
that ordinary receipt is green. The failed receipt remains visible.

O5 source `61e45099ae` replaces temporary child descriptors with eager
ordered node snapshots during one synchronous build. Custom collectors
and exception restoration retain the stock path; no graph cache survives
the build. Existing node build diagnostics stay inside the wrapper.
Strict lint and 17 traversal, exact shader/uniform, shadow and graph-key
tests pass. Baseline exclusive CPU attribution and the focused receipt
are retained in
[`node-traversal-61e4509`](../../../progress/loading/g543/node-traversal-61e4509/README.md)
(`31479624d3`); API notes are `b68a48cf79`. One combined Driftwood/Nine/Pine
source batch and exact served phone, desktop-AO and native matrix are
queued after the ordinary native timing window. Whole-entry savings are
not yet established; O5 remains open.

Released-worker policy is verified on live build `64d85dac0-mvi1u8vt`:
95-byte `/sw.js`, `no-cache`, strong ETag, identical Origin-present/absent
responses, no `Vary: Origin`, and unchanged conditional 304 with no body.
The hashed core is immutable, and the build id stays fixed across the
requests. Receipt `b2fc56ef7f` is retained in
[`production-worker-20261021`](../../../progress/loading/g543/production-worker-20261021/README.md).
This closes the earlier post-release header follow-up; changed-core
freshness remains covered by the existing same-length native regression.

O6 is accepted by the coordinator's stated condition: ordinary native
SHARD SELECT proof `78823` on exact `f8f5ee9a9d` passes at 9.9 s wall /
9.933 s stage sum, with 250 ms maximum detail gap and 0.0115% wire error.
The real worker controls the entry and no GL instrumentation is installed.
The compact receipt and viewed labelled native portrait are retained in
[`acceptance-f8f5ee9`](../../../progress/loading/g543/acceptance-f8f5ee9/README.md)
(`28302b9183`). The earlier same-build five valid entries, all three real
road returns and source batch remain retained in `diagnostic-f8f5ee9`.
CPU-4x phone grid's 20.7 s meets the coordinator-accepted approximate 20 s
target. The original 1,943 ms native post-chain pause is retained openly;
this ordinary pass and the separate GL non-reproduction claim no rendering
repair or cause. Duplicate foliage transport retirement remains 34,444,304
raw bytes with finished GLBs, collider data and legacy internals unchanged.
O5 continues with its already-landed traversal cut and one running combined
Driftwood/Nine/Pine source batch, followed by the exact served matrix.

O5 is accepted; the loading plan has no open implementation or proof row.
The exact `61e45099ae` Driftwood/Nine/Pine source batch passes in 180.6 s.
All six cold entries and all three real road returns pass, retained with
four viewed labelled portraits in
[`performance-61e4509`](../../../progress/loading/g543/performance-61e4509/README.md)
(`7e37b39b44`). CPU-4x phone SHARD SELECT/grid take 19.5 / 20.4 s;
native takes 12.1 / 14.7 s, desktop 7.4 / 10.5 s with AO enabled.
Every stage sum, actual-wire byte count and detail-update cadence passes;
the largest detail gap is 545.6 ms. The prior approximate 20 s target
acceptance remains explicit rather than becoming a strict 20.0 s cutoff.

The mapped comparison is in
[`shader-profile-61e4509`](../../../progress/loading/g543/shader-profile-61e4509/README.md).
Material/object multisets and counts match (67 / 74 builds). Logged node
build CPU changes from 6171.2 to 5481.2 ms in SHARD SELECT and from 2724.6
to 2725.3 ms in grid; grid CPU is effectively unchanged. These sequential
shared-machine measurements establish no isolated whole-entry speedup.
The focused allocation/parity fix, post warm-up and AO repair remain
documented with the native post-chain pause retained openly. The accepted
Chromium warm cache-pressure residual and actual-wire denominator remain.
Source/API and O6 acceptance are verified on `origin/main` at `6b0ab1dd8f`;
the final O5 evidence and this tick are with the normal carrier.

Final carrier verification: `origin/main` at `b9cabb4aeb` includes O5 source,
API, evidence `7e37b39b44` and final row tick `6cf6d4e51b`. Every loading
row is accepted and pushed with its local gates green. No CI/deploy wait
is added; the recorded Chromium warm residual remains accepted explicitly.

## Frame-by-frame audit (2026-10-23, Signal Dunes)

Jake, 2026-10-23 09:34 (iPhone 17 Pro PWA, live `ff45b6a24`): *"the downloading and updating flow still doesn't make
any sense to me … why is the downloading bar not continuous, why are the numbers not correct."* His screenshot at 8.7 s:
DOWNLOAD "0.34 MB of 5.95 MB · 54 / 164 files · 99 %" with a full bar, SETUP "step 2 / 13 · Product admission ·
Verifying 050c19a9d47b… 7 %", step 2 at 8.2 s, footer "NOW WAITING FOR: ADMIT PRODUCT · 2.9 S · 0 FILES IN FLIGHT".

Method: the live site in the Simulator's Safari (`wildshard-iphone`, an iPhone 17 Pro device, Mac network), the
player's taps (title, DEV on, SHARD SELECT, Signal Dunes, ENTER WORLD), `simctl io recordVideo` plus an in-page sampler
of the loader's DOM and `data-*` byte counters on every change. Frames read at 5 fps and 10-15 fps around jumps.
Board and labelled frames: [`art/grid/round-53-loading-audit/`](../../../art/grid/round-53-loading-audit/).

**Tap -> in control:** cold (Safari data cleared) **10.0 s**; warm (same Safari) **2.8 s**; update pill tap -> title **0.5 s**, but only with no new build waiting (below).
The Simulator is faster than the phone (Mac network, 8 cores); the shapes below are the same as Jake's.

### Timeline (cold, seconds after ENTER WORLD)

| t (s) | DOWNLOAD text · % · bar | SETUP · step | Footer / screen | What is wrong |
|---|---|---|---|---|
| 0.5 | waiting · 0 · 0 | Loading application modules | panel painted | — |
| 0.76 | 0.00 of 0.00 MB · 0 | 5 % · 2 / 13 Product admission | Read shard.json | — |
| 0.96 | 0.00 of 0.28 MB · 0 / 50 · 0 | 7 % | Content cache get · 50 waits | denominator = 50 section files only |
| 1.39 | 0.28 of 0.28 MB · 50 / 50 · **99 · bar 99.9 %** | 7 % | Admit product · 0 files | bar full after 0.28 MB |
| 1.48 | 0.28 of **5.95** MB · 50 / **164** · 99 · full | 7 % | Read blobs/json/… | 114 blobs declared late; bar stays full |
| 1.68 | **0.34 of 5.95 MB · 54 / 164 · 99 · full** | 7 % | Read blobs/tile/… · 4 in flight | = Jake's screenshot |
| 4.0 | 4.45 of 5.95 · 106 / 164 · 99 · full | 7 % · step 2 at 3.2 s | 4 files in flight | 4-wide chain; SETUP frozen |
| 6.43 | 5.95 of 5.95 · 164 / 164 · 99 · full | 10 % | Admit product · 5.0 s · 0 files | validate + save, unnamed |
| 7.03 | same | 10 % · **3 / 14** Application modules · pass 2 | — | total grows 13 -> 14 |
| 7.06-7.08 | same | 20 -> 25 % · **6 / 14 Renderer -> 5 / 14 Region world** | Read audio …/piano/**pine-calm**… · 94 files in flight | number goes back; Pine's music in Dunes |
| 7.1-8.9 | same (99, full) | 25 -> 31 % · Region world, HUD, Weapons | audio reads, +16 MB fetched | bytes outside "of 5.95 MB" |
| 8.9-9.4 | same | **44 -> 70 %** · Title art, Shaders, First frame | — | 26 pts in 0.5 s |
| 9.6 | 100 · 100 (one fading frame) | 100 | loader fades | 70 -> 100 only under the fade |
| 9.7-9.9 | — | — | HUD over a washed-out lower half, empty minimap | half-drawn world frames |
| 10.0 | — | — | world drawn, ATTACK button, minimap | in control |

Warm (same Safari): the 51 sections arrive from cache by 0.49 s (99 % at once), 165 / 165 files by 0.62 s (the
denominator is 5.99 MB / 165 files here: the cached `shard.json`, 46,192 bytes, is declared by its cache receipt,
`runtimeProduct.ts:73-75` via `download.ts:49-57`, while on cold the fetched index is never declared), step 2 lasts 0.58 s, 13.4 MB of audio comes from cache under
"Region world", SETUP reaches 70 % at 2.19 s and the loader is gone at 2.37 s.

Update pill: no newer deploy existed during the session, so the run tapped the title pill on the current build
(`ff45b6a24 · reload`). With no waiting worker, `adopt()` returns at once and the page replaces itself with `?v=`:
blank at 0.3 s, title back at 0.5 s. Jake's long static "UPDATING…" needs a waiting worker: on `ff45b6a24` the label is set once
(`src/engine/ui/Update.ts:41` there; HEAD `6c6ffea1e0` already ticks "Updating · N files · N s", U3), `adopt()` then waits up to `CAP_MS` = 2.5 s for `controllerchange`
(`src/engine/boot/sw.ts:47`, `:139-153`), and the reloaded new build downloads its renamed packs before the title.

### Why each number is wrong (code at live `ff45b6a24`; every file below is unchanged at HEAD)

1. **The bar sits full at 99 % from 1.4 s.** `Loading.downloadProgress` keeps `shownDownload = max(shown, done / declared)`
   (`src/engine/ui/Loading.ts:255-259`, comment `:81`). The first declarations are only the 50 section files
   (`src/game/shardfile/product.ts:176`); when they finish, `done / declared` = 0.999 (`src/engine/boot/loadingDownloadText.ts:16-19`
   caps at 0.999, so it reads 99, never 100). The 114 blobs are declared later, after the sections parse
   (`product.ts:293`); the text follows the new denominator (0.34 of 5.95 MB) but the max() keeps the bar at 99.9 %.
   Files, MB and % then disagree for the rest of the load.
2. **"of 5.95 MB" is not what the load downloads.** Only product files are declared. The boot reads every music style
   and SFX set (`src/engine/boot/extras.ts:169-180`: piano and orchestral Pine music, title tracks) plus title art,
   about **16 MB more** on cold, none of it declared, so DOWNLOAD says 99 % while most bytes are still to come. WebKit
   reports `transferSize` 0 for service-worker responses, so every byte lands in "files by body size" and "network"
   stays at 757 bytes (`src/engine/boot/download.ts:78-81`).
3. **Product admission is slow and opaque.** `admitProductWork` reads the 114 blobs through 4 slots
   (`product.ts:337`); each slot fetches, copies (`Uint8Array.from`, `product.ts:313`, main thread), hashes in the
   content-hash worker (`product.ts:314-318`, `src/engine/boot/contentHash.ts:56-73`) and only then starts the next file:
   6.3 s for 5.95 MB on the Simulator, latency-bound, not CPU-bound. A cached file is hashed twice: once on the page by
   `cachedTransport` (`src/game/shardfile/runtimeProduct.ts:79-80`), again in the worker. Only fetch and body reads are
   registered waits (`product.ts:148`, `runtimeProduct.ts:72`); the worker round trip, its lazy start
   (`contentHash.ts:35-47`, a module worker fetched on first use) and CacheStorage lookups are not, so the footer falls
   back to "Admit product · 0 files in flight" (`Loading.ts:349-350`). **Jake's 8.2 s "Verifying 050c19a9d47b…"**:
   050c19a9d47b is the first blob read (a 17 KB tile; it verifies in under 0.3 s here). At 4 / 114 blobs with 0 files in
   flight, all four slots were waiting on the hash worker's first reply or a cache lookup; hashing 17 KB is
   microseconds. The step's first 5.3 s were the descriptor and 50 sections (0.6 s on the Simulator).
4. **SETUP crawls, then jumps, then vanishes at 70 %.** Weights are expected wall times: `loadingExpectations` falls back to
   300 ms per step (`src/engine/boot/weights.ts:10`) because `src/loadingCalibration.json` has rows for driftwood-isle
   only. So a 6.3 s admission is 1/13 of the bar (5 -> 10 %), the 2.5 s of later steps fill 10 -> 70 %, and the last
   30 % (First frame, Audio) is granted only by `done()` under the 250 ms fade (`Loading.ts:381-390`).
5. **Step total grows and numbers go back.** `manifest.load` is an alias of step 1 (`src/game/boot/loadingPaths.ts:12`);
   the session begins it again after admission (`src/game/session/session.ts:132`), and the timeline appends an
   undeclared repeat ("Application modules · pass 2"), so 13 becomes 14 (`src/engine/boot/timeline.ts:88-93`). The shown
   step is the most recently entered running stage (`timeline.ts:47`) while numbers follow start order (`timeline.ts:111`),
   so a nested Renderer (6) ending hands the label back to Region world (5). "Final activation" (11) ends before Shaders
   (12) and First frame (13). "Texture and audio preparation" lasts 6 ms while the audio downloads run under Region world.
6. **Labels.** TIER's "offline cache" only means a service worker is registered (`Loading.ts:122`, `:224`, string
   `s_5c75b0e90774`), not that this shard is cached. The footer names the oldest page-wide file wait
   (`Loading.ts:350`), so Signal Dunes' Region world shows "waiting for … pine-calm-923e0056.m4a". The players' one bar
   is SETUP only (`Loading.ts:233-234`) and ignores DOWNLOAD.
7. **Half-drawn world.** For about 0.3 s after the fade the HUD sits over a washed-out lower half (ground not drawn), an
   empty minimap and the title wordmark ghost (frame `05-half-drawn-world.jpg`).

### Fix rows (one honest progress model)

One bar for everyone: bytes actually fetched over bytes the load needs (cache hits counted as done at once and named
"from disk"), declared in full before the first byte, then setup steps by measured weight. "Done when" is checked on one
Simulator recording of HEAD (cold and warm Signal Dunes, the same tap path), frame by frame.

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| **L9** | One download denominator, declared up front: the product index's sections and blobs at descriptor time, plus the audio, art and modules the boot reads; no `max()` ratchet over a growing total and no 0.999 cap (`Loading.ts:255-259`, `loadingDownloadText.ts:16-19`, `product.ts:176/293`, `extras.ts:169`); service-worker bodies counted in the same bar **Done:** `eeed567fb6` reader boundary + `1ff3308671` pickup inventory (23 files, 370,224 B); `6d4d43b178` bounded post-control cache witness. Exact `a73338c-mvn1ofxp` original Signal cold/warm: 38/39 numeric samples, 0 drops, 1 late denominator change, max error 0.957 pt. Four pre-inventory waiting/zero-total samples per visit remain explicit. All 164 product paths and all 646 initial declared URLs have measured matching body sizes, no failures/limits. Final 21,665,590 B versus independent content/copy unions 22,271,675 / 22,265,705 B (2.72% / 2.70%); hash/original aliases count once, cached copies do not prove boot hits. | in flight (reading at plan end, G780; source landed) | M | DOWNLOAD % stays within 2 pts of bytes done / bytes needed in every sampled frame, never moves back, and its total changes at most once after step 2 starts; final total within 5 % of all bytes fetched |
| **L10 — done (2026-10-27, sp-x9; sources `fce0e644ce`, `8990a7ff66`, `ebf55a80c3`; qualified exact `ebf55a80c3`)** | Selected-style audio only; demand-only Explorer art stays out of boot. Partial admission phases no longer fetch deferred pack members. G763: own art/data/scripts compare in decoded-content units; source-mapped shared runtime/Rapier remain separate. | Codex | S | Cold title-to-controls own-content10,158,727B /9,252,856B unique requested originals =1.09790× (bar1.2×), including882,611B unmapped/common data conservatively charged without denominator credit. Warm625,172B conservatively charged /the same proven cold originals =0.06757×, no own art/model HTTP bodies. Actual entire-visit payload14,342,273/192,605B cold/warm remains explicit; no cache-inventory denominator credit. All app errors0. |
| **L11 — in flight (reading at plan end; source `5b7f2466dd`, `a1a9bfc09f`; G780)** | Sixteen bounded transports backfill as each verification completes; worker-verified inputs skip a second page hash. Worker/cache/file waits name the current work; the first admission footer is handed off synchronously before exposing its new phase. | Codex | M | Source closed. Retained6e admission1404/1179ms meets2.5s, but its first old footer is a historical FAIL repaired by a1a9bfc09f. All-frame native requalification is after-plan damage, not a claimed current PASS. |
| **L12 — in flight (reading at plan end; source `ed08d65a64`, `86855759e5`, `84e8e79043`; G780)** | Byte-scaled wildcard calibration covers unmeasured shardfile paths, measured device history persists by tier/path/identity, and completed credit is published at real step entry. The bar completes before the fade. | Codex | S | Source closed; original0e50 cold admission/runtime first-entry misses stay recorded. Boundary credit fixes those starts in the retained composition evidence; all-start current native15pt/95%-before-fade requalification is after-plan damage, not a new measurement. |
| **L13** | A stable, monotone step list: the plugin-module pass declared or folded into step 1, the earliest running step shown (not the newest nested one), rows in plan order, audio reads under the step that names them (`loadingPaths.ts:12`, `session.ts:132`, `timeline.ts:47/88-93/111`) | done (2651 sampled qualification) | S | the total never changes and the step number only increases in every sampled frame |
| **L14** | Labels that mean what they say: TIER shows "worker ready" or the shard's cached state instead of "offline cache"; the footer prefers waits of the current step; the players' bar uses the same combined model (`Loading.ts:122/224/233/350`) | done (2026-10-27, sp-x9; source `6f4b0d8237`, qualified `49de57e7e1`) | S | 327 grid/standalone cold+warm samples and 41 admission rAF callbacks: no mismatched selected wait, no empty-cache claim; all show worker ready. Explicit same-stage overlapping-owner regression keeps displayed/nested waits scoped to this attempt. Original clocks remain live; no all-physical-frame claim |
| **L15** | No half-drawn world under the HUD: the loader leaves only after a complete first frame (ground drawn, minimap filled). **Done:** `66c0cb0072` starts the loop before the fade and waits for two drawn frames plus the decoded minimap (at most 1.5 s). Checked on preview 0694e3e (Chromium, iPhone 16 Pro phone tier, 4× CPU, CDP screencast over loader-gone −400…+1200 ms): Driftwood, Pine Hollow, Nalati, Nine Dragon, Sky Reach, Signal Dunes, Template and the grid entry each show ground drawn and the minimap filled from the first frame the fade reveals; 0 half-drawn frames. Blender Template has no menu card; no Simulator timing claim | done (2026-10-26, sp-o2) | S | no frame between the loader and the world with missing ground or an empty minimap |

### L9 worker-only durable receipt follow-up (2026-10-25)

| Slice (≤1 h) | Status | Boundary |
|---|---|---|
| L9.1 Worker receipt credit | done (this code commit, sp-x2) | A worker `stored` reply returned before incrementing storedFiles/storedBytes. Credit once in the existing finally after reservation settlement, including the early return. Real SHA/cache/protocol regression: one durable3B file reports0/0 before,1/3 after; fetched:null remains exact. Page fallback still passes; no fetch, cap, body-retention or durability change.27focus +9related cases, touched-game/scoped fixture types and named typed lint pass. No native memory/byte gain claimed. |
| L9.2 Remaining loading acceptance | done (source audit, sp-x2; this code commit) | L12 has byte-scaled wildcard calibration, L13 declares module/repeat rows, L14 scopes waits and says worker ready: no duplicate runtime implementation. The compiled reader now reports step evidence from its existing samples. Retained730f DW cold/warm:68/56 numbered frames, fixed26 total,0 total changes/backwards numbers,100 setup before fade; observed step-start errors ≤13.47/12.35 points using rounded displayed clocks. Only7/26 starts were sampled per visit: this is not full L12 acceptance or the required Dunes cohort. No new capture/observer or frame-gate change.31focused cases and named typed lint pass. Core C1 stays open and unclaimed. |
| L10.1 Current Dunes acceptance | done (measurement; criterion FAIL retained) | Exact3b8376 app, corrected22633 reader: one cold/warm compiled pair complete/errors0, controls4792/4051ms, post-control maxima17/18ms. Cold14,457,883B HTTP bodies = product7,761,417 +Rapier3,292,228 +JS1,105,913 +other assets2,126,137 +shell172,188; decoded network17,190,451B,0 unknown responses. Full product8,228,974B content; selected cached inventory177 entries/8,177,741B plus descriptor. Both wire/content comparisons remain above1.2×, never treated as matching units. No audio requests. Admission1482/1191ms meets timing, but several frames show Admit product/0 files: L11 footer criterion stays open. Existing peer related/hook overlapped the reading; no causal speed claim. All owned Sim/browser/quiet/preview resources closed. |
| L10.1a Reader document fence | done (`22633c856e`) | First3b8376 Dunes attempt refused before a valid pair: Safari timeOrigin changed1792948830448→449 while the same watcher progressed342→480 frames without resetting. Replace numeric identity equality with a per-document UUID, as the grid reader does; record raw originDriftMs. A replacement or missing token still refuses, even at the same numeric origin. All original clocks/deadlines/100ms gate stay intact. Corrected pair above retains1/0ms drift with stable tokens; original incomplete retained, no app change. |
| L10.2 Demand-only Explorer previews | done (this code commit) | An active boot profile omits boot.explore.art from its preload/denominator; Explorer still assigns original image URLs when opened. Explicit boot.precache and selected card art stay eager; the profile-free background inventory retains Explorer art and all audio styles. Pre-cut Dunes requested4 previews/70,748B during boot: this is the identified eligible body total, not a post-fix native saving or L10 pass. Engine/test types, scoped typed lint and exact lazy-image/mandatory-precache regressions pass. |
| L10.2a Matching compiler inventory | done (this code commit) | The per-home boot bank must omit the same demand-only previews as8990a7ff66, or it reserves bytes the boot no longer requests. Real Vite-emission regression fails before the producer correction (an unrequested61B SVG remains) and passes after; card and explicit precache remain in both emitted bank and live preload.10focus/8related cases and strict scoped fixture types pass. No runtime reader/gate change, no post-cut native claim. |
| L11.1 Preserve the reported admission detail | done (this code commit) | The outer admission wrapper hid current progress such as Checking saved <hash> behind Admit product/0 files. Ignore only that wrapper when choosing a footer wait; genuine file/hash/worker waits still win, otherwise show the actual phase detail. Real DOM regression is red before/green after and preserves true0-file counts plus real-file precedence.20focus/20related cases, engine/test build types and named typed lint pass. No queue/hash/admission policy change; no post-fix native claim. |
| L11.2 Name worker waits without a zero-file suffix | done (this code commit; DOM qualification) | A real cache/hash worker wait still printed0 files in flight even after the outer admission wrapper fix. Show its real label and age without a zero-file suffix; retain true dataset count0 and every positive file count. Real DOM regression is red before/green after, including worker hash followed by a real file taking precedence.20focus/20related cases, engine/test build types and named typed lint pass. The pending2651 image-residency milestone predates this text-only cut; no after-cut native footer claim. |
| L9.3 Current inventory drift | done (2651 cold/warm inventory qualification) | Current Dunes has0 download regressions and <1pt numeric error, but4 late denominator changes after admission in both visits (20,609,655→21,088,599B). L9's historical a73338 acceptance stays historical. The first two additions match preview images; those eager reads are removed above. The last occurs with the real GLTF parser read, whose module group is declared by prepareRigLoader. Audit exact selected library/feature callers before expanding compiler selection; do not reserve unused optional modules or change correct worker receipt counters. |
| L9.3a Declare required model-parser code | done (this code commit) | Select models.gltf from hash/length-verified world/scenes model sources, matching eager meshes, HD/painted models, nonempty native pools and automatic rigs. Empty/manual-rig-only libraries stay unselected; mismatched source hashes still refuse.10 focus/19 related cases plus scoped types/typed lint pass. No geometry/runtime reader change, no extra native reading and no post-fix byte claim. The other367,401B denominator addition remains unattributed. |
| L9.3b Retain compiler facts for attribution | done (`3ddda16892`) | The saved totals/resources cannot attribute the remaining367,401B addition to a particular declaration. Existing HTML observation now retains only the original boot-module-files JSON plus its SHA, bounded to1MiB; missing/duplicate/malformed/oversized metadata stays explicit. Real HTTP regression keeps the served bank and existing whole-page hashes exact. No new page observer, runtime counter, app input, clock or deadline; next coherent native milestone supplies post-fix evidence.18 focus/3 related cases, scoped strict types and named typed lint pass. |
| L9.3c Do not fetch images solely to reserve costs | done (`2651c46b73`; current pair below) | Saved Dunes ledger identifies the three image additions exactly:29,650 +10,346 +367,401B =407,397B, comprising four Explorer previews70,748B and three card JPEGs336,649B. The library lease reread every missing image for costing, undoing manifest-only transport omission even though image costs never inspect those bytes. Use admitted decoded/GPU image metadata with the same full claims; actual consumer reads retain original hash/size refusals. KTX2 still rereads/parses device costs and every non-image missing/corrupt refusal remains.8 focus/753 related cases across112 suites, touched-game/scoped types and named typed lint pass; one current cold/warm milestone follows. No post-fix byte/heap claim yet. |
| L9.4 Current image/parser milestone | done (measurement; limited claims) | ONE2651c46-mvo5sb9t cold/warm pair complete/errors0:45/41 numeric frames,4 missing initial samples each,0 late denominator changes,0 regressions, max rounding error0.915/0.782pt. Final20,617,988B both. Cold page/selected-worker URL union with actual HTTP/cache body sizes:655 URLs/21,357,986B,0 missing sizes,3.46% declaration difference; HTML includes recorder injection. Warm cache reads do not expose equivalent events: no independent warm-union claim. Seven duplicate product images have0 HTTP requests. Cold wire13,812,308B/content16,230,539B,0 unknown responses; no audio. Controls4671/4121ms, post-control max22/19ms PASS original100ms gate; admission1435/1267ms. Two pre-existing peer related jobs overlapped: no causal/clean timing claim. All owned Sim/browser/proxy/quiet/preview resources closed. Pin predates c6bc7d2327 final worker-label text; no native qualification of that text. |
| L12.1 Restore actual gameplay timing attribution | done (this code commit; native qualification still open) | Complete2651 rows reveal Gameplay missing while Equipment/HUD absorbs239/238ms. LevelLoader emits level.play, but loadingPath omitted that alias. Map it to the existing Gameplay and saved state row. Real loadingStage bridge regressions are red before/green after on legacy/shardfile/grid; parent gameplay110ms, nested menu5ms, equipment20ms sum exactly135ms.12focus/21related cases, touched-game/test types and named typed lint pass. No gameplay/save/scheduling change; current native pair predates the alias and only sampled5 starts per visit, so full all-start L12 acceptance remains unproven. |
| L12.2 Persist per-path calibration in a defined slot | done (this code commit) | boot.path.times is undefined in saveStorage, so caught exceptions silently discarded all path history. Use boot.times:path:v3:<tier>:<path>:<identity> in the existing boot.times record, separate from legacy timing suffixes and the corrected gameplay attribution. Real SaveStorage regression fails before and passes after: measured40/200 with baseline160/190 persists100/195, next60/210 blends80/202.5; separate tier/path/identity stays empty, legacy world777 remains, denied writes keep the in-page fallback without changing persisted bytes.7focus/27related cases, touched-engine/test types and named typed lint pass. No calibration values, gameplay saves, registration or loading deadlines changed. |
| L12.3 Coherent attribution/history qualification | done (c5448e0-mvo75qmi; limited native qualification) | ONE cold/warm pair complete/errors0: controls4109/4116ms, original100ms gate PASS at18/23ms. Gameplay now122/118ms, separate from equipment111/114ms. Cold history persists14 rows; warm pre-tap record equals cold post-controls exactly, then all14 warm rows blend measured times correctly (including the1ms floor for zero work).44/40 numeric samples,0 late denominator changes/regressions,20,618,022B final.40/36 numbered samples, fixed15 total,0 backwards/changes,100 setup before fade. Six starts observed each: rounded-clock errors ≤8.053/14.579pt; no all15 true-start claim. Admission1168/1249ms. Worker-ready tier is accurate; real file/hash waits retain names and no zero-file suffix. Count-free cache CPU phases still showed0/0 files: source correction below, strict all-frame L11 remains open. Existing x8 related PID17982 overlapped; x6 map stamp19:06:04–14Z also overlapped the visit. No causal/isolated timing claim. All owned Sim/browser/proxy/quiet/preview resources closed; raw tmp/sp-x2/loading-history-dunes. |

| L11.3 Omit empty CPU-phase file counters | done (this code commit; DOM qualification) | The coherent native pair exposed Checking visited product ·0/0 files ·0.00MB read despite that phase having no file units. Keep its actual work label; append file/byte facts only when reported. Positive totals retain0/N and zero bytes read, actual byte-only reads stay visible, numeric filesInFlight remains true0. Regression fails before and passes after; no admission work, concurrency, hashing, receipts or clocks change. No per-slice native rerun. |

| L12.4 Keep local file units out of whole admission weights | done (this code commit; native qualification follows at the next loading milestone) | Current warm Dunes shows33% at admission start: one parsed descriptor reports1/1 and credits half of the complete admission share before122 assets and validation. Admission switches inventories, so those counts are detail facts, not a stable whole-stage denominator. Use its existing calibrated elapsed-time model; module counts and every actual file/byte label stay unchanged. DOM regression is RED28% vs expected4% before, then4/13/20% over measured time after despite descriptor1/1 and asset122/122.23focus, touched-engine/test types and named typed lint pass. No transport, concurrency, validation, deadline, stage list or completion change. The c544 native pair predates this correction; no after-cut native claim. |

| L12.5 Post-correction loading milestone | done (cbd48f8-mvo7x49y; bounded native qualification) | ONE cold/warm pair complete/errors0, controls4411/3859ms, original100ms post-control gate PASS17/19ms. Monotonic panel clocks retained46/45 samples; six numbered starts each, max page-clock errors7.861/1.476pt (rounded display ratios retained separately). Warm admission first shows17%, versus33% in c544; cold14%. Native admission1246/1157ms, Gameplay122/116ms.0 empty0/0 or0-files-in-flight footer samples; actual CPU phases name their work, so literal every-frame file/hash L11 is still open. Fixed15 total over38/38 numbered frames,0 backwards/changes,100 setup before fade.42/41 numeric download samples,4 initial missing each,0 late denominator changes/regressions, max error0.937/0.804pt, final20,637,035B. Cold history14 rows equals warm pre-tap exactly; all warm blends exact. Worker-ready is the only tier cache label. Pre-existing peer related PID22489 overlapped: no causal/isolated timing claim. All owned Sim/Safari/Inspector/proxy/quiet/preview resources closed, raw tmp/sp-x2/loading-weights-dunes. Missing/invalid completion clocks retain only old rounded diagnostics;19focus/related, scoped types and typed lint pass. Full all15 true-start coverage remains unproven. |

| L11.4 Identify cache and CPU phases truthfully | done (this code commit; native qualification pending) | The unnamed phases in the cbd pair were visited-cache lookup, receipt verification and final publication, not extra unreported reads. ProductOptions.descriptorPath is UI-only context supplied from the real manifest URL pathname (including nonstandard entry.json); it never selects a fetch, cache entry or validation input. Inline callers without a file name their actual cache key instead. Later progress uses already-computed product/asset hash prefixes; pending cache/hash/section waits retain that context, including full digest prefixes for commons references. Four online/receipt regressions fail before and pass after;128 focused cases including pending-wait drain, no extra descriptor read, missing inline filename and original body/refusal/identity assertions pass. Touched-game/scoped types and named typed lint pass;1652 related cases/311 suites pass, with14 stale-product suites explicitly deferred to CI. No per-text-slice native capture; literal all-frame L11 qualification remains for the next coherent loading milestone. |
| L11.5 Bounded admission callback evidence | done (tool slice, sp-x2; native acceptance remains open) | The injected reader now retains each admission animation callback's footer, wait and file-count facts, grouping identical consecutive tuples. It never rereads full loading rows per callback; stops on loader completion; caps256 runs and1024 characters per field; counts dropped/truncated frames explicitly. Missing/unfinished/overflowed/truncated evidence cannot report complete callback observation, and blank footers remain counted. Three serialized-recorder regressions fail before the change; four recorder cases and24 total related cases pass afterward, with scripts project/scoped fixture types and named typed lint green. These are callback observations, not inferred paints, true step starts, label correctness or L11 acceptance. No app code, clock, deadline, frame gate or Simulator visit changes in this slice. |
| L11.6 Current admission milestone | done (bounded measurement on `6e6545465f`; L11 still open) | Initial exact e00d preview refused before launch on Far Reach product-owned geometry in a public boot pack; owner repair63efd6597b precedes this one cause-fixed cold/warm pair. Both complete/errors0: controls4727/4056ms, original100ms post-control frame gate PASS17/25ms, admission1404/1179ms. Callback records complete84/70 frames in17/15 runs,0 blank/dropped/truncated, max gap29/26ms. Each visit's first admission callback still has the old Application modules footer; all-frame correctness is NOT accepted. Downloads40/41 numeric samples,4 initial missing each,1/0 late denominator changes,0 regressions,20,670,589B final both. All owned Sim/browser/proxy/quiet/preview resources closed; raw tmp/sp-x2/loading-admission-frames-fixed. No isolated speed or memory gain claim. |
| L12.6 First-accounted start clocks | source done (`6e6545465f`, sp-x2; native qualification open) | Retain each declared row's first monotonic start through aliases, nesting and repeated calls; completed zero-duration rows keep their clocks even if no repaint observed them. Initial module accounting keeps the original attempt origin, future rows stay unknown, and elapsed totals/order are unchanged. The loader DOM and serialized accuracy reader preserve this existing row metadata. Three initial regressions fail before;30 focused cases, engine/engine-test and scoped fixture types, and named typed lint pass. Bounded commit selection271 cases/23 suites passed; optional broad walk was cancelled exit130 afterward, with44 missing-product suites explicitly deferred, never an aggregate PASS. Current native pair retains14 executed rows' actual clocks, with no invented clock for the unused audio-files row; only6 displayed starts per visit were observed. First-observed errors9.221/2.199pt do not establish the displayed setup fraction at every true boundary or qualify all-start L12. |
| L11.7 First admission footer handoff | source done (this code commit, sp-x2; native qualification pending) | Native callback evidence above catches the new admission.descriptor step before the paced panel updates its old modules footer. Publish the actual current footer once on an outer modules/admission transition, after reporting its real descriptor detail and before exposing the new step. Same-phase byte updates keep paced repainting; no full panel paint, extra fetch, invented file count, admission policy or deadline change. DOM regression fails before and passes after without advancing a frame; it also pins same-phase pacing and true0 files in flight. No per-text-slice Simulator rerun; L11 stays open for the next coherent milestone. |
| L12.7 Retain the actual setup fact at first entry | source done (this code commit, sp-x2; native qualification pending) | An optional timeline supplier reads the existing DOM setup integer once when each declared row first begins; snapshot, row DOM and the existing accuracy reader retain setupAtStart beside startedAt. Re-entry, aliases, nesting and later snapshots cannot overwrite it. Missing/invalid values, future rows and the initial attempt origin before the timeline existed remain unknown. No model reconstruction, extra observer, timer, full repaint or changed bar/work/deadline. Timeline/DOM regressions fail before and pass after, including a zero-duration step that finished before its row paint;21 focused cases and named typed lint pass. This records DOM state, not browser paint. The6e pair predates this source; full L12 acceptance remains open for the next coherent native milestone. |
| L12.8 Grade the retained boundary facts | source done (this code commit, sp-x2; native qualification pending) | Keep first-observed sample ratios separate from exact retained first-entry clocks/setup. The official reader reports measured and missing executed rows, each measured error and the15pt result. Partial good evidence stays unknown; an actual measured miss remains false despite another missing boundary. Repeated gap rows are excluded. Missing final clocks/rows stay incomplete; duplicate, out-of-range or oversized boundary records refuse. Direct Node vectors exercise8 invalid refusals/8 missing-clock cases and exact15pt/partial-miss cases; both saved6e visits retain14 executed rows/0 measured and never acquire a retrospective PASS. Scripts/scoped fixture types and named typed lint pass. Vitest initially refuses collection on missing Far Reach discovery; owner x1 is restoring it after x6's defining source-loader decoder repair, with no duplicate generator or stub. Original frame qualification/exit code unchanged; no paint or native acceptance claim. |
| L12.9 Preserve the real initial shell fact | source done (this code commit, sp-x2; native qualification pending) | The first module row starts at the inline shell clock before LoadingTimeline exists, so a later getter cannot reconstruct its setup fact. Retain the actual shell setup text beside that clock in the existing inline first-paint script; adopt only an integer0–100 tied to the identical attempt origin. Missing, invalid or mismatched facts stay unknown; later calls cannot replace them. Two regressions fail before and pass after, including execution of the actual HTML document;45 focused cases pass, including original shell-fact adoption. The L12.8 cause-fixed reader rerun also passes23/23 after normal discovery restoration. No new timer/observer/repaint, bar/model change, invented initial zero or native acceptance claim; one coherent current native milestone follows the defining SDK consumer repair. |
| L11.8 Boundary milestone / visible refusal capture | source done (reader slice; exact0e50 cold measured, warm incomplete) | ONE official cold/warm pair exits1: cold controls4852ms/worst22ms/errors0, admission1461ms;87 admission callbacks complete with0 blank/truncated/dropped and no old modules footer. All14 executed step boundaries are now measured, but admission0% vs22.461% elapsed and runtime/data33% vs54.486/54.661% miss15pt: L12 is measured FAIL. Warm shows Unavailable or oversized shardfile asset at1314ms before world/controls, then the old reader waits its unchanged240s deadline because no accuracy recorder is present; no warm timing/acceptance. Route app refusal to Sunscar owner x6. Reader now retains the visible first error, bounded stack/last64 resources and recorder state once, then refuses immediately even if diagnostic capture fails; no observer, retry, cap/deadline increase or gate weakening. Native0e50 cold alone cannot accept the full pair. Raw tmp/sp-x2/loading-boundary-pair; Sim/quiet closed, preview retained only for cause audit. |
| L12.10 Publish earned credit at a step boundary | source done (this code commit, sp-x2; native qualification pending) | The exact0e50 miss is stale displayed credit: modules/admission finish before the paced repaint, so the next first-entry fact still sees0/33%. Publish the existing weighted setup and combined bars before marking a declared row started, then record the actual numeric text; do not credit the new row early. Only first entry publishes, never byte updates, snapshots, wrappers or re-entry. No row/diagnostic repaint, new timer/observer, weight/ease-curve retune or deadline change. Real DOM regression fails0% vs28% before and passes28/71% after without advancing a frame, with the combined-bar model pinned. The original native22.461pt miss and incomplete warm visit remain; no after-cut native claim. |
| L11.9 Isolate the official reader's preview borrower | source done (this code commit, sp-x2; no native retry) | Shared preview ownership is a set, so the preparer's and reader's identical SERVE_OWNER token aliases one lease despite different names. Derive a distinct process-scoped reader token and pass the same environment to acquire and release; leave the preparer's lease intact. A real shared-release backend regression uses the reader's defining token and proves no teardown plus retained parent registry/output, with7 release contracts and25 reader cases passing. This establishes cleanup aliasing only: finally releases after the warm timeout, so it does not explain the first asset failure. X6 owns refusal context/cause audit; retained0e50 server/registry/logs remain untouched and no repeat native pair is queued. |

| L11.10 Release a retained preview by full identity | source done (this code commit, sp-x2; no native retry) | A real cleanup refusal exposed an older shared lease for the same reused port before the current lease, after its output marker was absent. Fallback lookup now selects the registered PID and output directory before checking borrowers; stale records stay untouched, and an unmatched shared identity refuses teardown. Both new regressions fail before and pass after; all9 release contracts pass. This is cleanup correctness, not an explanation of the original warm asset refusal. Defining contextd43db6ffe8 is on origin; original cold L12 miss/warm incomplete result remains and no native pair is repeated. |

| L12.11 Replay the three recorded failing starts | done (this code commit, sp-x2; composition regression only) | Use the original0e50 cold origin28ms, total4559ms, final declared20,670,833B and admission/runtime/data first-start clocks1052/2512/2520ms with the shipping loader, shardfile path and unchanged wildcard calibration. All three displayed first-entry facts now meet15pt without a paced paint; disabling only the boundary publisher in a test transform reproduces the exact22.461pt admission miss. The full nested event trace is not retained, so this is not a14-step replay or new native qualification. Two focused/related tests, scoped fixture types and named typed lint pass. Original native L12 FAIL and warm asset refusal remain; no native retry or model/budget change. |

**L10 unit clarification: decided G763.** The1.2× threshold governs only the selected shard's own content (art/data/scripts). Shared engine runtime, including the3,292,228B Rapier binary and shared engine JS, is counted once separately and cached across shards by the existing immutable/versioned cache-first path. Do not subtract all JS or common assets blindly: only verified shared runtime belongs outside the shard numerator. Compare HTTP body units with HTTP body units, or decoded content with decoded content. The old aggregate ratio remains historical and cannot establish an own-content PASS. No budget rise, physics deletion, inferred cache hit or new reading.

**G780 qualification:** L9–L14 source changes are landed; the one end-of-plan reading remains. The backlog lives only in [BURN-DAMAGE-LIST.md](../BURN-DAMAGE-LIST.md), D23 (G800). Historical measurements below are retained observations, not a current qualification.

Current exact-boundary qualification is the0e50 cold visit: all14 executed starts measured, with a22.461pt L12 miss and100 setup before fade. The paired warm visit refuses on an asset response before world/controls, so the pair is incomplete. Historical6e first-observed ratios are not all-start acceptance. Boundary publication84e8e79043 now has both DOM and shipping-path composition regressions, but no after-cut native result. L14 retains its qualified ownership contracts; full L12 and all-frame L11 remain open. Defining response contextd43db6ffe8 and separate reader ownership59e4422577 are ready for the next scheduled source cohort; neither proves the first warm fault's cause. No retry is queued.

The update pill's static "UPDATING…" stays with U1-U3 in [loading-speed-mini-plan.md](loading-speed-mini-plan.md);
this audit adds no update rows: the Simulator run shows the reload itself is 0.5 s, so U1's split (adopt wait,
worker install, re-downloaded packs) is where the time goes.

## Shared plan-end observation (2026-10-27)

The 3-cold/3-warm Driftwood grid cohort on `5f1eadb19e` is recorded in
[loading-speed's plan-end reading](loading-speed-mini-plan.md#plan-end-chromium-reading--2026-10-27-g777g780).
All six visits reach controls and normal movement/errors 0, but controls take
14.033–16.300 s cold / 13.612–15.026 s warm. Actual stage wire traffic is
71,038,639–71,059,606 B cold / 496,698 B warm; cold all-traffic body before
controls is 76,087,848–76,092,585 B. Warm cumulative scratch accounting is
rejected because it includes the prior visit. This is an explicitly bounded
Chromium CPU-4x observation, not full L9-L14 all-frame/start or own-content
L10 qualification. No prior failed result, cache category or bar is erased.
