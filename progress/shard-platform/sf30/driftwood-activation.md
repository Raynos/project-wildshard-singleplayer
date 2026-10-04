# SF30 Driftwood activation

Build `27692e760`: movers activate only under the default-off Driftwood hybrid setting. The OFF entry imports the unchanged native runtime; the ON entry admits the declared fixed-step scripts before registering island view systems. Both paths retain the native chain and boat platform, with no duplicate collision allocation.

Commands (each under `scripts/browser-lane.sh`, against a clean `scripts/serve-build.sh --rev 27692e760` build):

```
node scripts/physics-baseline.mjs --no-build --mode=walk --shard=driftwood-isle --url=<served-build> --settings=driftwoodHybrid=off --label=sf30-drift-off --tier=phone
node scripts/physics-baseline.mjs --no-build --mode=walk --shard=driftwood-isle --url=<served-build> --settings=driftwoodHybrid=on --label=sf30-drift-on --tier=phone
```

Both runs: **8/8 legs, 0 stuck**, including bridge and boat. Both report **2,196 colliders**. The bridge endpoint is identical `(35.289, 13.071, 33.257)`; the wave-driven boat endpoint differs by 9 mm horizontally and 6 mm vertically between real-time runs. Boat same-engine recorded-pose and carried-motor fixtures remain the timing-independent oracle (10,000 ticks, maximum pose error 0.00525 mm; 1,200 rider ticks, 1,191 carried, maximum feet error 0.282 mm).

Raw receipts: `progress/physics/sf30-drift-{off,on}-27692e7-muty8lux.json`. Browser, lane and served build closed after the run. SF46's earlier OFF legacy comparison (d143452b1→5d4a4ee5c) is green on both tiers with bridge 0 stuck, no audio/endpoint differences and clean unload. G51 residual: native bridge chain construction and legacy boat/bridge visual recipes remain in the trusted runtime; script decisions and boat pose advance in the bounded fixed-step lane.
