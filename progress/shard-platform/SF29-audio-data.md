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

Remaining acceptance: fresh browser parity on both tiers, desktop/Simulator floors, coordinator gate/push receipt and final origin SHA. No parity baseline has been changed or accepted.
