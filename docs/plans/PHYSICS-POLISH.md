# Physics polish — what is left after the physics merge

**State:** `draft` 2026-09-23 — loose ends after PHYSICS P0–P9b (archived `project/archive/2026-09-23-physics.md`, merged `558d234`, live `558d234-mueov4v4`). Nothing here is approved (Jake approved none); it waits on Jake's pick of rows. The required follow-ups are asks, not rows: E72 (physics for Nalati once it merges) and E73 (the iPhone reading).

## Where physics stands

Built and live: Rapier 3D as a boot file, the 60 Hz fixed step, the player on the character controller (step 0.35 m,
climb 40°), every static thing registered once with ColliderDescs, the boat and cabin doors as kinematic bodies,
weapons / sword / prompts on physics queries, creature hitboxes and near-creature controllers, the navcat navmesh per
shard, coconuts / the barrel / drops as bodies, ragdolls, the rope bridge as a jointed plank chain, the crag trails
graded outside the Blender cove with trestle stairs down the plateau rim inside it, one registry for the world and
Explore.

## Rows (none approved)

| # | Row | What it is | Size | Ask |
|---|---|---|---|---|
| F1 | **Rim trails onto the stairs** | The lookout and shrine paths' sand lines still run down the hut plateau's 12 m rim cliffs, beside the new trestle stairs (`--trails` stalls there; a player takes the stair). Re-route the two polylines onto the stairs. They are inside the Blender cove, whose ground is baked from the trail carve, so this needs a Blender re-bake (`pnpm blender:island`, the remaster's pipeline) in the same change | M | — |
| F2 | **One bridge sway** | The adventure's A7 camera sway (`Adventure.ts`: a fake roll + dip while your feet are on the bridge) still runs on top of the deck's real physical sway. Keep one: drop the fake dip (the deck bounces for real) and tune or drop the roll | S | — |
| F3 | **Retire `player.colliders`** | The legacy bridge (src/physics/bridge.ts) still mirrors hand-made boxes: the interactables' doors / chests / levers, Wendell, the Blender cove's rocks and palms, the dev scenes. Register each as a piece (a moving one `follows` its object) and delete the bridge. The E1 goal | M | — |
| F4 | **Creatures weigh the bridge** | A deer or boar on the rope bridge rides it but doesn't load it (only the player's motor has `weight`). Give creature motors their species' weight so a boar crossing makes it dip | S | — |
| F5 | **Navmesh bake: no boards under decks** | The game lays no path walkway board where a deck carries the path (`carried`), but `scripts/bake-navmesh.mjs` still does (its builders have no floor functions there). Pass the builders' floors to the bake so the navmesh matches the game | S | — |
| F6 | **Trail walk that knows the stairs** | `--trails` walks the polylines, so the trails' ends inside the hut / wreck / lookout / under the pier and the two rim cliffs read as stalls (21 today). Give the walk per-path entry / exit points and the stair routes, so a real regression stands out at 0 | S | — |
| F7 | **Dev scenes on the registry** | `src/dev/*` still wire builders by hand (player.colliders + floor functions); they were left out of PHYSICS on purpose. Register them like main.ts so the dev scenes collide like the game | S | — |

## Owned elsewhere (not this plan)

- Nalati's physics → **E72** (after the `nalati-grasslands` merge). The iPhone frame reading → **E73**.
- ENGINE-FIT E4 (input) and E5 (shard modules) → ENGINE-FIT, unowned.
- Driftwood's longest load task (~128 ms, the world builders' `edge` step, not physics) → the load / remaster owners.
