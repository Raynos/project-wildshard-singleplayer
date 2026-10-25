# Grid-ready for one shard: mini plan for the builder (G557)

Jake, 2026-10-21 ~08:20 Cancun: *"FFS grid readiness will never complete right? Make me a mini plan to complete grid
readiness for one shard."* And: *"grid readiness should not be blocked on my iPhone; we should have a final iPhone
readiness check for the shard platform plan, like a final step after everything else is done, once the whole mega plan is
99 %"* (G558).

## G717 / G723 remeasurement slices (2026-10-24, sp-x8)

The old 48 passes were explicitly removed by G717; historical receipts below do
not restore them. Measure the post-L18.1 origin build without changing gates.
Each slice is bounded to one hour; report misses and their observed owners first.

| Slice | Work | Status |
|---|---|---|
| G717.1 | Driftwood, Pine, Nalati and Nine: qualified Chromium phone memory/look and first-crossing step timings. | done (2026-10-24, sp-x8) |
| G717.2 | Remaining shard and plot memory/look cohorts; cause-corrected entries use the defining tile-priority fix, with exact identities and only actual passes retained. | done (2026-10-25, sp-x8) |
| G717.3 | Official quiet Simulator floor and separate native visit completed. The actual two-resident condition was not observed; its memory reading remains unavailable. | open (two-resident witness not reached) |
| G717.4 | Re-latch only qualified passes; report worst rows, preparation steps and source owners before proposing crossing cuts. | done (2026-10-25, sp-x8) |
| G723.1 | Measure first road-to-control waits and existing completed preparation stages for Driftwood, Pine, Nalati and Nine; separate prior preparation from edge wait. At most one hour. | done (2026-10-25, sp-x8) |
| G723.2 | Coordinator approved kept plus one isolated incoming world, with strict preparation budgets and source retirement before destination entry; preserve the kept source on a U-turn. Bounded source slices below. | in flight (2026-10-25, sp-x8) |
| G723.2a | Read-only allocator projection: page loading and both owner limits, including already retained inputs; no admission, eviction or warning-policy mutation. At most one hour. | done (2026-10-25, sp-x8) |
| G723.2b | Wire explicit isolation capability and the budget guard into unique warm-ahead; enforce two-world maximum, cancellation, U-turn retention and retirement before entry. At most one hour. | done (2026-10-25, sp-x8) |
| G723.3 | Measure the defining warm-ahead slice against the same first-entry route and keep every durability, cancellation, claim and readiness fence. At most one hour. | open |

## G717 frame-floor misses (2026-10-25, sp-x1; G639)

Chromium phone-tier profiles use the original ALL route and the defining
`1138f0564c` baseline. Each source slice is bounded to one hour and records
its Chromium before/after numbers in the code commit. Diagnostics supply no
official floor credit; sp-x8 owns the quiet rerun at the next milestone.

| Slice | Work | Status |
|---|---|---|
| G717.N1 | Attribute Nalati's 287 / 243 ms official hitches using the original drive. Chromium phone4x reproduced max 483.3 ms: 176.2 ms sampled native first-use query plus 188.5 ms game phases; the independent afterPlay frame spent 106.5 ms resolving a link. | done (attribution only; 2026-10-25, sp-x1) |
| G717.N2 | Fix the reproduced native first-use / activation work and compare the same Chromium route; no timing credit from the diagnostic. At most one hour per source cut. | in flight (2026-10-25, sp-x1) |
| G717.P1 | Pine whole-drive: original-history Chromium phone4x reproduces p95 66.8 / max 333.3 ms, including 150.7 ms scene-binding refresh. Warm parked draws borrow/restore environments; stock wrapper IDs change even when the exact resources return. Compare weak resource identities while retaining scene/light identity fences. Fog/environment round-trip regressions eliminate the redundant build; real replacements still refresh. Chromium comparison pending. | in flight (2026-10-25, sp-x1; source cut ≤ 1 h) |
| G717.D1 | Driftwood spawn: pairing all acquired variants eagerly queried still-linking programs (147.1 ms of the Chromium 250 ms worst frame). `997273e20d` resolves only the selected variant, preserving every pairing and error check. Chromium original ALL before/after: p95 100 → 50.1 / max 250 → 66.7 ms; both complete/errors 0. Diagnostic only; remaining admission work is D2. | done (2026-10-25, sp-x1) |
| G717.D2 | Attribute and cut the remaining Driftwood spawn admission/parser frames (26.9 ms sampled cost projection in the worst remaining 66.7 ms interval). Preserve complete costs, validation and reads. At most one hour per source cut. | in flight (2026-10-25, sp-x1) |

## G717 entry-look cuts (2026-10-25, sp-x6; G639)

Each slice is at most one hour. Keep the Chromium phone4x entry/look/leave
gate unchanged; diagnostics identify callers and do not qualify as passes.

| Slice | Work | Status |
|---|---|---|
| G717.L1 | Night Market entry: retained 300.1 ms miss; independent diagnostic 350 ms. Mesh entry validation accounts for 205 ms inclusive in a second, browser-overlapped diagnostic. Disjoint triangle bounds preserve exact clearance, continuous ground and wire admission. Actual 64-chunk / 32,585-triangle kernel median 22.31 → 1.87 ms (21 alternating pairs); unchanged entry gate pending landed-source preview. | in flight (2026-10-25, sp-x6) |
| G717.L2 | Attribute and fix Signal, Nalati, Sky, Alien and Thin Ice entry-look misses, one measured cause per bounded source cut. | open |

## Why it never completes today

At ruler ed51b1446 every shard passes four of the six M2 criteria (baked tiles, edge profile, four entries, HUD accent).
`memory` and `oneFrameLooks` are `unknown` for all ten, and always will be under the current rule:

1. **Exact-SHA receipts.** `scripts/grid-runtime-evidence.mjs:40-60` only accepts an iOS Simulator receipt whose source
   SHA equals the ruler's revision (`source!==revision → continue`). Main moves about 40 commits an hour, so by the time
   a Simulator run lands its receipt, the ruler measures a newer HEAD and the receipt no longer counts. Pastel-plain and
   ink-cel-valley did pass 6/6 once (O9), then fell back to unknown on the next commit.
2. **Only the Simulator can supply them (today).** `memory` needs a native WebContent + GPU reading (soak or milestone receipt
   with `measurement: native-footprint+gpu`); `oneFrameLooks` needs a Simulator entry/look/travel receipt. Simulator
   time is the scarcest resource on the machine (G549).
3. **The memory cap was read as a page total**, not per shard (fixed by G556).

## Rows

| Row | What | Code | Effort (est.) |
|---|---|---|---|
| **R1** | **Done (2026-10-21, sp-x1): `5615bf9d46`, pushed `f762cfebc9`, four O9 memory/look criteria latched; focused tests and full carrier gate green. One pass, then latched (G560).** A shard's `memory` / `oneFrameLooks` pass is recorded once (shard, criterion, receipt SHA) in a committed latch file and counts on every later revision: no expiry on commits, checksums or source changes. Pastel-plain and ink-cel-valley latch now from their O9 receipts (`2fc35330d3`, `cb025a094a`). A latch is removed only by hand when a real regression is found. The ruler prints the latched receipt for each criterion | `scripts/grid-runtime-evidence.mjs:40-90`, `scripts/shard-milestones.mjs:66`, a latch file under `progress/shard-platform/` | 0.5 day |
| **R1b** | **Done (2026-10-21, sp-x1): qualified phone-profile/CDP guards and maintained route driver `df58ee81b0`, pushed `f762cfebc9`; full local gate green. Chromium / agent-browser evidence (G559)**: `oneFrameLooks` and `memory` accept a headless Chromium or agent-browser receipt (phone tier, iPhone 16 Pro profile, 4x CPU throttle, muted) as well as a Simulator one: the look/travel windows with no frame over 200 ms and no context loss, and memory as the shard's own peak from the game's residency accounting plus the browser's process/GPU memory over CDP, against 1.2 / 1.8 GB. The driver now emits `surface: 'chromium'` with its observed phone profile and separate CDP samples | same files + the frame-floor / soak drivers' Chromium path | 0.5 day |
| **R3** | **Verified, awaiting carrier push (2026-10-21, sp-x1; GR3). Official ruler `21af61480b` reads 6/10 playable shards and 15/15 plots. Template 1 quiet entry/look/leave worst frames 166.7/50/116.7 ms pass; its final latch and all prior measurement numbers live in `grid-ready-latches.json`. Signal, Sky and Lantern retain `quiet:false` passes. First batch (G560): Template 1 (`_template`), Template 2 (`blender-template`), Signal Dunes, Sky Reach and the 15 open plots; each pass latches** (Jake: *"Simple ones like the template 1 and 2 should be super quick to get grid ready right"*): native, no custom code, already 4/6, small worlds. One Chromium run (`scripts/browser-lane.sh`, no Simulator, G559): grid entry into each, look and travel windows, leave, and a native memory reading while each is the entered cell; measurement numbers committed inline in each latch, with the measured source SHA. Each pass latches (R1) | `scripts/browser-lane.sh`, the frame-floor / soak drivers | one run, minutes |
| **R4** | **Verified (2026-10-21, sp-x1): official ruler `21af61480b` passed in 70 s wall / 21.35 s build, normal priority.** Read the ruler: with the two latched from O9, **M2 shows 6 of 10** (Template 1, Template 2, Signal, Sky, pastel, ink) plus the plots. If either fails, fix that one finding (a frame over 200 ms, a memory peak over the shard's cap), re-run once | per finding | 0.5–1 day |
| **R5** | **Repeat as a batch:** one Chromium run per build measures several shards in a row (Pine, Driftwood, Nine, Nalati, as each is ready); every pass latches | any lane, through `browser-lane.sh` | one run per batch |
| **R6** | The `frameFloor` criterion stays a separate, reported line; it does not block M2 (coordinator ruling X0, 10-20) | | |

**Done when** the six zero-custom shards and the plots read 6/6 and stay latched. Then R5 takes Pine, Driftwood, Nine and Nalati, each only after it reaches zero custom (G561).
GR3 acceptance ruling (2026-10-21, coordinator): a qualified Chromium pass under machine load may latch, with `quiet:false` recorded in its latch and receipt. Load can only worsen cadence; a non-quiet miss stays unconfirmed and needs a quiet repeat before it becomes a failure. Profiling still supplies no acceptance credit.

No Simulator in this plan either (G559): the Simulator only reproduces what Chromium can't. Jake's iPhone is not in this plan: the phone check is SHARD-PLATFORM's final row at 99 % (G558).
