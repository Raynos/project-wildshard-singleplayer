# sp-x5 handoff — 2026-10-08

SF67 / E461 loading sprint. Coordinator wildshard-new owns the push and plan edits.
Never message wildshard-v. Simulator Safari is now authorized via sim-lane behind sky-mem; no timing claim until the matched captures finish.

## Landed source

- E458 `6aadc5dfb` / `f4f9eb73e` / `414a98ad7` / `b0ad0641c`: first-HTML fields/clock, typed admission, verified warm cache without repeated writes. Pushed through `b7c71be8a`; E458 closes with the receipt.
- SF67 fix 1 `443f4831b`, foreign-hunk correction `fcc79ea28`: lazy ordinary fingerprint; explicit pinned harness eager snapshot preserved.
- Fix 2 `165287a41` + `11da76006`: counted slicer builder progress, Building the world independent of audio/extras; hybrid forwards the sink.
- Fix 4 `7c4a98e2e` + `62c426f46`: exact build-owned/hash/version validation and cost receipts, current memory policy rechecked, immutable hashes never skipped; dependencies invalidate receipts. Cartridge inventory forward `34fece188`.
- Fix 6 `ab179b6fb`: GPU journal Developer / explicit census only, restore native calls on retirement.
- Fix 9 `6f4490e83`: first live physics tick capped to one after loading; later bounded catch-up unchanged.
- Benchmark `8a823cb41` + gate path forward `ea8634804`: reusable tools in `scripts/loading-benchmark/`; progress contains reports/evidence only. Never import test code from progress (excluded from the gate tree).

## Evidence and result

`progress/loading/sf67/README.md`, strict before/after `loading-benchmark/1` reports,
and hash-checked gzip evidence. Real SHARD SELECT at 4× CPU, muted Chromium/Metal,
iPhone 16 Pro portrait emulation. All 16 matched cases playable. Template tap-to-playable
cold 5.794 → 5.380 s; warm 4.967 → 3.138 s; cold max task 755 → 305 ms.
Other cold deltas mixed: no aggregate saving claim. Remaining cold tasks include
Driftwood 733 ms, Nalati 1207 ms, Pine 263 ms. ~100 ms target remains OPEN.
Local telemetry 404s are preserved; game exceptions/load failures zero in this cohort.
After timing pin is `6f4490e833fabf317d81578508983f96d118ca26`; later hybrid forwarding
and dependency guards are not measured speedup claims. Prior exploratory/rejected
harness observations are archived separately, not pooled into matched numbers.

## Simulator Safari receipt / resources released

`progress/loading/sf67/safari/README.md`: 56/56 timed entries playable, all seven
shards, two independent AB/BA cold + same-tab warm pairs each. Before19e647272 /
after6f4490e83 match Chromium. Template cold median6.856→5.429s; warm3.558→3.263s.
All capture-start loads >30; n=2 medians/ranges are descriptive, no per-fix causal
speedup claim. Strong first-arm cold shader/initialization cost on both revisions.
Safari LongTask unsupported / pilot Inspector timestamps zero: CPU tasks remain
missing, not zero; frame gaps stay separate. Six initial Developer-OFF experimental
card refusals are preserved and excluded, corrected by6fe1dcd83. Both cohorts have
identical injected HTML hashes per arm. Strict before/after reports have28runs each.

FINAL RELEASE 2026-10-08T21:01Z: both owned devices deleted, sim0/1, no owned
Safari/Inspector/proxy/browser remains. Exact original HTML hashes restored;
owned :4406 and :4400 previews stopped through serve-build. `safari/release.json`
is the cleanup receipt. No new Simulator/browser/build/full-suite work queued.
Coordinator was blocked during cleanup, so no prompt/keys were sent into its
question. It resumed and received release + Safari SHA. No resource hold remains.

## Exact next step

Safari receipt a430e9ae470112973e8be7a06243eccf40dfbbeb landed and was relayed
with the explicit final Simulator release to the working coordinator. Separate
Signal Dunes correction: keep18-character cap, declare the17-character “Light
signal fire” scout chip and remove the runtime override from e9c0c5945 hybridRows.
Actual QuestState chip is checked in the existing contract; 2files/12tests and
scoped typed lint green. Coordinator owns the serialized push of both commits. SF67 remains OPEN: the desktop ruler still
has >100ms tasks (Driftwood733ms/Nalati1207ms/Pine263ms); bake/worker/time-slice
follow-ups and physical-phone evidence remain. Fix3 is not assigned to this lane.

## Checks and scratch

Clean source64a1f0b4b passed927files/5326tests+14skips in121.37s through heavy-lane,
root strict and typed lint. Later tool controls pass3focusedfiles/6tests and full
root typed lint on scripts/loading-benchmark. Receipt converters validate all56
captures; five deterministic raw archives round-trip, each member hashed.
Docs/comments reconciliation8039db709, Debug-help613714fc6 already landed.
Never import test tools from progress (excluded by gate); reusable code stays in
scripts/loading-benchmark. HEAD+hunks only, private index/hooks/CAS/ancestor check.

Scratch `/private/tmp/claude-501/sp-builders/sp-x5/sf67/` holds analysis, raw captures,
logs and throwaway clean exports. Meaningful Safari evidence is now archived under
progress/loading/sf67/safari. Earlier recursive export cleanup was blocked by the
local command guard; no bypass. No live server/process remains in those exports.
Do not delete anyone else's working-tree/index WIP or edit generated API/graph/debt.
