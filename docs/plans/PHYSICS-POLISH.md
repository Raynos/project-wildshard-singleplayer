# Physics polish — what is left after the physics merge

**State:** `in progress` 2026-10-03 — Jake approved F1 (the sand lines onto the stairs + a cove re-bake), F2 (one bridge sway: the real one) and F5 (the navmesh bake without boards under decks) in the E423 grill: buildable, unowned. F6 done by E354; F4 dropped; F3 went to GAME-NORMALIZATION F11 and F7 with src/dev.

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
| F1 | **Jake: yes, re-route the sand lines onto the stairs and re-bake the cove (E423 grill, 2026-10-03; E354 already made the walk take the stairs).** **Rim trails onto the stairs** | The lookout and shrine paths' sand lines still run down the hut plateau's 12 m rim cliffs, beside the new trestle stairs (`--trails` stalls there; a player takes the stair). Re-route the two polylines onto the stairs. They are inside the Blender cove, whose ground is baked from the trail carve, so this needs a Blender re-bake (`pnpm blender:island`, the remaster's pipeline) in the same change | M | — |
| F2 | **Jake: real sway only, the fake dip dropped, a Debug row to compare in play (E423 grill).** **One bridge sway** | The adventure's A7 camera sway (`Adventure.ts`: a fake roll + dip while your feet are on the bridge) still runs on top of the deck's real physical sway. Keep one: drop the fake dip (the deck bounces for real) and tune or drop the roll | S | — |
| F3 | **Retire `player.colliders`** | The legacy bridge (src/engine/physics/bridge.ts) still mirrors hand-made boxes: the interactables' doors / chests / levers, Wendell, the Blender cove's rocks and palms, the dev scenes. Register each as a piece (a moving one `follows` its object) and delete the bridge. The E1 goal | M | — |
| F5 | **Jake: yes (E423 grill).** **Navmesh bake: no boards under decks** | The game lays no path walkway board where a deck carries the path (`carried`), but `scripts/bake-navmesh.mjs` still does (its builders have no floor functions there). Pass the builders' floors to the bake so the navmesh matches the game | S | — |
| F6 | **Done by E354 (bea3ea710): the walk takes the stairs and reads 0 stuck.** **Trail walk that knows the stairs** | `--trails` walks the polylines, so the trails' ends inside the hut / wreck / lookout / under the pier and the two rim cliffs read as stalls (21 today). Give the walk per-path entry / exit points and the stair routes, so a real regression stands out at 0 | S | — |
| F7 | **Dev scenes on the registry** | `src/dev/*` still wire builders by hand (player.colliders + floor functions); they were left out of PHYSICS on purpose. Register them like main.ts so the dev scenes collide like the game | S | — |

## Owned elsewhere (not this plan)

- Nalati's physics → **E72**: done inside NALATI-MERGE (d034f03, 92ab497, 868d599). The iPhone frame reading → **E73**.
- ENGINE-FIT E4 (input) and E5 (shard modules) → ENGINE-FIT, unowned.
- Driftwood's longest load task (~128 ms, the world builders' `edge` step, not physics) → the load / remaster owners.
