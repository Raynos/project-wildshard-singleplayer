# sp-x2 handoff — 2026-10-08, Codex throttle

Idle after this handoff. No source commit in progress, no owned uncommitted source, and **no owned preview/browser/Simulator/Inspector/sampler to stop**. Other lanes' `sf64-paused` processes belong to sp-x1; leave them alone. Coordinator owns pushes/generated outputs.

**Done, landed on main (push status belongs to coordinator):**

- `6f5ca1ae4`: byte-exact ≤50 MB bricks and shared-identity deduplication (`scripts/memory-report-blocks.*`).
- `b7f559d5d`: offline report command/data/portrait renderer + tests (`scripts/memory-report*.mjs` / `.d.mts`). `node scripts/memory-report.mjs --input=MANIFEST --out=NEW_DIR`; exit 2 writes an honest incomplete report, 1 rejects invalid input, 0 complete. Existing SDK sharp renders JPEGs, no browser.
- `4da5ae9c2`: optional getter-safe scalar owner capture in `progress/memory/g227-budget/inspect.mjs`, via `scripts/memory-report-snapshot.mjs`; old/accessor probes return null, never zero.
- `16c927650`: receipt/input/9 inspected portrait pages at `progress/memory/sf64-report/`; reuses the first `progress/memory/itemized-2026-10-08/` data, confidence and vmmap provenance. Native WC+GL, allocator raw accounted bytes and storage capacities remain distinct. Historical road 933.2 / Pine 1185.2 / Nalati 1101.0 MB are unchanged, not new-build grades.
- `fa0238f05`: approved exact capture protocol at `progress/memory/sf64-report/capture-plan.md`.
- `46d696223`: explicit Nine Dragon missing reason (not in grid catalogue); unavailable entries cannot hide supplied evidence.
- Validation: 11 focused tests, own strict JS/typed lint and root typecheck green at report landing. No full gate/build/native run for this slice.

**Open:** fresh Driftwood centre, a template-copy centre, Sky Reach centre, Signal Dunes centre, and a fully matched worst crossing; then regenerate report pages. SF64's resident-RAM ownership (<10% unknown target) remains sp-x1's work, not solved by subtracting WC or relabelling capacity estimates. Nine Dragon stays explicitly unavailable. Pine/Nalati historical pages stay mixed-pin until fresh evidence exists.

**Exact next step (Opus takeover):** implement and Node-test a report-only route/observer seam in the existing native harness. **Those new route modes/continuous observer are NOT implemented yet.** Follow the approved capture-plan.md: A real Driftwood local centre → template midpoint route → actual template centre → retired empty road; B existing Sky lift/bridge then actual central Sunrest ground (not bridge lip); C Signal socket then local `(0,0)` (not spawn `(0,70)`). Resolve actual catalogue instances/origins. Three fresh same-pose fixed-PID samples, same-pose labelled GL and optional x1 ledger; preserve failures. Worst crossing needs complete token/PID-fenced, ≤1 s WC/GL pairs and no timeline holes; missing peak stays missing. No mutation journal/heap/GC. Wait for coordinator's selected post-Pine-P0 pin and explicit Simulator queue handoff after sp-x4; do not acquire early.

**Seams / coordination:**

- x1 defining API `619c87c4f`: `@wildshard/engine/core/memoryAttribution`, `__wildshard.memory()` v1. Never import the superseded render path. Native `snapshotExpression` already captures `memoryAttribution` automatically.
- x5 owns E458/loading progress + a separate SF67 loading benchmark. Sent timing seam: public `game/shardfile/hybrid` → `HybridRuntimeSession.timings()` / browser `grid.state().live.runtimeTiming`; last 32 stages, page performance.now ms, wall intervals include awaits, paint pause occurs after recorded end. Commits `ec83f7423` + `4c2e78d04`. x5 has no planned inspect/native edits; coordinate exact hunks if needed.
- `live.ts` count fix is sp-x4 `abba21fc3`; no sp-x2 live/recovery/allocator WIP. Source ownership can transfer; preserve other lanes' hunks and use clean-HEAD private indexes with CAS old-value checks.
- Earlier AAC cohort closed in `5d6e1d41b` + `bb91db4b0`, `progress/memory/g227-budget/title-aac-native/README.md`: failure-inclusive 3 valid per side, native credit ZERO. No remaining audio work or owned servers.

**Scratch worth keeping:** `/private/tmp/claude-501/sp-builders/sp-x2/land-source.py` (private-index/CAS landing helper) and `.../sf64/` landing specifications. All report source/evidence/approved plan are committed; temporary first renders/contact sheet were deleted. Do not rely on scratch for native evidence.

Plan-State: unchanged. No new browser/Simulator/full-suite work started under the throttle.
