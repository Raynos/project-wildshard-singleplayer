# sp-x1 handoff — 2026-10-08, Codex throttle

Idle after this commit. **No owned browser, Simulator, sampler, Inspector or preview remains.** The SF64 preview reservation :4402 and own wrapper/build were terminated before capture; the reservation is gone. No RAM attribution result was collected. Coordinator owns pushes/generated outputs.

**Done (local main; coordinator owns push status):**

- `81888d1c4`: SF64 weak allocation ledger, native GPU storage identities, CPU buffer/image/audio/WASM inventory, scalar `__wildshard.memory()` v1. Exact storage/capacity is distinct from physical resident RAM.
- `619c87c4f`: renderer-free defining API `@wildshard/engine/core/memoryAttribution`; cuts the template sim closure render edge. `d5ac76cf0` clean committed ratchet witness: no sim-no-render debt.
- `8ecc29759`: extends the EXISTING Developer MEMORY chip in place, preserving old accounted / PLAYING / LOAD lines and placement; expanded GPU/RAM owner/asset sorting, smaller-row subtotal, explicit observed-unattributed bytes and native provenance/unavailable. No ninth tool or separate panel. Four overlay tests + scoped strict/typed lint green.
- This commit: optional `--allocator-trace` on existing `progress/memory/g227-budget/webkit-centre.mjs`; same-process passive native categories/maps before and after the existing paused-frame heap collection, worker heaps retained separately, PID/document fences, unsupported/errors explicit. Two PID/native-map helper fixtures + typed lint/syntax green. Browser integration is UNPROVEN; the queued preview was stopped under throttle.

**Open / exact next step:** SF64 priority is the 340–460 MB historical unowned resident RAM, not more UI. After coordinator approval, build a current clean pin (heavy lane), then ONE muted desktop WebKit/browser-lane capture:

```sh
scripts/browser-lane.sh --max 20 node progress/memory/g227-budget/webkit-centre.mjs http://127.0.0.1:PORT OUT/pine-paused.json pine-hollow on --allocator-trace
```

Keep preview + capture in one live wrapper, close both in finally. Read saved native before/after maps, worker heaps, main heap dominators and exact heapOwners. PID selection refuses ambiguous WebContent processes; unavailable maps remain unavailable. Worker decoder heaps are a hypothesis for the unidentified ~16.8 MB module, NOT an attribution finding. Never sum heap capacity with native footprint or infer physical owners from equal sizes. Heap/GC can alter footprint; preserve before/after and distinguish live storage from freed-but-kept pages. Native Simulator WC+labelled GL stays the cap ruler. Existing analyzer `progress/memory/g227-budget/analyze-heap.mjs` checks its WebKit algorithm SHA.

**Seams:** x2 report/capture uses `619c87c4f` scalar API; `inspect.mjs` captures it automatically (`4da5ae9c2`). Report and native evidence keep WC/GL, allocator accounted and observed storage separate. x5 released the webkit-centre heap block. No liveSession edits owned here; sp-x3 released it after `f1918525` hover stow fix. SF45 remains paused by coordinator.

**Scratch worth keeping:** `/private/tmp/claude-501/sp-builders/sp-x1/sf64/` contains `run-paused.mjs` (build+capture+finally stop wrapper, old pin 8ecc; UPDATE pin), focused tsconfig, clean-ratchet.json, landing scripts and panel-strings.json. Partial preview export `preview/20261008-105323-4402` may remain after cancellation; no server/listener. Do not use that incomplete build. No fresh heap evidence exists there. Historical owner references: `progress/memory/itemized-2026-10-08/`, `progress/memory/g227-budget/`.

**Authored abandoned WIP — DO NOT SHIP:** separate-panel prototype was never committed/wired. Four untracked files remain: `src/engine/ui/memoryPanel.ts`, `src/engine/ui/memoryRows.ts`, `src/engine/ui/styles/memory.css`, `test/engine/memory-panel.test.ts`; only their `s_memory_debug_*` strings remain as an uncommitted hunk in `src/engine/strings.ts`. Targeted deletion was rejected by the automatic destructive-command guard; no workaround attempted. Manual cleanup required (exact strings in scratch panel-strings.json). These compile but are excluded from every private candidate; current debugOptions/check-css have no prototype wiring. Preserve other lanes' edits.

Plan-State: unchanged. No further browser/Simulator/full-suite work under throttle.
