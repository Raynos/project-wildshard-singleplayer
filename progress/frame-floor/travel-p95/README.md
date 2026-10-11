# Travel cadence and template readiness (E435)

**Target travel PASS; broader frame floor RED.** All three Simulator travel rows are 34 ms on `f71faa702`. The template save regression is fixed and entry/return complete. Spawn p95 39 ms and a Driftwood return maximum 252 ms remain independently RED. [summary.json](summary.json) retains every attempt, scalar validity and gate assertion.

Follow-up: [spawn/return residuals](../spawn-return/README.md) validates the actual boot spawn at 34 ms and Driftwood return at 131 ms; the old 39 ms spawn row was displaced. The full Simulator route still fails independently at outbound 277 ms. Historical numbers below stay intact.

| Surface / route | Baseline → latest travel p95 (ms) | Latest drive p95 / max (ms) | Drive >50 / >100 ms | Interior p95 (ms) | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop Nine | 33.4 → 16.8 | 16.8 / 66.7 | 3 / 0 | 16.7 | PASS |
| Desktop Nalati | 33.4 → 16.8 | 16.8 / 83.3 | 4 / 0 | 16.7 | PASS |
| Simulator template outbound | 58 → 34 | 34 / 99 | 14 / 0 | 34 | PASS |
| Simulator template return | 55 → 34 | 34 / 252 | 7 / 3 | 34 | Travel PASS; drive maximum FAIL |
| Simulator Nalati | 66 → 34 | 35 / 86 | 10 / 0 | 34 | PASS |

Desktop pin `0c9619149`; Simulator pin `f71faa702`; baseline `1046bba3d`. Desktop p95 ≤17.5 ms and maximum ≤100 ms; Simulator p95 ≤35 ms and maximum ≤200 ms. The Simulator's 30 fps cap makes 34–35 ms normal vsync jitter. Valid drawn frames, rounded median ≥60/30 fps, owner CPU pass and zero errors remain required. The latest Simulator spawn is independently RED at 39 ms; crossroads and east-deck standing poses pass at 34 ms. The return-drive long-frame gate is RED at 252 ms, with three frames over 100 ms. Shader-link stalls remain with sp-x2; this run does not identify the cause of every between-hook frame. No full-grid milestone pass is claimed.

## Template wall: real saved-game regression

DIR-3 (`256a71405`) added `director.template.door-wave` without advancing the template's revision. Safari retained an exact revision-1 native checkpoint with the old registrations. Admission correctly refused `Snapshot instance registrations do not match`, leaving current/inside null at `(298.35, 0.37, 555.07)`. This was not a collider seam.

`63560cdb9` advances to revision 2 and uses the existing validated logical migration. Five real-native checks preserve door state, completed quest, tick, purse and pack, install the new director and repeat no rewards. Old save bytes remain until a successful checkpoint; integrity, exact-registration and future-revision guards stay intact. Its official clean-candidate map bake is 1000px / 26,954 bytes; scoped strict and touched lint pass. **Safari now enters template-2 and returns to Driftwood on that retained save**, with one entered resident at each endpoint, no admission issues, errors or context losses.

Independent fixes found during isolation:

- `462698465`: await pending speculative materialization before retiring its late exclusive runtime and creating the destination. Real-Rapier delayed-Pine and northeast-template fixtures pass; failed checkpoint preserves the source and full charge. 29 focused checks, strict and touched lint.
- `f8050360e`: stage a cold source on its solid midpoint road and enter with real input. Seeding an unloaded interior on bodyless road physics let recovery move the player before readiness. Subsequent legs never reseed; document fencing and failed-save refusal remain. 27 focused checks, strict and touched lint.
- `ec6e98463`: copied family materials inject horizon uniforms once and bind the current owner. Safari shader errors fell 5 → 0, but the wall remained until the revision fix. Two focused checks, strict and touched lint.

## Travel cost and generic fixes

Travel measures the first 120 drawn frames one second into the drive. It overlaps construction; there is no separate fast-travel camera. Desktop Nalati CPU/GL profiling found painting (199.3 ms inclusive), vertex shading (161.9 ms inclusive) and terrain sampling (103.3 ms self) within 2383.2 ms. These overlap and must not be added. Safari's 855 profiler samples had zero timestamps: noise 66 self samples, trail distance 47, outcrops 135 inclusive are shares, not durations. Five slow world frames peaked at 129 ms with only ~1 ms recorded GL calls.

`2cd537f76` / `f57553bec` anchor to real rAF/cap cadence. `0c9619149` shares quarter-frame construction budgets and resumes scoped MessageChannel tasks after paint; `dbb89458d` bounds that budget to 4.17 ms even under a 30 fps cap. `f4b7bd941` forwards the cap's recovered deadline after late rAF. Pacing OFF keeps ordinary hops; uncapped cadence, cap law, content, quality and 2× scale remain. 31 scheduling checks plus 16 cap/deadline checks, strict and touched lint pass. Nine admission/drive time increased 2.45/4.58 → 5.07/7.25 s; Nalati 1.25/5.03 → 1.63/6.02 s. `11e943f35` computes the exact minimum squared trail distance then one root (100 → 1 roots for 100 segments); 10k-point exact oracle plus edge cases, nine checks, strict and lint pass. No isolated Simulator credit is claimed for individual changes.

The latest template hooks build Pine on each boulevard departure, then retire it when the traveller turns before the road midpoint. `b7b921a65` defers native world materialization to the destination half of the road; radial product/module prefetch keeps its full network reach. Readiness walls, exact claims, save/quota refusal, recoil and U-turn protection remain. A real-native corner fixture builds only the eventual destination. Fixture correction `1f41fd31a` explicitly requests its early product under the one-candidate limit. 27 focused checks, strict and touched lint pass. Plain Safari corroborates zero Pine constructions, entered template and home residents, and travel 46/44 → 37/35 ms. Outbound drive maximum falls 154 → 80 ms; return has a new independent 228 ms between-hook maximum. Outbound travel remains RED: its platform CPU p95 is 3 ms, game work p95 10 ms, and drawn/callback cadence p95 37/40 ms. Further attribution is required.

## Residual upload attribution

The outbound-only Safari diagnostic on `1f41fd31a` sampled 396 stacks (all proxy timestamps zero). `texSubImage2D` accounted for 22 self samples (5.6%); counts are shares, not durations. GL timing separately records 37 slow **1024×640 canvas** updates totalling 148 ms across the drive. They are the existing cell-screen textures. No Pine world is built. Diagnostic travel p95 is 34 ms, but receives no timing credit; its drive maximum remains independently RED at 220 ms.

`f71faa702` paces subsequent screen reuploads after paint under the existing shared quarter-frame construction budget. Initial appearance and pacing OFF retain the ordinary draw upload. Coalescing keeps the latest original canvas; no bitmap, pixel conversion, rescale, content reduction or refresh-rule change. Slot disposal cancels queued frames/tasks. Twenty-one focused screen/pacing checks, scoped strict and touched lint pass. Game→engine rises by two downward imports (frame pacing and renderer type). Plain Safari corroboration on `f71faa702` completes all three targets at **34/34/34 ms travel p95**; each endpoint has the required entered/inside ready resident, no pending admission and no issues. Scope recovery guard `35ff09f34` adds no uploads while the context is lost; the same 21 checks pass. It does not change the measured healthy-context path. No quality or scale reduction.

## Conditions and limits

Auto fps, Developer ON/DEVSERVER catalogue, build pacing ON, live clocks, 2× scale. Credited runs use no CPU profiler or GL observer. The final combined Safari run completes in 288.409 s; desktop in 109.9 s. Every completed sample has positive drawn frames, zero skipped frames, owner CPU pass and no context loss/errors. Quiet windows wait for the pusher, leave a two-minute gap and release owned previews/Inspector/Simulator helpers. Other lanes/source and harness changes landed between pins: this is a targeted regression comparison, not an isolated native A/B. The earlier 37 ms outbound sample remains recorded; the profiled 34 ms sample receives no credit. One caller selected `all` instead of `milestone`: the missing-route guard refused before travel; that incomplete attempt also remains recorded without credit. Simulator Safari is Mac-backed, not a physical phone. Incomplete attempts retain their stop evidence and receive no timing credit. Raw reports remain in scratch; only scalar summaries are committed.
