# Driftwood Isle — the plan

**State:** `archived` 2026-09-22 (finished 2026-09-18) — C0–C16 built and live since build b-mu6r3wl0. Leftovers are ASKS rows D38 (day/night clock), D39 (enemy harvest loot), D40 (sword glyph).

> **Status 2026-09-18 09:25:** every checkpoint C0–C16 is built and live at https://wildshard-singleplayer.vercel.app (build b-mu6r3wl0). Open follow-ups: a day/night clock (the sailor walks the beach at night), harvest loot for the new enemies, a sword glyph in the Inventory kit.

The second shard: a low-poly tropical island in open ocean, first person, wooden sword instead of the
crossbow. Everything here is the user's call from the 2026-09-18 session (docs/tasks/ASKS.md D1–D17);
the agents build the whole plan overnight, the user plays the full shard the next day. The bar for
"done" on every row: it is wired into `src/main.ts`, it holds 60 fps on the phone tier, it has a
screenshot in `progress/`, it is deployed.

## The look (decided)

- **Style B — faceted flat-shaded low-poly.** `art/driftwood-spawn-B-faceted.png` is the reference;
  `art/driftwood-fp-*.png` are the first-person portrait mockups; `art/driftwood-map-topdown.png` is
  the island layout. NO textures anywhere in this shard: every material is
  `MeshStandardMaterial({ flatShading: true, vertexColors: true })` on non-indexed geometry with
  flat normals, lit through `sky.setupMaterial()`. That is why it is the easiest style to build and
  the cheapest to render.
- `ChunkDef.style = 'lowpoly'`, `weapon = 'sword'`, `ocean = { level, shallowColor, deepColor, deepDepth }`
  (`src/chunks/ChunkDef.ts`). Pine Hollow stays `'pbr'` / crossbow, byte-for-byte unchanged.
- **First person, same engine.** Same Player, same HUD (PAUSE/fps, minimap + heading, HOVER, AIM/JUMP
  discs, VITALS, the black MOVE/LOOK bar), no ammo counter. Portrait phone is the primary target.
- The shard card says **SUPER EXPERIMENTAL** until the island is whole.

## Checkpoints, in order

Each is a deploy. Nothing waits for the next.

| # | checkpoint | what you can do | status |
|---|---|---|---|
| C0 ✅ | **Ocean + pier** (world-agent) — the whole 500 m shard is faceted turquoise sea, the south entry road is a wooden pier, you spawn on its deck; bright tropical midday HDRI | walk the pier, look at the sea | pier + ocean render at 60 fps; committing |
| C1 ✅ | **Wooden sword** (sword-agent) — `src/player/Sword.ts` behind `src/player/Weapon.ts`; BOLTS panel hidden | swing at nothing | in flight |
| C2 ✅ | **Swimming** (swim-agent, landed `4817360` `4397077`) — wade → float, buoyancy, soft splash off the pier, climb-out onto the deck; DIVE disc replaces JUMP on phones; **white-gloved hands** replace the weapon while swimming (`src/player/Hands.ts`, styled per shard) | fall in, swim, climb out | swimming landed; hands in flight |
| C3 ✅ | **Sailboat** moored at the pier's sea end (patched white sail) — the spawn fiction: you arrived by boat | | world-agent step 2 |
| C4 ✅ | **The beach** — the crescent of sand the pier lands on, shallows over sand, foam line, faceted boulders | walk onto land | world-agent step 3 |
| C5 ✅ | **Low-poly boar** on the beach (boar-agent: same skeleton/AI, `style: 'lowpoly'`, no fur shells) + **sword combat** | hunt with the sword | boar first render done (`progress/077`, `080`) |
| C6 ✅ | **Diving** (dive-agent, after C2) — hold DIVE to go down, a SURFACE button appears beside it to go up; no other vertical control; decorative underwater (coral, seaweed, sand ripples); **swim forever, no drowning**; **no underworld** | dive off the pier | starts when hands land |
| C7 ✅ | **Palms** (second tree factory, faceted fan fronds) + **hut on the plateau** (thatched stilt hut, NOT the log cabin) + **fences, wooden steps, signposts** along the sand path | climb to the hut | |
| C8 ✅ | **Lookout** on the NE cliff: watchtower with the blue banner + a **walkable swaying rope bridge** | cross the bridge | |
| C9 ✅ | **Wreck Cove** (east): half-sunk ship on the reef, driftwood logs, barrels, nets, crabs, tidepools, waterfall, cave mouth with a glow inside — go nuts | | |
| C10 ✅ | **Ring Shrine** (NW jungle): monolith with the circular opening framing the planet, glowing glyphs, fireflies, gull statues, spring pool — go nuts | | |
| C11 ✅ | **Iron sword pickup** — the whole point of Wildshard is finding equipment on the ground: one big iron sword hovering above the ground somewhere on the island (the wreck's glow or the shrine), walk into it to take it; iron = 28 dmg, its own swing set | find the better sword | |
| C12 ✅ | **Gulls** — low-poly bird system: perched on posts/beach, wheeling overhead, flushed when you approach | | |
| C13 ✅ | **The ringed planet** in the Driftwood sky (not in every mockup, add it anyway) | | |
| C14 ✅ | **Island audio** — waves, gulls, wind, planks vs sand footsteps, splash/stroke (partly landed with swimming), sword whoosh/thud | | |
| C15 ✅ | **Menu + loading**: hero art and thumbnail in style B (from an in-engine screenshot once the beach exists), loading-screen steps/nouns/weights for an ocean shard, the SUPER EXPERIMENTAL tag | | |

## Sword combat (decided)

- **No block, no dodge.** Strafing is the dodge; otherwise you eat the hit.
- **Two or three swing animations, not one repeated** — a **three-hit combo**: tap-tap-tap plays swing 1 → 2 → 3
  as one chained animation; tapping again restarts the combo. Each swing has its own arc and trail.
- Hit test: reach ~2.2 m from the eye during each swing's active window, `Targets.raycast` → `applyDamage`,
  damage floats and health bars from `src/ui/Combat.ts` unchanged. Wooden 12, iron 28.
- Boars need hit-stun / a knockback so melee isn't a pure hit trade; boar senses retuned for an open beach.
- Touch: tap on the look area swings (same as the crossbow's fire); the AIM disc is repurposed or hidden.

## Water (decided)

- Swim forever, no drowning, no stamina.
- Diving: DIVE (hold) down, SURFACE up, that's it. Underwater is decorative for now.
- **Chunk edge over water is the same chunk edge** — the boundary force field continues under the surface.
- Weapon holstered while swimming; white gloves on the hands at all times (both shards, styled per shard).

## Island layout (from `art/driftwood-map-topdown.png`, north up)

- **JETTY** spawn: south edge midpoint, pier runs north ~60 m to the crescent beach. Sailboat at its sea end.
- **HUT** plateau: centre-west, stepped green terraces, fenced footpath + wooden steps down to the beach.
- **RING SHRINE**: NW jungle clearing with the spring pool.
- **LOOKOUT**: NE, the tallest basalt cliff, rope bridge from the ledge to the tower.
- **WRECK COVE**: east, the rocky side; waterfall + cave behind the wreck.
- Smaller jetties at the N/E/W edge midpoints — the shard's other entry roads (`buildTerrain` forces
  those strips to y = 0; `ocean.level` sits just above so they read as submerged sandbars).
- Sister islets and sea stacks off the coast, inside the frame.

## Who builds what (parallel, same checkout, no worktrees)

| agent | owns | must not touch |
|---|---|---|
| world-agent | `src/chunks/driftwood-isle.ts`, `terrain.ts`, `Heightfield.ts`, `Ocean.ts`, `Pier.ts`, `Boat.ts`, beach/island modules, low-poly `Terrain.ts` path, `Boundary.ts`, `Horizon.ts`, bake/manifest | main.ts, player/, entities/, ui/ |
| sword-agent | `src/player/Weapon.ts`, `Sword.ts`, minimal `Crossbow.ts`, `ui/Combat.ts`, HUD ammo hide, sword audio | main.ts, Player.ts, TouchControls.ts |
| boar-agent | `src/entities/*` (`style: 'lowpoly'`), animals dev harness | everything else |
| swim-agent → dive-agent | `src/player/Player.ts`, `TouchControls.ts` (+css), `Hands.ts`, `WaterLine.ts`, water audio | Heightfield.ts, weapons |
| parent | `src/main.ts` wiring, ASKS.md, screenshots to the user, deploys | |

Screenshots headless only (`agent-browser`, own session name, ALWAYS close). Commit own files by path,
push after every commit. `npx tsc --noEmit` clean for your files before each commit.

## Not in scope (yet)

Inventory / equipment UI (user: "I'll deal with inventory and equipment later"), underwater world,
drowning, blocking/dodging, palms on Pine Hollow, the other three jetties as real entrances.

## Enemies (C16 ✅ — all five live, 8557c9c) — the island's roster

| enemy | where | behaviour | why it's fun | mockup |
|---|---|---|---|---|
| **Boar** (low-poly) | beach, palm groves | same AI as Pine Hollow; charges; hit-stun from the sword | the melee tutorial | `art/driftwood-fp-sword-*.png` |
| **Bear** (low-poly, black + brown) | wreck cove, NW jungle | the species-agent's stalk/charge AI, lowpoly paint | the "run" enemy — you can't out-trade it with the wooden sword | — |
| **Reef Crab** | tidepool rocks at Wreck Cove, in 3–5s | sidesteps around you, pincer snap with a wind-up, hard shell = light hits do 50 % from the front (flank it); tiny ones scatter | forces strafing (the user's "strafe is the dodge") | `art/driftwood-enemy-1-crab.png` |
| **Coconut Monkey** | palm groves, troops of 3–4 | climbs palms, throws coconuts (the island's only ranged attack, dodgeable), drops down to bite if you stand under it; flees when one dies | the first thing that hits you from a distance; makes the groves dangerous | `art/driftwood-enemy-2-monkey.png` |
| **Drowned Sailor** | inside the wreck's hold (always), the beach at night | slow shamble → cutlass swing; rises out of the water in the hold when you enter; guards the iron sword; glows cyan | the dungeon: the reason to go into the wreck, and the iron sword's guardian | `art/driftwood-enemy-3-wreckghost.png` |

All five are `src/entities/species/*.ts` entries in the species registry with a `lowpoly` paint; crab and sailor
are non-quadrupeds and need their own small rigs (crab: 6 legs + 2 claws on a body bone; sailor: humanoid,
6 bones). Gulls are ambient, not enemies.
