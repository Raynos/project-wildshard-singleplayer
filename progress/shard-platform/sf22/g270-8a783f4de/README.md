# SF22 G270 crossroads: FAIL, with timing under recorded load

Pin **`8a783f4deb64ed4a0f4ce69e6bf5ed02b222f368`**, build `8a783f4-mv1k9wn0`, 2026-10-09. The Chromium runner completed one cold six-cell circuit and closed its browser/preview. **Runner rc 0 is not a gate pass.** Cadence and crossing installation fail their unchanged limits. This is the desktop/Chromium portion requested by the coordinator; M2 phone memory and three-run tab survival remain **G269 phone runs**, not a Simulator or Chromium pass.

| Gate | Recorded result |
| --- | --- |
| Every G270 public cell entered; real source → road → destination commits | PASS, six routes, ready resident sims; retired native sources and their sim claims absent |
| Admission refusals | PASS, 0; no live issue or session refusal |
| Holes/falls | No sampled fall; minimum feet y = +0.0089 m, valid finite motion on every route |
| Errors / document recovery | 0 game or journal errors; original document retained |
| Cadence p95 ≤33.3 ms | **FAIL: 33.4 ms**, 7,936 drawn-game-frame intervals; both road standing samples also 33.4 ms |
| No shader compile at first crossroads | 0 WebGL2 `compileShader` calls during the first intersection vicinity traversal, with 1 s padding; limited to that observed window |
| Hybrid installation ≤33 ms | **FAIL**, table below; template data install is unmeasured by the hybrid hook port |
| Physical phone memory ≤1.0 GB / three runs without tab kill | **G269 phone runs — open**, not measured here |

The normal phone cap is 30 fps. The raw 33.4 ms p95 remains a failure against the exact 33.3 ms gate, including its sub-millisecond timer quantization sensitivity; no rounding or tolerance change is applied. Frame intervals include explicit install pauses: the 78.65 s maximum drawn-game-frame gap is **not** a 78.65 s main-thread task.

| Real-input route | Load median (range) | Frame p95, ms | Destination model, MB |
| --- | --- | ---: | ---: |
| Driftwood → Pine | 15.50 (13.62–21.17), under load | 33.4 | 714.61 |
| Pine → Nalati | 19.30 (16.60–22.91), under load | 33.4 | 754.83 |
| Nalati → template-2 | 14.34 (13.33–16.60), partly under load | 33.4 | 548.70 |
| template-2 → Sky Reach | 17.33 (13.87–21.57), under load | 33.4 | 696.12 |
| Sky Reach → Signal Dunes | 14.62 (12.83–15.45), partly under load | 33.4 | 598.04 |
| Signal Dunes → Driftwood | 13.40 (11.90–14.11) | 33.4 | 870.53 |

Load >15 is marked under load for those portions, as requested. Whole browser run load median 16.08, range 11.90–23.25. Destination model figures are **allocator predictions at endpoints**, not physical memory or continuous peaks. Pine's generic sky entry reports drawn at full weight; the Nalati/template generic sky table is empty, so this is not a visual-sky parity claim.

## Crossing wait owners

| Entered native shard | Install hook span, s | `world`, s | `afterKit`, s | `play`, s | `afterPlay`, s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pine | 78.613 | 50.110 | 18.686 | 4.149 | 4.390 |
| Nalati | 42.068 | 29.465 | 9.367 | 1.715 | 1.457 |
| Sky Reach | 45.551 | 44.568 | 0.001 | 0.061 | 0.862 |
| Signal Dunes | 4.562 | 3.773 | 0.043 | 0.046 | 0.643 |
| Driftwood return | 17.865 | 16.729 | 0.098 | 0.039 | 0.971 |

These spans run from `beforeWorld` to completed `afterPlay` and include inter-hook yields. Cold 5 Mbit/s plus explicit 3/10 s asset stalls differs from the earlier unthrottled Pine 14.6 s / Nalati 13.4 s reading; the numbers are not an A/B speed comparison.

The defining owners at this pin are:

- `src/shards/pine-hollow/runtime/index.ts:66`: native world steps (grass/undergrowth, cabins/landmarks, props); the cold world interval includes their awaited assets. Its `kit`/`play` install Pine equipment, quest and combat services.
- `src/shards/nalati-grasslands/runtime/index.ts:44`: native world/props via `buildNalatiWorld`, geometry/voxel-AO bake loading and grass; its `play` awaits camp people.
- `src/game/grid/regionalWorld.ts:265` and `regionalRuntime.ts:229`: `afterKit` builds `AnimalManager` rigs and the trusted equipment factory before publishing gameplay.
- `src/game/grid/regionalRuntime.ts:284`: `afterPlay` restores continuation/binds equipment/constraints, sweeps the region look, then **awaits `Game.warmEnteredFrame`** (`src/engine/core/Game.ts:675`). `src/engine/render/precompile.ts` issues scene/shadow/post programs, awaits parallel links, resolves uniforms, fences texture uploads and draws the composer. This is the shared owner of the post-install readiness wait; its wall duration is not CPU duration.

Chromium reported 55 long tasks >50 ms for the document, 35 during routes; the largest was 1,842 ms. Recorded overlap with a short `beforeWorld` hook does not prove that hook caused the entire task. Unmatched tasks stay unattributed; the scalar summary retains the largest overlaps. No guessed CPU charge or fix is claimed.

## Protocol and evidence

Developer **off**, exact six-cell public G270 catalogue (Driftwood, Pine, Nalati, Sky, Signal, template-2), owned page shell, live clock, ordinary Auto textures, Memory saver off, **no compressed override**. The GPU probe accepted ASTC/ETC2/BPTC/S3TC; Auto selected KTX2. Muted Chromium ANGLE Metal / Apple M5 Max, iPhone 16 Pro 402×874 viewport at 2× rendering. Fresh context, service workers blocked, CDP 5,000,000 bit/s; 18 actual stalls (nine 3 s, nine 10 s). The existing route driver seeds only the first approach, then uses held input and the ordinary 30 m/s road hover limit. Two 10 s standing cadence samples are seeded only after all real crossings.

No screenshots, look changes, source changes or Simulator acquisition. The initializer adds the existing `{seed:357,capture:null}` harness pins and a bounded 250 ms state/hook read; drawn-frame and long-task observers are diagnostic. Route/plan helpers match the pinned tree. [summary.json](summary.json) records scalar gates, per-route load, hook spans, probe and helper hashes. [attempts.json](attempts.json) retains the initial pre-route harness failure (missing pose pins), not a game failure or gate verdict.

Detached proof `20261009T174735-sf22-g270-pins-54433`: 905 s including queued clean build, 554.9 s browser measurement; own :4404 stopped in `finally` and no listener remains. Raw journal is local only at `/private/tmp/claude-501/sp-builders/sp-x5/sf22-g270/result.json`; no raw archive is committed. Launcher and read-only analysis remain in that scratch folder for this single proof. The coordinator owns follow-up rows and the push; no gate is closed by this receipt.
