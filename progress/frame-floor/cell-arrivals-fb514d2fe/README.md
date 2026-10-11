# Cold cell arrival at shipping road speed

Developer on, build pacing on, graph materials on, Memory saver off, phone render scale 2x. One cold route per surface at 30 m/s. Whole-drive frames include construction; short travel belongs to sp-x1.

| Cell | Pin | Desktop wait / max (ms) | Simulator wait / p95 / max (ms) | Verdict |
| --- | --- | ---: | ---: | --- |
| driftwood-isle | fb514d2fe | 1661.7 / 100 | 4648 / 40 / 188 | FAIL |
| template-2 | fb514d2fe | 0 / 16.8 | 0 / 34 / 50 | PASS |
| pine-hollow | fb514d2fe | 0 / 66.6 | 1833 / 39 / 133 | FAIL |
| nine-dragon-stack | fb514d2fe | 4285.2 / 83.3 | 45651.0 / 34 / 165 | FAIL |
| far-reach | 473f40fc9 | 0 / 66.6 | 0 / 34 / 124 | PASS |
| sunscar-dunes | 473f40fc9 | 0 / 66.6 | 0 / 34 / 78 | PASS |

Template, Sky and Signal pass. Driftwood and Pine still fail readiness and Simulator p95. Nine still fails readiness on both surfaces. All six now pass the frame-maximum gates; the arrival milestone remains open.

Every opaque target begins absent from live residents. The template is already prepared before the road approach on its fresh boot; its route does not revisit the cell. No game errors, context losses or visible-before-ready frames occurred. Driftwood is a cold return after the initial home retires. Nine uses its actual declared portal and landing; Sky uses its actual socket and full lift. The earlier invalid flat Nine route remains incomplete evidence, not a pass.

Nine existing scalar build counters attribute 38.809 s of Simulator preparation to neon spill and 4.340 s to canopy (which also computes spill). Geometry conversion largest job is 17 ms. The corresponding desktop spill is 2.151 s. These counters are read after sampling, without a GL mutation journal. The next fix targets spill indexing while preserving every output float and emitter accumulation order.

Pine preparation still spends 8.825 s warming shader/upload jobs. Construction batching did not close its wait or p95 gates. No quality or render-scale reductions were used, and no isolated savings are claimed from these combined-tree pins.

The two new windows released at 20:28:30Z and 20:36:18Z with a two-minute gap. Their load averages and exact times are in the JSON. Sky/Signal timings and earlier failures remain in [the previous receipt](../cell-arrivals-473f40fc9/README.md). Raw captures stay in lane scratch.
