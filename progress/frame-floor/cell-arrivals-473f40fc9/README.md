# Cold cell arrival at shipping road speed

Source `473f40fc99677da32000276efc95df1cd79bc963`; 30 m/s, Developer on, graph materials on, Memory saver off, build pacing on, phone render scale 2×. One cold route per surface. Whole-drive frames include construction. Short travel is owned by sp-x1.

| Cell | Desktop wait / max (ms) | Simulator wait / p95 / max (ms) | Verdict |
| --- | ---: | ---: | --- |
| pine-hollow | 0 / 66.7 | 2497.0 / 39 / 124 | FAIL |
| nine-dragon-stack | 4148.5 / 83.4 | 48825.0 / 34 / 143 | FAIL |
| far-reach | 0 / 66.6 | 0 / 34 / 124 | PASS |
| sunscar-dunes | 0 / 66.6 | 0 / 34 / 78 | PASS |
| driftwood-isle | pending | pending | PENDING |
| template-2 | pending | pending | PENDING |

Sky and Signal pass all arrival gates. Pine fails Simulator readiness and p95; Nine fails readiness on both surfaces. Driftwood and the template remain uncaptured. The six-cell milestone remains open.

Each completed route starts with the target absent from live residents. There are no game errors, context losses or visible-before-ready frames. Sky traverses its declared socket and full lift; Nine traverses its declared road portal and 125 m landing. The earlier flat Nine waypoint failures were incomplete harness attempts and are not graded.

All four completed cells pass frame maxima now. Earlier Pine desktop 249.9 ms and Simulator 490 ms, and Signal desktop 200 ms, remain baseline failures. This combined pin establishes current outcomes, without assigning isolated savings to either warm-up fix. Construction batching `14e4a53c5` awaits timing proof.

Quiet windows released at 19:14:09Z and 19:32:08Z, with pushes and a two-minute minimum gap between them. JSON records actual window times and load averages. Sp-x4 then sp-x1 have the next windows.
