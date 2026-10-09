# Signal Dunes (`sunscar-dunes`)

Dark orange dunes just after sunset, under a deep orange and indigo sky with the first stars. The player cracks a
braided leather bullwhip at a dune ray that glides against the dusk and swoops at walkers, crosses the dunes to a
wooden signal tower on a far crest and lights its signal fire. Jake's pick: E363 **C · Signal Dunes**
(`art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg`); the look on the round-4 board stands.

Built from [docs/SHARDS.md](../../../docs/SHARDS.md), the template and [docs/ENGINE.md](../../../docs/ENGINE.md)
alone (E357 Z3, round 4). No engine edits.

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `experimental`, 50 |
| `style`, `kitLook` | `dusk`, `pbr` |
| `uses` | `quests`, `coins`, `loot`, `hover` |
| `ground` | `buildTerrain` over transverse dunes (`world/dunes.ts`), ±200 m playable: slip faces ~30° over long windward slopes, the wind blowing toward the spawn view (the far slip faces in shade, as the mockups draw them), authored landforms (`data/layout.ts` LANDFORMS: round 13's low crest, mostly under the field so its receding rows show; the tower's mound; a dune 150 m out along B's view; waymark 0's 18 m rise; E407 row 1), a crest under the spawn, flat pads at the caravan and the well, the boss basin (a 56 m sand bowl), four crest trails |
| `horizon`, `boundary` | two low dune rings in shadowed sand; no cloud sea; the drawn edge hidden (containment stays) |
| `loadout` | the bullwhip (held) and the kit hoverboard |
| `species` | `duneRay` (flying), `sandSkitterer` (burrowing packs), `duneStrider` (charger), `duneMatriarch` (the boss, flying): each its own brain |
| `audio` | `ambience: 'none'`, a silent score, kit voices for the whip's cues; no `preload` (asset-free) |
| `tiers` | no god rays, no AO |
| `assets` | `public/assets/sunscar-dunes/models/` (C6: the caravan, the dry well, the waymark brazier and the dune strider, Hunyuan3D-2 GLBs, 240 KB); card art is a bundled SVG, every other model is code |
| `dev.poses` | spawn, whip, ray, quest (standing) and the tower deck (eye only), in degrees |
| saves | the quest flags only (`Flags`): the paid reward (`sunscar.signal.paid`) and the Matriarch's record (`sunscar.matriarch.defeated` / `.paid`); the old `sunscar.signal` and `bossesSave` entries are read once to carry a current save over (C26), never written. Coins go through the platform purse (`bindRuntimeCoins`) |
| quest start | Sefa the caravan scout stands beside the spawn, 8 m to the right and behind (round 17: at 5 m the tracker dropped her distance) (`quest/scout.ts` SCOUT_AT; E407 row 9): the first look is the empty dune vista and the tower, as the mockups show; her pin and wave bring the player round to her |

## Its custom code, and why

| File | What |
|---|---|
| `plugin.ts` | the three hooks; `buildEquipment` builds the whip; `play` installs the creatures, the quest and the Matriarch |
| `data/layout.ts` | every place: spawn, tower, caravan, well, basin, the three waymarks, the yardang ridges, the packs' and striders' homes |
| `generators/places.ts`, `world/places.ts` | the half-buried caravan (logbook), the dry well (windlass crank, bucket, oil jar), the waymark braziers: the code-built parts (barrel, logbook, lantern iron, tent, cookfire stones, the well's marker pole) and every place's colliders an offline bake (`baked/caravan.glb` + `data/caravan.json`, `baked/well.glb` + `data/well.json`, `data/braziers.json`; SF72); the generated models, the lantern glass, the fires and the bucket live in `world/places.ts` |
| `generators/rocks.ts`, `generators/dressing.ts`, `world/baked.ts` | the yardangs and the dressing (carcasses, dead trees, scree) as offline bakes (`baked/rocks.glb`, `baked/dressing.glb` + their `data/*.json`; SF72); `world/baked.ts` draws every baked piece |
| `world/meshes.ts`, `boot/files.ts` | C6: the generated models load once in the `world` hook (and before the roster); each builder uses its GLB when it loaded and its code model otherwise. The well's generated bucket and crank are cut away (the code ones animate); the strider's facets bind rigidly to its seven bones (legs per quadrant). Recipe: `art/sunscar-dunes/round-7-models/props.json` |
| `data/spawns.ts`, `combat/creatures.ts` | the homes (a ray, 10 skitterers in three packs, two striders, `sunscar.home:<index>`) and the Matriarch's body as declared rows (`runtime.spawns`); the platform keeps them (`bindRuntimeHomes`: one creature per home, refilled after it falls), the runtime dresses each body |
| `species/skitterer.ts`, `species/strider.ts` | `SkittererBrain` (buried → burst → hunt on a ring round the player → rear and bite → retreat; re-burrows when left), `StriderBrain` (graze → face → a pawed 13 m charge, winded after; a horn sweep up close) |
| `species/matriarch.ts`, `combat/matriarch.ts` | the Dune Matriarch: the ray's body at 3.6×, 600 hp, a `BossBrain` with three phases (sweeping dives; a sand storm: fog to 8–62 m and two blown-sand shells round the player; grounded: tail sweep + wing buffet), BossBar, checkpoints, 20 coins once |
| `weapons/Bullwhip.ts` | rung 3 (`extends Weapon`, `blocks.viewmodel` + `blocks.melee`): a light crack lands one 7 m narrow lash at the crosshair 0.12 s after the press; Heavy (Mouse2, or a released touch hold) is an 8 m double crack whose first lash yanks a creature of ≤ 40 hp to the player's feet and whose second staggers a bigger one; a lash that hits no creature cracks the nearest `Crackable` in its lane (the well's crank: the double crack pulls it; an oiled brazier: any crack lights it) |
| `weapons/whipModel.ts` | the warm brown glove (palm, knuckles, thumb, cuff), the braided handle, a braided coil hanging from the hand and the live braided lash with a pale popper: one tube rewritten in place along the unrolling curve; a low warm emissive so the backlit viewmodel never reads black |
| `species/duneRay.ts` | a `flight` species (`above: 'ground'`) with a five-bone custom rig (`body`, `head`, two wings, tail) and `DuneRayBrain`: glide circles over the player, a dive at the chest with a `sphere` swoop (`SWOOP`, 14 damage), a climb out, a rest |
| `generators/tower.ts`, `world/tower.ts`, `world/build.ts` | the signal tower: its frame (legs, braces, deck, rail, crown, antenna, a 30-tread stair) and colliders an offline bake (`baked/tower.glb` + `data/tower.json`, eight instanced kinds; SF72), its keeper lamp, brazier and signal fire live in `world/tower.ts`; `buildWorld` registers every piece and interactable, the crackables and the quest state |
| `quest/install.ts` | "The signal", four steps: the caravan's logbook → oil from the dry well → the three waymarks → the signal fire (it summons the Matriarch); five coins once |
| `look/render.ts`, `look/sky.ts` | the `extend` look: the clean engine chain, a dusk dome with stars, violet fog, a low warm key light, sand painted by hollow / crest with a ripple patch |
| `audio/cues.ts` | the whip's cues on kit voices until its own crack is generated |

## Budgets

Phone 30 fps (9.6 ms CPU), desktop 60 fps (4.8 ms): the template's inputs. `budgetCeilings.ts` is the lead's recorded
data and stays as recorded; a measured GPU-memory change goes to the lead.

## Look

Dusk, just after sunset: an orange band low in the sky (brightest ahead-left of the spawn view), mauve, violet and
indigo above with stars; dark orange sand that cools to blue-violet in the hollows, fine ripples near the eye; violet
fog from 70 to 330 m; the tower and the ray read as dark silhouettes. The baseline HUD only: the whip is ATTACK
(HOLD = HEAVY), the hoverboard is HOVER.

## Tests

- `test/shards/sunscar-dunes/contract.test.ts`: boots every stage headless, tears down, lights the fire and pays
  once, the whip's lane, the ray's swoop.
- `test/shards/sunscar-dunes/manifest.test.ts`: node-safe manifest, walkable dunes, the capture poses.
- `test/shards/sunscar-dunes/whip-input.test.ts`: Attack / Heavy / touch-hold release, holster cancels a charge.

## Open asks

- E374: Jake's look at the content board and the boss clip (`art/sunscar-dunes/round-6-content/`).
- E374 C6: Jake's look at the model board (`art/sunscar-dunes/round-7-models/`). The Matriarch and the tower stay code.
- Leftovers: the whip crack and a wind bed generated locally (MOSS + Stable Audio), a dusk score (MiniMax).
