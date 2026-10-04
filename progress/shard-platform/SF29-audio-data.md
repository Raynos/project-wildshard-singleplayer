# SF29 audio declarations — Node proof

State: in flight. All six legacy shards declare their audio; live parity, frame floors and the final pushed pin remain to be recorded.

Each shard's `shard.config.ts` takes its audio from `data/audio.ts`. The existing trusted runtime reads that same declaration. Transitional hybrid clients explicitly select runtime audio ownership, so they install it once; authored clients default to declared ownership. Runtime ownership is refused for outside authors.

| Shard | Declaration / consumer commits | Runtime isolation | Pre-conversion cue dispatches preserved |
|---|---|---|---:|
| Driftwood Isle | `fba9cbf58`, `fc7e944bb` | `093bb2f47` | 81,648 |
| Pine Hollow | `2cdce8175`, `f1fa390a7`, `12310ead5` | `253482714` | 1,728 |
| Nalati Grasslands | `8e570b420`, `60555e92d` | `1b4dc1f4b` | 6,480 |
| Sky Reach (`far-reach`) | `e22054602` | `04f988aa5` | 270 |
| Sunscar Dunes | `ed8654f91` | `04f988aa5` | 270 |
| Nine Dragon Stack | `363fd5557` | `9efacf1b8` | 9,396 |

The dispatch fixtures preserve acceptance/fallback, ordered recipe arguments, scheduling, taps and RNG draws. Their checked SHA-256 streams were captured from each adapter before conversion, rather than regenerated from the new implementation. Total: 99,792 dispatches. Pine's 54 baked ambience zones retain their original digest. Nine Dragon's enclosed-region blend retains its original digest at 2,337 listener positions. Nalati retains all 24 ordered scene fallback chains, including repeated grass. Nine retains combat priority, the strict Well threshold and repeated market fallback. Pine retains boss phase, refresh requests and scoped buffer disposal.

`c1860a706` makes Nalati and Nine explicitly declare the existing six-second Music crossfade default and pluck fallback. Pine explicitly declares its existing pluck fallback. Calm/tension stems, boss layers/phases, bar alignment, catalogue file selection and decoder residency continue through the existing engine `Music`, `Stems` and `SetScore`; no recordings or sound recipes changed.

Final combined check (2026-10-04): `pnpm exec vitest run` on the six `test/shards/*/audio-routing-parity.test.ts` files, Pine/Nalati score fixtures, engine cue-routing/profile/lifecycle fixtures, `test/audio-profiles.test.ts` and `test/shardfile-sections.test.ts`: **13 files, 40 tests passed**. `pnpm exec tsc --noEmit --pretty false`: **passed**. `node scripts/build-shardfiles.mjs`: **all 7 projects built**. Source moves also passed focused typed lint and `node scripts/check-paths.mjs`; Pine's manifest static-closure repair passed `gen-shards --check`.

G51 runtime remainder: every legacy shard keeps procedural voices and trusted event-to-voice bindings under `runtime/audio/`. Driftwood, Pine, Nalati and Nine also keep listener/emitter queries, clock/weather/terrain callbacks, scoped random scheduling, bank installation and existing score lifecycle there. The bounded cue maps, zone bounds/gains, catalogue/boot-slot selection, scene fallback order, sample omissions and crossfade settings are data. Sky and Sunscar keep their kit voice adapters there and declare silent scores. These callbacks cannot be represented by the current data vocabulary without changing behavior; no author code was admitted.

Fresh browser comparison on origin `7382928dd` completed on both tiers for all six shards: **12 comparisons, 24 captures, 1,503.79 seconds** (resumed after the historical Pine build failure). Pine's immediate pre-audio parent `a499e346e` imports an absent `grid/hazeBand.ts`; the coordinator approved `c2e314725` instead. The report records the exact parent pins and reused, identity-checked Driftwood captures.

The strict verdict is **red in all 12 cases**, not accepted or rebaselined. All 36 masked pose comparisons pass 0.99; the minimum is Driftwood phone **0.990350206**. Every parent/current capture has zero boot errors, zero stuck legs and zero audio voices/beds/buses after unload. The one class-D failure is Nalati phone bow combat: zero hits in both parent and current; the later harness-grounding fix `603f8eaf4` is outside this measurement pin.

Every current boot has exactly four more colliders. Causal source review confirms `ff2f848c9`, `src/game/session/world.ts:28`, installs four G142 platform entry sockets. Endpoint differences are also preserved in the report; their cause has not been established. Four live audio comparisons differ and remain **unresolved SF29 parity regressions** pending controlled attribution: Driftwood phone water footsteps 5→4, sand 51→52 and one extra sand step in combat; Pine phone litter 331→330; Nine phone stone 402→398 and desktop 394→390. Native adapter golden tests do not justify discarding these live differences.

Evidence: `SF29-parity-7382928dd.json` retains every red field, gameplay check, sound multiset and teardown result, plus the full raw-report SHA-256. Reproduce with `node progress/shard-platform/SF29-parity.mjs --current=7382928dd --parent-pine-hollow=c2e314725 --out=<owned scratch>`. No stored baseline or quarantine changed. All owned browsers and preview servers were closed after comparison.

Coordinator floor coverage on `07209c626` is **green**. The [default floor artifact](../frame-floor/07209c626-81205-1791143738188.json) covers all seven shards plus the grid on both surfaces: **16/16 shard/surface results passed**, 489.659 seconds, every rounded desktop median at least **60 fps** (worst p95 **16.8 ms**) and Simulator median at least **30 fps** (worst p95 **34 ms**), zero errors. The [rows-ON artifact](../frame-floor/07209c626-172-1791144229193.json) additionally covers Driftwood, Nalati, the template and grid: **8/8 passed**, 250.346 seconds, the same worst 16.8/34 ms p95. These are desktop and Simulator results, not physical-device readings.

Remaining acceptance: after SF57's quiet measurement, a one-browser direct `ff2f848c9^` versus `ff2f848c9` control must attribute the footstep/endpoint differences; no baseline edits. The coordinator owns the serialized evidence push. SF29 remains in flight.
