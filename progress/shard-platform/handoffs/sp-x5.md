# sp-x5 handoff — 2026-10-08

SF67 / E461 loading sprint. Coordinator wildshard-new owns the push and plan edits.
Never message wildshard-v. The matched Simulator Safari cohort is complete and all owned resources are released.

## SF70 format — landed36c03f7ba

Ranged / bow / thrown item context profiles are strict declared data. Optional
items.runtimeContexts references already registered contexts only when runtime.binds
includes items; the scoped installer preflights every reference before constructing
families. Trusted ItemFamily.presentation preserves native UI / cues / hitStop /
rangedFeel while declared identity, slot, context, name, icon and swap glyph win.
No new projectile sim or shared script lane. Omitted fields preserve the melee path.
Pine fit: swapIcon accepts512 chars verbatim (existing159-char longbow tested);
runtimeSpawns.kind accepts hyphens, preserving antler-king, with its64-char cap and
existing trusted runtime species admission. Both bounds have full-schema tests.
No render, map-hash, generated files or new import edges changed.

Validation candidate: clean21fc15142 plus owned patch, pnpm gen before checks.
25 focused tests in4 files, root strict, root-config oxlint and ratchet pass.
Heavy-lane clean full suite:935 files /5364 tests passed /14 skipped in131.51s.
The source lands with hooks, current-HEAD private index and old-value CAS.
Only own hunks are included, especially the10-line ENGINE manual addition; foreign
ENGINE appendix and runtime-state work remain untouched. Coordinator owns pushes.

## Runtime-state format —245591848 composition

The sole RuntimeSchema already admits state through runtime.binds; no parallel
runtime.state payload. Full schema now refuses bound player/public/owner fields,
matching the existing installer fence: only host-owned shared fields, with ordinary
stable IDs, typed defaults, bounds, capacity and4096-character strings. Unbound
simulation state remains unchanged. SHARDFILE.md documents all5 sections, scoped
bindRuntimeState, stable placement ids, per-field legacy initialization, migrations,
invalid-value/disposed/future fences and save-result handling.

21 focused tests in3 files and root strict /root-config oxlint /ratchet pass.
Clean245591848 plus own patch, committed5876 linker, pnpm gen before checks.
Heavy-lane full:937 files,5379 passed/14 skipped, only stale AG7 failed
(game->engine757->759 from the landed port). Per coordinator policy, regenerated
only the export graph and reran arch-guards:111/111 pass in40.48s. Full-source
run188.96s; no generated working-tree edit or full requeue for unchanged source. Only schema/docs/full-schema fixtures plus one
runtime-state test hunk (typed invalid source bypasses full admission to test the
low-level defense) are owned here. No runtimeState/hybridRows/runtimeBinds edits,
new graph edges/debt, generated files, rendering or map-hash changes.
Current-HEAD private index/hooks/old-value CAS required; coordinator pushes.
No browser, Simulator, preview or build is held. Safari CPU attribution remains
blocked below; no new graphics work or protocol experiment is queued.

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

## Format / source handoff

Safari receipt a430e9ae470112973e8be7a06243eccf40dfbbeb and the explicit release
were relayed to the coordinator. Signal Dunes chip source40aa26ece and docs2e4a9ecfa
keep the18-character cap, declare the17-character “Light signal fire” and remove
the runtime override. Actual QuestState chip: 2files/12tests and typed lint green.

This format follow-up covers e9c0c5945 runtime.binds. RuntimeSchema already composes
its sole strict RuntimeBindsSchema at schema.ts runtime; no duplicate validator or
changed default/trust policy. Full-schema tests now cover omitted/empty/all-three,
unknown/duplicate/oversized/malformed binds, unknown runtime keys, unchanged bound
quest validation and external/cached runtime refusal before fetch/publication.
SHARDFILE.md documents ownership, admitted rows retained, data-client installation
filtering, explicit scoped installers, item family/input rules and runtime trust.
Two focused files / 11 tests and scoped typed lint pass. Coordinator owns the push.

Runtime-spawns follow-up for 0f30825c9: the same RuntimeSchema enforces rows present
exactly when binds names spawns. Full-schema tests cover all four bound sections,
absent/unbound/null rows, strict fields, native coordinate and refill bounds,
256-home/16-boss limits, shared unique identities and external/cached refusal.
SHARDFILE.md now documents the fourth section and scoped home/boss installers.
No new import/graph edges, generated edits, rendering changes or map-hash inputs.
Clean export of 5cdf7baae plus the owned schema/docs/test patch: pnpm gen first,
heavy-lane full vitest 933 files / 5357 tests passed / 14 skipped in 149.70 s;
root-config pnpm exec oxlint and node lint/ratchet.mjs pass with no new debt.
Focused runtime-format + Signal Dunes hybrid rows: 2 files / 15 tests pass.
Only owned hunks land through a private index rebuilt from current HEAD with
hooks, old-value CAS, subject/stat and ancestor verification. Coordinator pushes.

## SF67 Safari CPU attribution — blocked; lane idle

No demonstrated non-zero CPU clock exists in the tested Simulator Safari route.
Read-only recheck of the archived safari-smoke-r2 raw events confirms after-cold
8248 startTime / 6472 endTime / 3362 sample timestamp values are all0; after-warm
5807 / 4680 / 2503 are all0. Timeline emits records and ScriptProfiler emits stacks,
but neither can give task durations or correlate an owner to a freeze. LongTask
observer is unsupported. scripts/soak/inspector.mjs forwards parsed raw event
params unchanged; it does not zero these fields. The audit's independent sim.mjs
reports the same limitation. Raw proof is committed in progress/loading/sf67/safari/safari-smoke-r2.tar.gz
with member hashes in its manifest. No new browser/Simulator was started to repeat it.

Reopen only after a protocol route first demonstrates non-zero monotonic task/sample
clocks that can be joined to the loading document. Do not call missing tasks zero,
substitute rAF gaps, or treat the desktop Chromium CPU trace as Safari attribution.
Coordinator assigned Driftwood/Nalati >100ms builders to Opus sf67-bake2; those are
not this lane's next step. SF67's ~100ms target and physical-phone evidence stay
open. Per coordinator instruction, sp-x5 now goes IDLE; no owned preview, browser,
Simulator, Inspector, build or suite remains, and no new acquisition is queued.

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
