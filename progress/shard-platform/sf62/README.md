# SF62 performance guardrails and cold boot

E435 / G228–G231 / agent playtest round 2 item (7). Source is landed locally; the coordinator carries the serialized push. Browser observations use Chrome 153, ANGLE Metal, iPhone 16 Pro emulation, phone tier, DPR 2, 30 fps and muted audio. These are not physical-iPhone or Simulator measurements.

## What shipped

- `27417eabd`: category memory becomes warnings; complete 1.0 GB playing / 1.8 GB loading totals remain hard. Simulation reserves the larger authored/server amount; authored coarse excess and overlap remain accounted.
- `5a1731cd7`, `1b61a8121`, `364a554c1`, `173b1560e`, `b500535f6`: report-card model, real bounded 60-tick build observation, fuel/CPU, complete costs and CLI refusal for new/outside shards; trusted old-six warnings. Runtime admission totals remain hard.
- `4a12ce611`: opt-in content CPU meter; the frame-floor sampler/quarter-frame gate was carried in `a2410513f`. Disabled paths do not read diagnostic time. Core bootstrap and harness callbacks remain uncharged.
- `87679cfc7`: custom-runtime scanner plus atomic reviewed shrink-only 441-site / 626-violation inventory. New sites and outside projects receive no allowance.
- `126198368`: budget-first SHARDS / SHARDFILE guides and generated project README.
- `494c117db`: immutable assets fetch/hash in bounded four-file waves, preserving declaration order, deduplication, validation and publication atomicity.
- `cf464f3a2`: cache rounded native vertices within one seam certification column. All four grid modes, forty pieces each and all seven enumerable product seeds preserve complete geometry/index/colour/features/origin hashes. `test/grid-seam-cache.test.ts` and `test/grid-seam-adaptive.test.ts`: 9/9.
- `d2011d3bd`: prepare Brotli WASM bytes before the local preview listens. This corrects a measurement-server artifact, not production boot.
- `42962da4e`: warm shaders with the root scene lights/environment used by the real first frame; content-only caster chunking is unchanged.

## Cold boot breakdown

`browser.json` records the traces and their pins. Stage spans overlap fetch, decode and compile work, so they must not be summed as exclusive categories. DOM stage observations have roughly 50 ms granularity. Build report-card time-to-playable remains an estimate; this receipt records measured wall time separately.

| Observation | Before | Current |
|---|---:|---:|
| Local title Rapier fetch / instantiate-streaming | 16,257 / 16,269 ms | instantiate-streaming 39.4 ms |
| Title loading gone | 19,607 ms | 2,348 ms |
| Grid weapon-to-menu (terrain/assembly/installation) | 5,428 ms | 3,430 ms |
| Longest grid assembly task | 4,218 ms | 2,304 ms |
| Grid shader stage | 61 ms | 286 ms |
| Grid first-frame stage | 436 ms | 100 ms |
| New programs during shaders | 47 | 94 |
| New programs during firstFrame | 80 | 3 |
| Grid playable | 7,657 ms | 5,407 ms |

Before grid is `1d2f2abdc`; current is `42962da4e`. Other lanes changed content between pins, and GPU driver cache / machine contention were not controlled. These totals are observations, not a controlled speedup percentage. The baseline `6693cc456` GPU-cold profile separately attributed about 4.8 s to first-use GL link resolution and about 2.1 s self-time to rounded seam vertex construction. Preview HTTP TTFB accounted for 16.254 s of the initial title delay: synchronous Brotli compression blocked the local server. Production's reported 28–40 s remains unmeasured here.

KHR_parallel_shader_compile is already enabled. The problem was compiling the regional installation scene without the root page lights. The fix moves most program creation ahead of firstFrame; it does not introduce another compiler or alter shader source.

## Pixel and CPU witnesses

With the frame gate frozen, render the same live root frame repeatedly, run regional-target warm-up, then root-target warm-up. All four 402×874 RGBA buffers hash to `004bb74a1e67fcaa88f9b4a97a58085703d9b594de46744d64850b74c84ebd36`. The selected regional scene was distinct from the root. This proves the warm-up operation leaves this frame unchanged; it is not a claim of whole-game parent/current visual parity.

Current grid CPU OFF and ON each sampled 120 drawn frames: median 30.03 fps, rAF p95 33.4 ms, zero skipped draws and no context loss. Owner p95: platform 0.8 ms, Driftwood 0.4 ms, both below the 8.333 ms phone/Simulator quarter-frame threshold. This is a phone-emulated diagnostic; the desktop and Simulator floor remains the coordinator's batched check.

The pre-meter pin `2190f0fec` cannot boot its grid (Driftwood load failure), so its disabled-overhead comparison uses the existing title world with the frame gate opened diagnostically. It does not stand in for a successful grid boot. Both 120-frame title samples have 251 draws, 1,381,259 triangles, 30.03 fps, p95 33.4 ms and zero skipped draws. Work p95 is 4.2 ms parent / 4.4 ms current; this small uncontrolled sample does not exclude a small CPU difference.

## Reproduce

Build each exact pin from scratch with `CLAUDE_CODE_SESSION_ID=sp-x4 scripts/serve-build.sh --rev <pin> --hours 1 --name <unique>`, from a scratch directory. Use its automatically chosen port and check `/version.json`; explicit ports can collide with another agent's preview. Wait through `scripts/browser-lane.sh wait`, use a unique agent-browser session, muted Metal, and device `iPhone 16 Pro`.

Open with both `cold-init.js` and `shader-init.js` registered before navigation, then the allowlisted harness URL `/?touch=1&tier=phone&mute=1&sw=0`. Wait for `window.__wildshard?.world?.game && !document.querySelector(".ws-load")`, snapshot, and click INFINITE WILDSHARD. Wait for `window.__coldBoot?.playable !== null` plus the live game. Read reduced traces, then execute `cpu-off.js` / `cpu-on.js` through `agent-browser eval --stdin`. `pixel-warm.js` targets the exact 42962da bundle hash and must be updated if the bundle name changes. Close the browser before reporting.

Focused checks: 12 product tests, 9 seam/adaptive tests, 2 precompile batching tests, report-card/refusal/CPU/scanner fixtures, root/layer strict typechecks, typed lint, and private source/graph/coupling/ratchet guards. The earlier complete clean-export run passed 4,792 tests in 791 files; the coordinator runs the final full push gate. No timeout or safety cap was raised.

## Entered Pine depth/post warm-up

`3e5ea7e58` warms the root world, shadow/depth variants and actual zero-delta composer passes before regional `afterPlay` publishes readiness. Temporary compile stand-ins belong to the entered scope. Initial boot keeps its existing shaders/firstFrame path. `ae934b53a` gives the owned-session fixture the real Game prototype and initial composer state; the clean-export full Vitest run passed 833 files / 4,944 tests, with 14 skipped.

`entered-warm.json` records the real Driftwood → road → Pine route on that pin: 13.044 s, all frame-commit/residency witnesses pass. Pine warm-up took 816.2 ms and created 107 programs behind readiness; the trace saw **zero program creations or program/shader info-log queries after warm-up**, including the settled standing view. Ten earlier road programs are counted separately. No captured errors. This one-view observation is not a worst-case camera guarantee or a physical-phone measurement.

After settling, freeze the game frame gate, Three clock delta and the volumetric noise phase, then capture before/repeat, run the real warm-up, and capture after/repeat. All four 402×874 RGBA hashes equal `9cbde2306a134783d17c44b1b9fce608abd20837fcfc96e788b554e3cc823642`. Initial controls without the clock/noise freeze did not repeat and were rejected. This proves the warm-up leaves this frozen frame unchanged, not whole-game parent/current parity.

Reproduction: before boot install `cold-init.js` plus `window.__wildshardHarness={seed:357,capture:null}`. Enter INFINITE WILDSHARD, install `entered-warm-trace.js`, and use `gridFloorPlans(state, 'runtime-travel')[0]`, `stageFloorGrid` and `driveFloorGrid` from `scripts/frame-floor-grid.mjs` with the original `performance.timeOrigin`. Require `gridFloorWitnessFailures` to be empty. Read the trace after standing, then run `entered-warm-pixels.js` with stable repeated controls. Browser and preview were closed after capture.
