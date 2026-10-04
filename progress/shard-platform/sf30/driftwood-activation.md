# SF30 Driftwood activation

**Evidence correction:** the two commands below wrote the global settings slot, but authored Debug rows read device saves at `debug.plugin.<levelId>.<rowId>`. Both runs therefore exercised the default OFF path. They prove the legacy walk only; declared-mover activation remains unproved by these receipts. A corrected ON run must seed `debug.plugin.driftwood-isle.driftwoodHybrid=on` in the device store and assert that `shard.driftwood.movers` is installed before walking.

Build `27692e760`: movers activate only under the default-off Driftwood hybrid setting. The OFF entry imports the unchanged native runtime; the ON entry admits the declared fixed-step scripts before registering island view systems. Both paths retain the native chain and boat platform, with no duplicate collision allocation.

Commands (each under `scripts/browser-lane.sh`, against a clean `scripts/serve-build.sh --rev 27692e760` build):

```
node scripts/physics-baseline.mjs --no-build --mode=walk --shard=driftwood-isle --url=<served-build> --settings=driftwoodHybrid=off --label=sf30-drift-off --tier=phone
node scripts/physics-baseline.mjs --no-build --mode=walk --shard=driftwood-isle --url=<served-build> --settings=driftwoodHybrid=on --label=sf30-drift-on --tier=phone
```

Both legacy OFF runs: **8/8 legs, 0 stuck**, including bridge and boat. Both report **2,196 colliders**. The bridge endpoint is identical `(35.289, 13.071, 33.257)`; the wave-driven boat endpoint differs by 9 mm horizontally and 6 mm vertically between real-time runs. Boat same-engine recorded-pose and carried-motor fixtures remain the timing-independent oracle (10,000 ticks, maximum pose error 0.00525 mm; 1,200 rider ticks, 1,191 carried, maximum feet error 0.282 mm).

Raw receipts: `progress/physics/sf30-drift-{off,on}-27692e7-muty8lux.json`. Browser, lane and served build closed after the run. SF46's earlier OFF legacy comparison (d143452b1→5d4a4ee5c) is green on both tiers with bridge 0 stuck, no audio/endpoint differences and clean unload. G51 residual: native bridge chain construction and legacy boat/bridge visual recipes remain in the trusted runtime; script decisions and boat pose advance in the bounded fixed-step lane.

## Corrected activation proof

A fresh clean build of `8de907da2` was walked under one browser lane. Each command seeds the authored device slot and rejects a receipt unless the declared mover system has the expected presence:

```
node scripts/physics-baseline.mjs --no-build --mode=walk --shard=driftwood-isle --url=<served-build> --tier=phone --device-save=debug.plugin.driftwood-isle.driftwoodHybrid=off --expect-system=driftwood-isle:shard.driftwood.movers=off --label=sf30-device-off
node scripts/physics-baseline.mjs --no-build --mode=walk --shard=driftwood-isle --url=<served-build> --tier=phone --device-save=debug.plugin.driftwood-isle.driftwoodHybrid=on --expect-system=driftwood-isle:shard.driftwood.movers=on --label=sf30-device-on
```

Both **OFF and true ON pass 8/8 legs with 0 stuck**, including bridge and boat; both have **2,196 colliders** and no recorded page errors. The bridge endpoint is exact `(35.289, 13.071, 33.257)`. Boat endpoints have the same X/Z and differ by 5 mm in Y between real-time runs. Receipts record the authored device choice and all installed system IDs: `progress/physics/sf30-device-{off,on}-8de907d-mutzoed3.json`. The browser lane and owned preview were closed.

The same pinned revision also passed the witnessed ON frame floor: Driftwood desktop 60 fps / maximum p95 16.8 ms and Simulator 30 fps / maximum p95 34 ms. Full director-floor and retained Pine retry details are in `progress/shard-platform/sf24-directors.md`. No physical iPhone performance claim is made. The earlier global-setting ON receipt remains withdrawn rather than relabelled as activation evidence.
