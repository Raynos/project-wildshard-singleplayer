# NALATI-MERGE — bring Nalati into the fold

**State:** `in progress` 2026-09-24 — done: M1–M2 (+ M3 a5f4821), F1–F11, R1–R4, H1–H4, P1–P4, Q1–Q5, L1–L4, D1–D2, E1. The user's picks still open (all switchable in pause ▸ Settings ▸ Debug ▸ Look lab, he plays first): the three look variants, Yurts, Camp people. Building: A1–A4 (the Nalati sound set, music slot, ambience, the Kazakh score — agent; the user picks takes on a listening page). Last: M3 (a final main merge) + E2 (the landing: the user merges the branch himself).

The ask: N16 ("main has moved a lot … bring Nalati into the fold … every new thing made for Wildshard has to be put into
Nalati"), with N15 (map text), N17 (riding), N18 (the bow), N19 (the horizon seam). The decisions, verbatim, are in
`docs/tasks/asks/N16.md` (waves 1–8). The reviews behind every row:
[review-engine.md](../design/nalati/merge/review-engine.md) (physics, Explore, models, boot, WebGPU, lock-on, clocks)
and [review-experience.md](../design/nalati/merge/review-experience.md) (HUD, remaster techniques, music + audio, quests).

## Rules for every row

- This branch never pushes. Commit small with a pathspec; the four gates + `pnpm test` green on every commit;
  `node scripts/nalati-boot-check.mjs` (all three shards boot, 0 page errors) before a row is ticked.
- Main keeps moving (~280 commits / day): the main session merges `origin/main` into the branch every day or so and
  fixes the fallout; agents never merge.
- Pine Hollow and Driftwood must not change look or behaviour because of a Nalati row (gate everything on
  `style === 'painterly'` or a Nalati module).
- Look changes ship as **Look Lab variants** (the user's pick): a switch + a comparison sheet; the user picks, the pick is
  locked in, the losers leave.
- Headless = muted (`&mute=1`, `--mute-audio`); ≤ 3 headless browsers machine-wide; progress images as JPEG < 500 KB in
  `progress/nalati-merge/<row>/`.
- Phone target (the user): **30 fps, max graphics**; keep main's 2× phone render scale unless the camp budget can't
  hold 30 (then 1.5×).

## M — the merge itself

| # | row | state |
|---|---|---|
| M1 | Merge main (70c28ac) — 25 files / ~65 hunks; DayNight vs DayClock, Wind vs wind (case clash → steppeWind.ts), Sky, Sword (strikeMove, main's sweep), touch HUD (main's + Nalati extras), map (main's; N15), achievements (event rows), boot, audio | ✅ 1a0f1ef |
| M2 | Merge main (4539c39: E96–E98) + the Minimap paint fix | ✅ deddcb9, 25e7cd8 |
| M3 | Keep merging main as it moves; the last merge right before the user lands the branch | ongoing (main session) — a5f4821 (main 3b4150c, clean, gates + boot 3/3) |

## F — merge breakage and small fixes (no pick needed)

| # | row | files | size |
|---|---|---|---|
| F1 | WebGPU → Nalati always runs WebGL, whatever the saved renderer (black screen today) | Game.ts / gpu gate | S · ✅ 1442d3f |
| F2 | Nalati's `chunk.weapon` is 'sword' → its own value: no unused iron sword; the hurt arc (main's B3) on Nalati too | chunk def, main.ts | S · ✅ 747c837 (`weapon: 'nalati'`, `meleeShard()`) |
| F3 | deathLine: Nalati respawns on the north road ("respawning on the north road"), lightning / storm deaths named ("Struck by lightning") | HurtArc.ts | S · ✅ 549c47c (+ b064fcb: a throw reads "Thrown from the saddle") |
| F4 | Boot: declare the 6 rigged creature GLBs (~4 MB) in the boot pack; the service worker cache-first for `/assets/nalati/`; the immutable-header issue for edited models (hash or version the URLs) | boot/*, sw, vercel.json | S–M · ✅ 8fc4d5c (every Nalati file fetched as `?v=<content hash>`, so vercel.json's immutable stays right) |
| F5 | E91 NaN clamps where Nalati still has them unclamped (ghost riders, the kurgan dungeon); E89's shadow step on Nalati's clock | nalati/* | S · ✅ 0278c4f |
| F6 | Audio quick fixes: Nalati plays Pine Hollow's theme → the steppe mood / a placeholder until A3; leaked clips (the eagle elite screams with Driftwood's monkey, the leopard growls with Pine's bear, pine-needle footsteps on grass) | audio, nalati/sound.ts | S · ✅ b064fcb (the Golden King still borrows the bear growl / sailor groan → A5) |
| F7 | Settings that do nothing on Nalati (Tracers, Swing-turn speed) either work or hide; two runtime bakes empty after a GPU restore (E54 path) | settings, nalati/look | S · ✅ 4492d17 (Tracers hidden; Swing turn speed already worked — the sabre sets `swinging`) |
| F8 | The clocks behind one interface (wave 8): Settings ▸ Time of day, Explore's light presets and the HUD glyph reach Nalati's DayClock; one engine clock is a later row | world/DayNight, DayClock | M · ✅ c4d7407 (`src/world/WorldClock.ts`; the glyph itself is H2's) |
| F9 | The Golden King lies tilted diagonally in his fight (procedural + the new model alike — a pose / orientation bug in src/nalati/kurganBoss.ts; progress/nalati-merge/d/d1-ingame.jpg) | kurganBoss | S · ✅ 19bbf9a (root cause: Animal.sampleTerrain tilted him to the mound's slope 140 m below the chamber — pitch 21–64°, roll 26–62°; `levelGround` on the King + the adds → 0° through phases I–III; progress/nalati-merge/f9-11/f9-king-*.jpg) |
| F10 | Phone: the quest dialogue box (main's shared DialogueBox) covers the weapon tabs / discs on Nalati's HUD D — place it clear of them on Nalati | QuestUI / nalati-hud.css | S · ✅ 17337a1 (quest.css under `#hud.nalati-d`, portrait: above AIM / JUMP, between the weapon tabs and CROUCH; over BRACE with the spear; f10-dialogue-phone.jpg) |
| F11 | The full map: the elder's marker label "BAQYT ATA" overlaps "NOMAD CAMP" | Map / quest places | S · ✅ 88a6ab2 (`setPois(…, { declutter: true })`, Nalati only: the marker label goes above its diamond; f11-map-*.jpg) |

## R — riding (N17) and the horse's body

| # | row | state |
|---|---|---|
| R1 | Hotfix: the rider's capsule no longer blocks the horse; Player.update stops clobbering the saddle camera; the ridden horse off every aim / projectile query ("HORSE · 1 M"). Then the rebuild the user picked: the stick steers the horse, the camera follows (RDR2 / KCD first person), no strafing, inertia, head / neck lead the turn, gait bob; DISMOUNT = the HORSE right-edge tab (one toggle); HOVER hidden in the saddle; LEAN / OFFER placed on main's layout; research in docs/design/nalati/riding-research.md | ✅ fa2ba06 ca80143 39deb1c (progress/nalati-riding/) |
| R2 | The horse on its own CharacterMotor in the fixed step (wave 7), the rider's capsule off while mounted; the horse's climb limit (~35° at a gallop, steeper at a walk; 40° on foot stays); fence jumps, the bridge carries you | ✅ 92ab497 101c568 — a capsule lying along the horse (PLAYER group), stepped at 60 Hz, drawn from game.alpha; 47° at a walk → 35° at a gallop by the rein's gait; a real jump (1.5 m arc, auto over a rail by castRay); Mount's hand-rolled collide / groundAt / obstacleAhead deleted. Measured (scripts/nalati-ride-physics.mjs, progress/nalati-riding/r2/): 21.3 m in a 3.5 s gallop, eye 2.30 m; a yurt stops it 0.29 m off; the corral rail stops a walk, a canter jumps it; on the bridge deck the whole span; a 40° face refused at a gallop, climbed at a walk. The deck still carries it through the P2 floor bridge until P-3 makes it a collider |
| R3 | Stampedes: through a player on foot (knock-down + damage), collide with a rider (jostle, can unseat at a gallop) | ✅ d25ec2f 92ab497 — on foot the stampede / the stallion's charge pass through the player (passThrough) and knock him down; mounted they hit the horse's body: a jostle (shove + jolt), thrown at a gallop when closing ≥ 9 m/s (head-on thrown, riding with the herd kept in the saddle) |
| R4 | Mounted lock-on (the camera tracks the target, the horse steers freely) | ✅ 23d41aa (built with H3: in the saddle the lock tracks, the stick steers the horse, MOVE never reads ORBIT) |

## H — the HUD (main's HUD + Nalati's elements)

| # | row | state |
|---|---|---|
| H1 | Mockup round: variants A–D (edge tabs · bar-edge folder tabs · one arc + a weapon card · status left / actions right), each on foot and in the saddle → one A/B/C/D board; the user picks | ✅ d629016 — art/hud/round-12-nalati-merge/board.jpg; **the user picked D (status left)** |
| H2 | Build **D — status left** (a left column: VITALS, STEED, ARROWS, the day + storm row, HIDDEN; weapon tabs on the left edge; HORSE / DISMOUNT on the right edge; a clean centre) — A–D in art/hud/round-12-nalati-merge/D-*.jpg: the merge breakage (DODGE over DRAW, CROUCH over JUMP, main's SWAP pill beside the weapon strip, GALLOP / storm chip / GET LOW / elite + boss bars placed for the old minimap) → one under-minimap stack (quest chip, storm, elite or boss bar, banners + GET LOW); the weapon switcher per the pick; the sun / moon glyph on the minimap rim; HOVER on foot only | ✅ fd08f31 (src/ui/NalatiHUD.ts; evidence 55c4d0c — progress/nalati-merge/h2/sheet.jpg engine \| mockup, scenes.jpg). Left vs D: the quest chip waits for Q1–Q3; AIM reads DRAW and FIRE has no HOLD = DRAW until H4; one HORSE / DISMOUNT spot (D drew DISMOUNT higher); GALLOP in JUMP's spot (D: a little lower) |
| H3 | Lock-on for the sabre and spear against every Nalati hostile (wolves, elites, ghost riders, balbals, bosses); the bow later with N18 | ✅ 23d41aa (on foot and in the saddle; Jel Ata's heart from anywhere in the arena — scenes.jpg) |
| H4 | The bow (N18): hold FIRE to draw, release to loose, release before full = let down (no shot); AIM a toggle that zooms down the arrow (Skyrim's flow; research first); desktop the same (LMB hold / RMB toggle); mounted archery keeps working | ✅ 3dbc5c7 (bowDraw.ts + test) · 1594ba4 (the flow: FIRE hold + ring + HOLD = DRAW, AIM toggle zoom 2×, no snap shot, gallop draw unblocked) · c9344e0 (the horse's head on the bridge: H2's capture found a real bug — the horse pitched ~20° to the gully under the deck) · evidence 4c6073a — progress/nalati-merge/h4/sheet.jpg; research docs/design/nalati/bow-research.md. Left: draw creak / let-down sounds (two-model SFX), bow lock-on (later) |

## P — physics (full, the user's pick)

| # | row | state |
|---|---|---|
| P1 | Every Nalati builder registers with main's world registry (`colliderDescs()`, surface, `model`) — yurts, fences, corrals, bridge, kurgans, balbals, watchtower, crags / ledges, Eagle Rock, the dungeon, props — replacing the 1,834 legacy bridge boxes; the 13 floor functions become colliders / treads / graded paths. **Explore (World + Model Explorer) turns on for Nalati in the same change** (wave 8), the creatures shown in their painterly style | ✅ c731ea7 · d034f03 · 0bfc5bf · 1b4e044 — 47 registry pieces, ~2 590 colliders (hulls for rocks / crags / 1 350 boulders, felt prisms for yurts, slabs + treads for every floor, balbals + the dungeon seal as `follows` pieces, the sand drifts a heightfield); `player.colliders` 1 834 → 0, floor functions 13 → 0; Explore on (13 models + creatures, painterly). Walk (new Nalati route, 11 legs): 30 → 13 stuck — the watchtower got a stone stair (2 → 0); **left for P4:** Eagle Rock's knoll approach (8) and the leopard cave's last shoulder (3, + 2 at the leg's start on the W road's walkway) stay past 40° (so on HEAD too), the camp spur's end runs into the hitching rail (trails 1 + 1). Phone calls / tris unchanged (+6 k tris at the watchtower). Evidence: progress/nalati-merge/p1/ |
| P2 | Arrows, javelins and Naizagai on `src/physics/query.ts` (castSegment / sweepBall) — no hand-rolled collision left in Projectiles.ts / Spear.ts; arrows stick where they hit | ✅ b7cd530 — arrows / javelins sweep a ball through the world (the crossbow's `worldHit`), stick by material (felt, earth, planks, wood, grass…), glance off stone and lie; the drop arcs use the same query; Naizagai's call is a castRay |
| P3 | A navmesh for Nalati (bake-navmesh Nalati branch, water = the Kunes + brook): herds, wolves, elites path around things | ✅ 868d599 — the bake builds Nalati's statics as src/nalati/index.ts registers them (2 464 colliders: POIs, outcrops, crag rock, dressing, paths); the water is the Kunes' whole corridor + the brook (a road through its margin kept: the bridge's ends). One 0.3 m layer, climb 0.4 (at 0.3 recast's ledge rule cut every slope past 31°, the bridge's 34° approach included): 249.5 KB raw, **129 KB brotli** (≤ 150 budget; a second 0.5 m layer was 216 KB), declared in the boot's `physics` files like main's. Nalati's thinkers path on it (`navSteer`, Nalati only): `steer` keeps a clear heading and turns round what the navmesh walls off, goal moves take the path's next corner (pack roam / shadow / ring, herd drift, the stallion's guard + charge, the dog, the elites' way home + chase). Pine Hollow / Driftwood unchanged (navmesh.bin byte-identical, walks 0 stuck). `?navmesh=debug` view; test/nalati-navmesh.test.ts. Evidence: progress/nalati-merge/p34/p34-navmesh-*.jpg (camp, camp-top, bowl-top, the three footpaths) |
| P4 | `physics-baseline --mode=walk` + `--trails` on Nalati: 0 stuck; every POI reachable at 40°; ragdolls for kills within the tier caps; the phone budget re-measured | ✅ d6fcb24 · 7168373 — **walk 13 → 0 stuck (12 legs), trails 6 → 0 (16 legs)** (before = HEAD b8d9358; progress/physics/p34-*.json). Three footpaths, graded ≤ 27° with a bench across (`TerrainSpec.graded.bench`, off elsewhere): Eagle Rock's knoll onto its crest (the scramble's first 10 slabs lay 3 m under it), Aqbars' cave shelf, and Argymaq's +52 pasture (no way up before); the camp spur now clears its fence, the hitching rail and the trough; the sky road's "stuck" was the harness spawning under the bridge's south ramp (legs now land on the floor, trail ends under a deck trimmed). **Reach** (scripts/nalati-reach.mjs, the navmesh from the spawn): 27 → 29 / 32 POIs, the 3 left are snow-lotus scenery on the valley walls; stairs (watchtower, the scramble) walked by the route. **Ragdolls** (scripts/nalati-ragdoll-check.mjs, 3 horses + 2 wolves killed in one frame): phone 2 live (the rest the keyframed fall), 12 awake bodies; desktop 5 live; frozen after 9 s, the cap frees. **Phone budget** (nalati-camp9, phone tier): 63–92 calls, 0.75–1.40 M tris at the nine camp poses (≤ 150 / 2.0 M; unchanged vs L4); physics-baseline poses at 4× CPU: frame JS p50 3.6–4.2 ms, animals.update (the navmesh steering in it) p50 0.2–0.7 ms, p95 1.4–1.8 ms, 74–104 calls. Mount's dead `player.platforms` loops gone (ride legs pass: bridge deck the whole span). Evidence: progress/nalati-merge/p34/ (stuck-maps.jpg, reach-shard.jpg, ragdolls-phone.jpg, camp9-*, ride-legs.jpg) |

## Q — the quest line (three chapters, main's Adventure layer)

| # | row | state |
|---|---|---|
| Q1 | Split a shared quest core out of Driftwood's Adventure code (objective line, NPC dialogue, reward caption, map places with discovery that persists, blue markers, the quest chip + the MAP tab card) so a second shard can use it; Driftwood unchanged | ✅ f879edf (src/game/quest/core.ts: QuestChip · NpcTalk · placesWithDiscovery · QuestLine; Driftwood on it, checked: Wendell by E, the chip, a shard, its marker) + 1697056 (Nalati's 17 map places on saved `seen:` discovery, not the unsaved fog) — evidence de4f1b7 |
| Q2 | The camp's people: painterly procedural figures now (the elder = the quest giver, herders, a child, a woman at the stove); generated + rigged models later (row D2) | ✅ aa36a2c — src/nalati/campPeople.ts: Baqyt Ata, Dauren, Erlan, Ayan, Gulnar Apa; one BatchedMesh (1 draw + 1 shadow); face you, gesture while talking; registry capsules — progress/nalati-merge/q/q2-* |
| Q3 | Chapter 1 **TULPAR**: the elder, tame Argymaq, win the kokpar | ✅ 1697056 — the elder → break a stallion (Argymaq has his own lines) → a kokpar round (src/nalati/kokpar.ts, new: snatch the goat mounted, into a tai-qazan) → home; chip ◆ TULPAR n/3 │ marker, MAP card, title "Formerly On Foot"; catches up from the saved taming — progress/nalati-merge/q/q3-* (25/25, phone + desktop) |
| Q4 | Chapter 2 **THE GOLDEN KING**: three balbal clues at dusk, open the great kurgan, the boss, the gold plaque home | ✅ baa205c + c6e2beb — the elder gives it after TULPAR; a balbal toppled at dusk shows its carving (clue n/3, the kill hook chained) → the kurgan's door (`inside`) → the King (saved Boss.defeated) → the plaque to the elder; title "Honorary Balbal" — progress/nalati-merge/q/q4-* (evidence 3d23a5c) |
| Q5 | Chapter 3 **FATHER OF THE WIND**: three storm feathers from the elites, light the wind cairn, Jel Ata in the storm | ✅ baa205c + c6e2beb — a feather per named elite felled (the saved elite store; markers on the ones left) → the strip tied at the cairn in a storm (the titan's `tied`) → Jel Ata (saved Boss.defeated) → home; title "Weather Complainer (Successful)" — progress/nalati-merge/q/q5-* |
| — | The bosses stay open any time; the quest catches up from the saved boss state (wave 5) | rule — built in: every event is polled from the saved stores (taming, boss, elite), a boss beaten first skips the steps to it (test/quest-nalati.test.ts; scripts/nalati-quest-check.mjs --only=chapters reloads over saved wins) |

## A — audio (MiniMax Music 3 · MOSS-SoundEffect v2 + Stable Audio 3 Medium, per AGENTS.md)

| # | row | state |
|---|---|---|
| A1 | The Nalati sound set: every Nalati sound (~40: wolves, horses, sheep, marmots, eagles, bow draw / release / impacts, sabre, javelin, hooves by ground, the steppe bed, wind, river, storm, thunder) generated with both models, the better take per sound, into main's one merged `sfx/best` set | open |
| A2 | Music engine: a 4th music slot (Nalati), zone crossfades | open |
| A3 | The score: a 6-take instrument test (dombra, kobyz, sybyzgy, a throat drone); then one Kazakh-folk score whatever the style setting, 3 zone variants (Nalati Grasslands / Sky Grassland / Snow Lotus Valley), calm / alert / combat / night / storm + stings; the throat drone only in the night + boss cues; one boss track each (the Golden King; Jel Ata = the storm cue); a listening page for the picks; the credit "Music: MiniMax-Music3" | open (the user picks takes) |
| A4 | Zoned ambience for the three zones (like Driftwood's IslandAmbience) | open |

## L — look (the Nalati Look Lab)

| # | row | state |
|---|---|---|
| L1 | N19 — the far background: the painted panorama's lower band **blends** into the fog / terrain colour (the user's pick: blend, no new far geometry); no visible cut where the slab ends | ✅ 1324ac6 (progress/nalati-horizon/n19-sheet.jpg; `?horizonblend=0` = before) |
| L2 | The Nalati Look Lab: Settings ▸ Look switches + comparison sheets, like Driftwood's | ✅ 76208bc — Settings OPTIONS `terrainShadow` / `terrainAO` / `modelShade` (`?tshadow=1` `?tao=1` `?modelshade=1`), pause menu ▸ Settings ▸ Debug ▸ Look lab (Nalati only), all LIVE (no reload), all off = today's look; `window.__lookLab.set(k, on)`; scripts/nalati-looklab.mjs shoots off \| on on one page (c9ad9cd) |
| L3 | Variants (wave 6): terrain in the shadow bake (long dusk shadows off the crags) · baked terrain AO / bounce · Driftwood's shading for generated models (the "blue plastic" boulders) | ✅ built 76208bc, sheets c9ad9cd (progress/nalati-merge/look-lab/<variant>-sheet.jpg) — **needs the user's pick** per variant. terrainShadow (look/terrainLight.ts, a heightfield pass): clearly better at dusk (Eagle Rock / the crags throw long shadows over the plateau, a player in them stands in cool shade), no change by day · terrainAO + bounce: subtle — the crags' clefts and the bowl's folds deeper, the meadow barely changes, the green bounce hard to see · modelShade (glbPaint.ts: lowpolyKit's voxel AO per vertex + the painted floor's blue lift cut to a fifth on the GLBs): modest — dark rocks read darker stone-grey instead of navy, grounded at the foot; the blue is reduced, not gone |
| L4 | The phone budget at 30 fps with main's 2× render scale + 80 m animal shadows (the camp poses); 1.5× only if 2× can't hold 30 | ✅ c9ad9cd (look-lab/budget.md) — phone tier, 390×844 @3 → pixel ratio 2 (780×1688), 4 FP camp poses: 63–93 calls, 0.86–1.27 M tris, identical with every variant off / each on / all on (budget ≤ 150 / ≤ 2.0 M); GPU per frame (timer query, the Mac) ~3.8–4.2 ms p50 off or all on — **2× stays**, no case for 1.5× (an iPhone reading is still the user's). Plus the 1-px seam due north in the painted panorama: fixed 3daa25d (padded strip + cross-fade at north; look-lab/seam-north.jpg) |

## D — models

| # | row | state |
|---|---|---|
| D1 | N12's leftovers (the Golden King, the collie, Qara Batyr's ghost horse, the generated yurt): both pipelines (main's Blender + TRELLIS.2 / Hunyuan3D), the better one in-engine per model, registered through the world registry | ✅ 2bfe2e8 0f1741a fe6fe3b 2e6ecdc — sheets progress/nalati-merge/d/ (models-sheet, generators-sheet, d1-ingame, yurt-camp). Kept: King, collie, ghost horse = image-to-3D (Hunyuan3D-2 beat TRELLIS.2 on all; the Blender cut loses the King's scale and rigged the ghost horse badly), rigged: the King on his own bones (new humanoidRigBake.ts; crown + cloak still come off), the collie on the sheepdog, the ghost horse for kind ghost-rider (captain + night riders) — all AnimalManager species, so Explore's creature catalog shows them. Yurt: procedural still wins in the camp; of the two models the Blender one (scripts/blender/nalati_yurt.py, 76 KB) replaces the Hunyuan yurt, a Look Lab pick (Yurts, next load) — **the user's pick** |
| D2 | The camp's people as generated + rigged models (after Q2's look is approved) | ✅ fe6fe3b 2e6ecdc — both pipelines per figure (Blender faceted / image-to-3D atlas, Hunyuan3D-2), one SkinnedMesh on the procedural figures' root / head / arm (src/nalati/campPeopleModels.ts), procedural stays default: Look lab ▸ Camp people (`?people=proc|blender|gen`); sheet progress/nalati-merge/d/people-sheet.jpg (same draw calls, +≤ 0.05 M tris) — **needs the user's pick** |

## E — landing

| # | row | state |
|---|---|---|
| E1 | Nalati in the shard picker with an **EARLY ACCESS** tag | ✅ b642a95 (ChunkDef.earlyAccess, a cyan EARLY ACCESS banner; progress/nalati-merge/e1/) |
| E2 | The last main merge, the gates, a boot check on all shards, JPEG art, then the user merges the branch himself | open (last) |

## Out of scope (decided)

- A Blender terrain bake for Nalati (its look v2 bake stays) · the WebGPU port · the shard-module refactor (ENGINE-FIT E5) ·
  the learned LUT (not in the first Look Lab wave).

## Open questions for the user (parked while he is AFK; defaults in force)

- L3 (the user, 2026-09-24): "I need to still play it — keep them all in the Look Lab": terrain shadows, terrain AO + bounce
  and model shading all stay switchable (pause ▸ Settings ▸ Debug ▸ Look lab, default off) until he picks after playing.
- H2: the sun / moon rim glyph on Driftwood + Pine Hollow too? (wave 8 said "every shard"; H2 kept it Nalati-only to leave
  main's HUD untouched) — default: Nalati only.
- H2: D's sky row reads "DAY" next to the glyph while wave 6 said "no text" for the clock — default: keep D's word in the
  status column, the rim glyph has none.
- H2: Nalati's DODGE sits where D drew it (a flatter arc than main's DODGE / JUMP diagonal) — default: D's spot.
- H2 (main's own layout, not Nalati): on Pine Hollow with the crossbow, AIM overlaps DODGE — flag to main's HUD owner.
- H4: every loose is now a full draw, so the Golden Bow's sun arrow fires on every shot (it used to need a full draw) —
  default: as is; limit it if it plays too strong.
- H4 numbers: AIM 2× zoom, the arms tire at 8 s (a let-down), AIM a toggle with no stamina cost (Nalati has no player
  stamina) — defaults as built.
- H4: the draw creak / full-draw click / let-down have hooks but no sounds yet → A1 (the two-model sfx run).
- H4 found: a 1 px vertical seam in the painted panorama due north, visible only when zoomed → L row (panorama art).
