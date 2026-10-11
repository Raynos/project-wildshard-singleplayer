# Travel cadence and template readiness (E435)

**RED: desktop travel passes; Simulator template travel remains open.** Template pin `1f41fd31a` completes with no Pine world; outbound still misses the gate at 37 ms. Nalati was last measured on `63560cdb9`. [summary.json](summary.json) retains every attempt, scalar validity and gate assertion.

| Surface / route | Baseline → latest travel p95 (ms) | Latest drive p95 / max (ms) | Drive >50 / >100 ms | Interior p95 (ms) | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop Nine | 33.4 → 16.8 | 16.8 / 66.7 | 3 / 0 | 16.7 | PASS |
| Desktop Nalati | 33.4 → 16.8 | 16.8 / 83.3 | 4 / 0 | 16.7 | PASS |
| Simulator template outbound | 58 → 37 | 34 / 80 | 2 / 0 | 34 | FAIL: travel |
| Simulator template return | 55 → 35 | 34 / 228 | 6 / 1 | 34 | Travel PASS; drive maximum FAIL |
| Simulator Nalati | 66 → 35 | 35 / 207 | 7 / 1 | 34 | Travel PASS; drive maximum FAIL |

Desktop pin `0c9619149`; template Simulator pin `1f41fd31a`, Nalati pin `63560cdb9`; baseline `1046bba3d`. Desktop p95 ≤17.5 ms and maximum ≤100 ms; Simulator p95 ≤35 ms and maximum ≤200 ms. The Simulator's 30 fps cap makes 34–35 ms normal vsync jitter. Valid drawn frames, rounded median ≥60/30 fps, owner CPU pass and zero errors remain required. The latest template Simulator initial spawn passes at 35 ms; other standing poses pass at 34 ms. Nalati's 207 ms maximum remains with the shader-stall lane. No full-grid milestone pass is claimed.

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

## Conditions and limits

Auto fps, Developer ON/DEVSERVER catalogue, build pacing ON, live clocks, 2× scale. Credited runs use no CPU profiler or GL observer. The latest template Safari run completes in 233.9 s; the prior combined Nalati run in 285.196 s; desktop in 109.9 s. Every completed sample has positive drawn frames, zero skipped frames, owner CPU pass and no context loss/errors. Quiet windows wait for the pusher, leave a two-minute gap and release owned previews/Inspector/Simulator helpers. Other lanes landed between pins: this is a targeted regression comparison, not an isolated native A/B. Simulator Safari is Mac-backed, not a physical phone. Incomplete attempts retain their stop evidence and receive no timing credit. Raw reports remain in scratch; only scalar summaries are committed.
