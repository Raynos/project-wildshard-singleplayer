# Pine C9 budget data

Delete both executable budget modules (`budgets.ts` and
`data/budgetCeilings.ts`) and land all their exact values in
`data/budgets.json` through the existing authored manifest JSON binding.
The saved evaluated original and the new JSON compare equal (budget-equality.json). The existing
budget-ceiling writer already targets this JSON path. No budget is raised.

The source ruler measures 18 + 24 = 42 counted Pine lines removed (C9 -40, C8 -2) and
zero platform lines added. Both whole modules disappear in this commit.
This is a data-format cut; memory estimate and pixels do not change.

C9 measured 738 lines before Z2/Z10 and 739 immediately after it. Its remaining live boot/runtime paths
stay: runtime/index.ts (187), perfLap.ts (47), headlessModules.ts (32),
shard.config.ts (29), baked.ts (12), boot/files.ts (12), gpuTable.ts (9),
and live SDK hooks. Population roster/shelter code is shared with the
creature lane and remains counted; it is not dead fallback. Z2/Z10 changes
the inventory separately; the final source ruler records that boundary.
There is no independent 150-line whole-module deletion in these retained
paths without replacing live behavior or overlapping another lane.

Standalone exact candidate 7d8ea0c22 passed root/layer types, typed lint
of the existing data host, 36 focused tests in four files including all
17 shard-headless cases, and strict CI all-10 products with zero stale maps.
Final exact source dd615fcae over landed CM1 c5ef46054 and the emitter/
weather changes passes fresh all-10 products, root/layer types, typed lint
and all 36 focused/headless tests. The inherited five stale-map warnings
remain expected under G490. Pine is 4004 -> 3962; C9 is 739 -> 699.
Platform net is zero; AS remains 452 / 2130. source-ruler.json is the full
post-generation inventory; component-after.json lists every retained C9
path. Row PC9 keeps that remainder in the live plan. No new test
file, platform API, approvedFeature tag, guard exception or map input.

## Existing host bar: 6/6

1. Two users: Pine manifest.json:730 budget binding and Driftwood
   manifest.json:320 both drive the same existing JSON binding.
2. No shard branch: scripts/authored-manifest.mjs:50 selects file format.
3. Data-driven: scripts/authored-manifest.mjs:52 parses the budget rows.
4. Server-safe: this is build-time JSON intake, at the same line.
5. Deletion: src/shards/driftwood-isle/manifest.json:320 survives Pine.
6. Data-only: src/engine/level/spec.ts:97 takes BudgetInputs rows;
   src/game/shard/manifest.ts:484 preserves that type.

No host was added or extended. No runtime detour or const mirror remains.

CM1's exact landed commit c5ef46054 passed its muted iPhone 16 Pro check
(build c5ef460-mvdo5qbo): public chip absent, Developer report retained,
zero page/render faults. Raw result: cm1-landed-phone.json. C9 retains
these exact budget rows and changes no memory behavior.

CM1's exact landed world also passes the baseline native comparator on all
20 phone/desktop poses, shaders, GPU bytes and colliders. This includes
the emitter/weather landings preceding CM1. Raw: cm1-landed-world.json.
