# SF24 directors: authored decisions, trusted native recipes

One default-off Debug setting, **Shard directors (data)** (`shardDirectors`), selects Legacy or Script for Driftwood, Nalati and Pine. It adds no further Debug rows; the conversion decision in SF46–SF48 retires it. The game installer owns fixed stepping, admission and scope. Grid subscription declarations are reserved, and delivery is rejected in v1.

| Consumer | Authored module | Real shipping oracle | Same-engine proof |
| --- | --- | --- | --- |
| Driftwood finale | `behaviour/director.as`, 1,403 bytes | `installFinale` and actual captain/reward recipes | 10,000 ticks; wake 10, death 200, reward start 220, finish 640; camera/player/day-night poses exact |
| Nalati raid | `behaviour/director.as`, 1,331 bytes | `legacyRaidTick`, called by `SheepRaid` | Three seeds × 65,000 ticks; all events and shared AI RNG order exact, including first 150–240 s, next 360–540 s, retry 30 s; restored 10,000-tick suffix exact |
| Pine night/dawn | `behaviour/director.as`, 1,688 bytes | `LegacyPineClock`, called by the shipping quest installer | 10,000 ticks with/without sky and saved/unsaved dawn; events exact; restored mid-dawn 10,000-tick suffix and pending typed requests exact |

Pine's actual floating-point thresholds at 60 Hz are ticks **151 / 241 / 301 / 720** after a boot dawn (2.5 / 4 / 5 / 12 seconds). The author module preserves the shipping `was < threshold && now >= threshold` arithmetic. Ordinary requests enter the next bounded fixed tick. The tests compare the shipping clock at that input boundary; they do not claim instantaneous frame callback delivery in Script mode.

Validation:

```
pnpm exec vitest run test/director.test.ts test/director-client.test.ts test/director-finale.test.ts test/director-finale-boot.test.ts test/director-raid-clock.test.ts test/director-raid.test.ts test/director-pine-clock.test.ts test/director-pine.test.ts
```

The focused run passes **30 tests in 8 files**. All new imports are defining public modules. JSON source imports use `with { type: 'json' }` for Node bake-check. Modules use the existing unchanged engine fuel, query, memory and event allowances; hashes are verified before allocation. Complete author memory/globals, budgets, quarantine state and pending typed requests participate in the same-engine continuation.

G51 residuals are explicit: Driftwood captain combat, renderer and reward camera remain native; Nalati pack/prey selection, spawn viability, shepherd rig/control and its existing shared RNG draw port remain native; Pine sky interpolation, lights, captions, inventory and creature recipes remain native. These recipes consume bounded typed decisions and supply live observations. The source/Script choice stays default off until conversion parity and the selection decision. No grid delivery is implemented in v1.

ON frame floor, pinned `8de907da2`, both surfaces:

```
node scripts/frame-floor.mjs --rev=8de907da2 --shards=driftwood-isle,nalati-grasslands,pine-hollow --surface=both \
  --device-save=debug.plugin.driftwood-isle.driftwoodHybrid=on \
  --device-save=debug.plugin.driftwood-isle.shardDirectors=on \
  --device-save=debug.plugin.nalati-grasslands.shardDirectors=on \
  --device-save=debug.plugin.pine-hollow.shardDirectors=on \
  --expect-system=driftwood-isle:shard.driftwood.movers=on \
  --expect-system=driftwood-isle:shard.driftwood.director=on \
  --expect-system=nalati-grasslands:shard.nalati.director=on \
  --expect-system=pine-hollow:shard.pine.director=on
```

Desktop: all nine poses pass, raw median 59.88 fps (rounded 60), maximum p95 **16.8 ms**. Simulator: Driftwood and Nalati pass six poses, raw median 30.303 fps (rounded 30), maximum p95 **34 ms**. The first Pine Simulator load timed out at 90 seconds with no captured page errors; the failed receipt is retained at `progress/frame-floor/8de907da2-39365-1791127943947.json` (267.4 seconds, incomplete).

The coordinator granted one isolated Pine Simulator retry with the same revision and device keys, `--shards=pine-hollow --surface=sim --expect-system=pine-hollow:shard.pine.director=on`. It passed all three poses, 30.303 fps, maximum p95 **34 ms**, no errors, in **58.2 seconds**. Its receipt is `progress/frame-floor/8de907da2-54243-1791128345769.json`. Every passing load records the device keys and installed director system; Driftwood additionally records its declared mover system. Thus all six requested shard/surface combinations have passing witnessed measurements, across the original attempt and isolated retry. The initial timeout is not explained by this successful retry. These Simulator numbers are not a physical iPhone performance or memory measurement.
