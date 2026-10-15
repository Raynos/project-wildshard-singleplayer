# Fresh world maps (SF66)

Driftwood was captured from stock served source `4c12492ec` after the pier deck material landed, then stamped for `9296a81cc0db7b2da7ed6ad6760ef62eb20d397c`. The intervening hashed inputs are the reviewed `a1602d555` first-person arms graph registration (arms are absent from the map bake) and `25fb99192` rock refactor: all 509 world rocks retain the same geometry, RNG, placement, materials and draw path; it removes the live fallback and changes Explorer-only intake. Sky, Pine and Signal retain their earlier `a5e53cc7d` captures: clean generated input keys were verified unchanged at the new source. Each muted preview build id was fenced before and after capture; all browsers closed before finalization.

The official `writeMapStamp` helper verified each rendered raster and bound its stamp to the clean generated source in check2. Shared working-tree world edits were excluded from the keys.

| Shard | Capture source | Raster bytes | Decoded pixel SHA256 |
| --- | --- | ---: | --- |
| far-reach | `a5e53cc7d` | 23,334 | `0b4c0a1d0d0f366c862fd7d890ee04c6f0e547f178b10a410df205c09b74d3b3` |
| pine-hollow | `a5e53cc7d` | 95,030 | `833b16801ad3c39a80d483e9c7e564f5305dec1849263f7c1f95a3275c6b7d52` |
| sunscar-dunes | `a5e53cc7d` | 27,318 | `f65e5fc2c74c28721883ad80d874ddeecff824188a849784e160a227d44da637` |
| driftwood-isle | `4c12492ec` | 98,924 | `902630d07d9a375e9ac62d5bf5875da883a7249c263c953002ecbbac0f199a60` |

Signal complete-product root: `e27be5542cf5fe072b34125e2ba9cff3e3bac031b5ca523ceaa091c0c7b209ef` → `aa3b928ccacc17bdbb41f08d7680c70167dd6aacd9354ca44a3701ee32454fe6` from the real producer. The other 87 output hashes stayed unchanged.

[Labelled Driftwood before/after](driftwood-map-pair.jpg). The coordinator approved the coastline, paths and vegetation.

Capture: `scripts/browser-lane.sh --max 15 node scripts/bake-maps.mjs --url=<stock preview> --shards=<captured shards>`.
