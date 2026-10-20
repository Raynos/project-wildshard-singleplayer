# Independent articulated Conch seam repair review

2026-10-20 21:29 UTC. This separate review supplements the unchanged initial negative REPORT.md. No remaining must-fix was found within this bounded source/packing inspection after the arithmetic repair. Anatomy, safe articulation, motion, living dimensions, physics/contact and quality remain unadmitted.


The writer preserved the failed bytes in `failed-packed-seam/` and made the bounded arithmetic correction. Clip intersections now order endpoints consistently before calculating t and interpolating all attributes. Exact source position keys replace rounded keys; construction checks both source-double and packed-float32 closure/orientation. The new regression separately rejects the preserved failure. There is no geometric contact tolerance, collider padding or cap-limit change.

My original independent cursor/edge extraction, rerun without invoking the writer's topology helpers, now reports zero non-two edges and zero orientation mismatches on all twelve changed pieces in both float64 source and float32 packed coordinates. Comparing repaired versus failed model arrays: source position differences are at most1.1102230246251565e-16m, with exactly four float32 position components changed by1ULP. Cap normal recomputation changes some double values by at most7.605027718682322e-15; all packed normals remain identical. Colors, weights and bone hierarchy are unchanged. The333-point recipe and articulation contract are byte-identical. Fresh verification again proves all5,802 unaffected corner position/color/normal attributes exact against the original selected source under B.

I independently decompressed and compared all repaired packed channels and reproduced the exact recipe extreme coordinates. The source correction therefore closes the proved seam defect without secretly removing tissue, changing source extents to chase support, or changing ownership. It does not resolve the explicitly open broad guard/shield assembly or articulation-quality tradeoffs.

Final pins, relative to the candidate directory:

| File | SHA-256 |
| --- | --- |
| generate.py | 5e0f01f3b1ef4e747f6121a10d7575d6f448e86910f420edc7aae03b8bcfe7b5 |
| model.json | 560abb099f474ddb86733f143e39652874298bba67f15fd1da7a63f1c4e91b3e |
| metadata.json | 6905f20ced953176fb0e316a8d18287735eef0fb996cd58af43ae918b8f87989 |
| payload.bin | 9a1176e701ec58b6470d9898c11677512344e455c84da3bde84e1b5cee5364ed |
| construction.json | 2596d49ffffa72f255c4d8db6628b4ebc9090c7d1ec80e0918cb96ae164424e6 |
| test_source.py | 44659056058824d04a74d80e589bcbb6fb5fedd98eb4d49c678753461ae8d15e |
| freeze.json | 0ec903c0eef1639277048dee8098cd51c33980204a18f59a49d75a68f21390f3 |
| final-receipt.json | ee4f55b4195fd15278e7d0b786ebe40bafd34b3c60cb8c3463d2d00c4f4329b5 |
| final-manifest.json | eaa5c79468a8e181e49e3383591381adb78f3cfcfc46aad1fb3732ea7f07dd1b |

Recipe, contract and native.test.ts retain the hashes in REPORT.md's initial table. Every one of the46 files inventoried by final-manifest.json matched before and after the independent executable check.

After explicit root authorization and both writers confirmed idle, ran exactly:

`WS_HEAVY_ROOT="$PWD/tmp/heavy-lanes" python3 scripts/heavy-lane.py build -- node_modules/.bin/vitest run art/driftwood-isle/approved-conch/articulated-source-candidate1/native.test.ts --config art/driftwood-isle/approved-conch/articulated-source-candidate1/vitest.config.ts`

Result:3/3 tests in one file passed,10.38s Vitest /11.26s lease, exit0. Lease and process were released immediately; the other writer was notified. These are existing packed-consumer attribute/recipe checks, actual THREE rigid skin ownership under diagnostic articulation, and schema rejection cases. They do not step a physics world, construct a gameplay actor, author or validate a motion envelope, or assess images. The Vite future native-loader import-extension advisory is not a test failure.

The writer separately reports9 Python tests passed and a prior strict TypeScript pass; no independent rerun of those checks is claimed. Art-excluded lint still is not claimed green. The candidate is ready for the next bounded source/anatomy decision, not a runtime, contact, appearance or public-admission verdict.
