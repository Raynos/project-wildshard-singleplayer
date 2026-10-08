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

## Exact next step

Finish the matched Simulator Safari cohort using `scripts/loading-benchmark/safari-matched.mjs`.
It uses one owned device, erased only while shut down between shard pairs, and the same
before `19e647272` / after `6f4490e83` pins as Chromium. Cold + warm use the real title,
card and ENTER flow; fixtures are in owned exported HTML only and restore exact bytes.
Unsupported Safari task events remain missing, never zero; rAF gaps are not CPU tasks.
Coordinator authorized the sim-lane queue behind sky-mem (no extra GO needed).
Fix 3 (bake code-built worlds) remains unassigned. Physical phone evidence is open.

## Resources / checks

Old :4412/:4413 previews are stopped. Current owned Safari pair:
- before :4406 `/private/tmp/wildshard-serve/20261008-144326-4406/dist`, exact19e647272;
- after :4400 `/private/tmp/wildshard-serve/20261008-144558-4400/dist`, exact6f4490e83.
HTTP/disk versions and listener/PGID verified. Stop both through serve-build after the
Safari cohort. No owned browser/Simulator at this commit. New Safari conversion,
fixture preservation tests (5/5), root strict and full folder typed lint are green.
Docs/comments reconciliation `8039db709`, corrected Debug help `613714fc6`. Full tests use the heavy-lane, no direct Vite or full Vitest.
Clean source pin `11da76006` passed full queued verification: 925 files / 5337 tests
in 106.86 s. The later gate-path forward has focused 2/2 green; this receipt fixes the full scripts
folder under root type-aware lint after that gate exposed script-only rules. Focused 24 boot/plugin checks and 9 benchmark/receipt checks passed;
root strict, scoped typed lint and check-paths passed. The earlier gate packaging red is
fixed by `ea8634804` (scripts path, focused 2/2).

Scratch `/private/tmp/claude-501/sp-builders/sp-x5/sf67/` holds transient analysis/logs;
clean export `/private/tmp/claude-501/sp-builders/sp-x5/sf67-clean/` is removed after checks.
Authoritative captures/analysis are committed under the receipt; raw 100 MB Chrome
traces are discarded after hashing and source-map analysis. Preserve shared foreign WIP;
land exact HEAD + owned hunks with hooks/CAS and verify subject/stat/ancestry.

Cleanup note: recursive deletion of the completed clean export was blocked by the local
command guard. It remains at the scratch path above with raw transient traces; all
servers/processes are stopped, and meaningful evidence is committed. No guard bypass.
