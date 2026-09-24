# Pine Hollow — the mega remaster (graduate Pine Hollow out of experimental)

**State:** `in progress` 2026-09-24 — Jake's go ("mega build this plan") after 5 rounds of picks (§2). Built in the worktree `../wildshard-pine-hollow` (branch `pine-hollow-remaster`, never pushes; previews go to their own Vercel project; Jake merges). **Wave 0 is running:** the 4 decision boards (§2 B1–B4), the baseline plus the Track 0 bug audit, and the sound lane. Waves 3–4 reuse Nalati's systems, so they wait on the Nalati merge to main (N10). This is a parallel track, at equal priority with the other live work.

## 0. Why, and the finish line

Pine Hollow is the original shard (16–17 Sep): a photoreal PBR hunting sandbox with good bones.
- 1,770 Scots pines on BatchedMesh with a 3-band LOD.
- 1.5 k lines of interactive log cabins.
- 4 species with rarity and legendaries.
- Crossbow, harvest, Rapier colliders, a navmesh.

Every remaster since then went around it. Driftwood's D8 kept it "byte-for-byte". Nalati built its own look. So Pine Hollow never
got a quest, an NPC, a boss, day / night, weather, a mockup loop, a LUT, a painted horizon, Blender, image-to-3D, generated
creatures or zoned sound. The title still tapes it off as **EXPERIMENTAL · rough edges** (`src/chunks/pine-hollow.ts:84`,
`src/ui/HUD.ts:448/491`).

**Each shard keeps its own style** (Jake, PH-U1): Driftwood is faceted toon, Nalati is painterly, and **Pine Hollow stays
photoreal PBR**. The remaster raises Pine Hollow *within* photoreal. It reuses the other shards' *pipelines* (mockup loops,
Blender, image-to-3D, LUT fit, horizon painting, wind, rig bake), never their shading.

**Finish line: Pine Hollow graduates.** Every item below is measured, not asserted:
1. `experimental` is gone: blurb, enter hint and hazard band. It is a full card after Driftwood, which stays first.
2. **Look:** the 9-angle mockup loop (photoreal targets) is signed off by Jake at every zone. Every region is under ΔE00 6.
   The title hero is an in-engine capture.
3. **Content** is on Nalati's level:
   - the ranger's lantern quest ending at the Antler King, plus the lodge's rotating contracts;
   - 4 named elites, and the King's thralls at night;
   - day / night, dawn fog and rain;
   - the trophy wall and the hunter's journal;
   - resin, tokens and secrets;
   - the mill hamlet with a trader and a miller;
   - map discovery and 14 or more achievements.
4. **Sound:** theme 1 kept, plus night, boss and the dawn sting; zoned ambience; a generated SFX set; NPC barks; interior reverb.
5. **Perf:** Jake's iPhone holds a **steady, locked 30 fps** (Low Power off) at every pose. Desktop runs at 60 fps with at most
   300 calls. Load is about 30 MB cold. Physics reports 0 stuck.

## 1. The audit: Pine Hollow vs Driftwood vs Nalati (main `4539c39`, nalati `8a58b9d`)

| Axis | Driftwood | Nalati | Pine Hollow today |
|---|---|---|---|
| Style | Faceted low-poly toon | Painterly | Photoreal PBR, Poly Haven splat |
| Sky / time | Stylized sky, DayNight 20 + 4 min | Panorama + DayClock + regrade | Fixed HDRI sunset |
| Horizon | Painted 360° matte | 360° panorama + rings | 17 Sep procedural ridge rings |
| Colour | Learned 33³ LUT, every region under ΔE00 6 | Filmic grade + zone tints | Split-tone grade |
| Wind | Shared `wind.ts` (`aSway`, shadows move) | `steppeWind.ts` | Grass-only private wind; the pines don't sway |
| Assets | Blender cove, TRELLIS / Hunyuan props, CC0 kit | Codex → TRELLIS → colour-matched GLB | Procedural + Poly Haven GLBs, runtime pine cards |
| Creatures | Rigs; captain via Hunyuan | Generated hulls rig-baked, coats | Procedural PBR fur |
| Story | Castaway spine, captain boss | 2 bosses, 5 elites, taming | **None**: `Adventure.ts:5` returns null |
| Achievements | Table | 14 | 6 |
| Audio | Themes, `IslandAmbience` zones, merged SFX | Creature voices, storm | `pine` theme 1, one forest bed |
| Phone | 72–160 calls, ≤ 0.96 M | 52–95 calls, ≤ 1.4 M | 104–133 calls, ≤ 1.54 M; pond p95 50 ms; **E94 pop**; iPhone 30 fps (old) |
| Desktop / load | — / ≤ 20 MB | — / 19.8 MB | 741–989 calls / 23.5–24.4 MB |

**Keep:**
- the cabins;
- the forest's scale;
- fauna rarity and legendaries (the "Pine Hollow rule": cosmetic drops, joke titles);
- the crossbow's feel and harvest;
- Explore World (E66).

## 2. Jake's decisions (2026-09-24)

| # | Decision |
|---|---|
| PH-U1 | **Look: photoreal PBR**. Each shard has its own style. The toon, painterly and "storybook" directions were declined. |
| PH-U2 | **Map D**: the bowl + creek / waterfall into the pond + old-growth (the King's clearing) + the crag ridge with a fire-lookout tower and zipline + a bear cave + **the mill hamlet** (south). |
| PH-U3 | **Story: both.** The ranger's *Warden's Hollow* lantern quest → the Antler King → dawn, **plus** the lodge contract board. |
| PH-U4 | **Name: Pine Hollow** (unchanged). |
| PH-U5 | **Rifle: a lever-action hunting rifle** replaces the AR-15 (same pickup, Old Ironhide's skin slot). |
| PH-U7 | **Time: the full cycle.** 20 + 4 min, dawn / day / golden hour / night, like Driftwood, in photoreal. |
| PH-U8 | **Weather: dawn ground fog + rain.** No thunderstorms or snow: Jake's final answer narrowed an earlier "incl. storms". |
| PH-U9 | **No wolves, no fishing.** **The King's thralls** replace wolves: moss-grown, glassy-eyed elk and boar he calls from the fog. They are phase-II adds and roam the old-growth at night. |
| PH-U10 | **The hunt's systems: the trophy wall + the hunter's journal.** No tracking, calls or tree stands. The journal is a **generic engine Compendium** (entries, discovered / taken, stats, a 3D viewer slot), filled with data per shard. Pine Hollow skins it as a leather hunter's journal. |
| PH-U11 | **Creatures: generated + rigged** (Nalati's pipeline, PBR textures, rarity as coats). Procedural stays as the fallback. |
| PH-U12 | **Music: keep theme 1** (pine calm / tension) **+ add** calm-night, the Antler King's boss track (3 phase stems) and the dawn sting. |
| PH-U13 | **Elites (4):** Old Ironhide (boar), the Ghost Stag, Old Blackpaw (bear), the Imperial Bull (elk). |
| PH-U14 | **The hamlet: the hunting lodge's contract board + a trader + the miller** (a side errand). |
| PH-U15 | **Ranged only.** Crossbow, lever-action, and the Warden's Longbow (the King's drop). No melee. |
| PH-U16 | **No currency.** The trader swaps items for items (hides / antlers / resin → special bolts, cartridges, cosmetics); contracts pay in trophies and skins. |
| PH-U17 | **Trees: a Blender-built photoreal species set.** Hero Scots pine, old-growth fir / cedar, birch, dead snags, saplings; baked into the existing card + impostor LOD. |
| PH-U18 | **Budgets: the phone at a steady locked 30 fps; load about 30 MB.** Desktop 60 fps, ≤ 300 calls. |
| PH-U19 | **Title deck: Driftwood stays first.** |
| PH-U20 | **Tone: eerie folklore.** Fog, lantern light, glassy-eyed thralls, the King an ancient guardian gone wrong. Unsettling, not gory; cleansed at dawn. |
| PH-U21 | **Contracts: a rotating set of 3.** Finishing one draws the next. No real-time clock; works offline. |
| PH-U22 | **Collectibles: ~30 amber resin drops, 8 carved wooden tokens, the secrets** (the vista bench, a hollow-log passage, the canoe to the islet). No lore notes. |
| PH-U23 | **NPCs: text dialogue + short generated voice barks** (the SFX engines). No full voice acting. |
| PH-U24 | **Priority: a parallel track**, equal with Driftwood V2 / HUD / physics polish / Nalati Phase D. |

**Boards Jake asked to see before the layout and the models are built.** Each is one portrait decision board, A / B / C / D,
in `art/pine-hollow/round-<n>-<label>/board.jpg`:
- **B1**, the Map D layout → **Jake picked A** (2026-09-24): the Ridge along the north (fire lookout, waterfall, zipline south to the Hollow), the Den in the NW corner, the old-growth + the King's clearing in the west, the still pond north-centre-east fed by the waterfall, the creek running SE to **the mill hamlet in the SE** (hunting lodge), the Hollow + ranger's cabin at the centre, the south-gate spawn unchanged (`art/pine-hollow/round-1-map/A-ridge-north.jpg`);
- **B2**, the Antler King → **A, the Bark Warden** (bark-plated body, bone skull face, 3 antler lanterns, amber ribcage). Jake liked all four and asked for "the simplest one with the highest chance of AAA success in game". A is chosen for buildability: the solid bark plates are the kind of hard surface TRELLIS / Hunyuan reconstruct well and that skins cleanly. B's hanging moss needs alpha cards plus secondary motion. C's thin roots break image-to-3D and skinning. D's 12 lanterns cost 12 emissive / light sources. A's 3 lanterns fit the fixed light pool (PH-L3), and the amber glow matches the lantern-warm night;
- **B3**, the thralls + the ranger (3 each) → **the ranger = A, the old warden** (grey beard, campaign hat, brass badge, long coat, lantern). Jake said "A or B, whichever we can implement in game". A is chosen because the hat hides the hair and the beard covers the mouth: those are the two things generated humans get wrong, and the ranger only has barks, so no lip sync is needed. The long coat is a near-rigid mass that skins cleanly. B's braid hangs free and needs secondary motion, and her face is more exposed (more uncanny risk). **The thralls = A, Overgrown** (moss and ferns on the coat, glowing cyan glass eyes; `thrall-A-overgrown.jpg`, Jake's pick). PH-M2 builds them as a coat on the regular elk / boar hulls (moss / fern albedo + normal, emissive eyes) plus a few rigid fern clumps bound to the spine bones: no new rig and no hanging strands;
- **B4**, the journal + trophy wall UI (phone portrait).

## 3. Wave 0: prerequisites (running)

| # | Row | Owner | Gate |
|---|---|---|---|
| PH-0.1 | **Nalati on main** (N10, Jake merges). Waves 3–4 reuse its Elite / Boss / DayClock / Weather / creatureRigBake / GroundTell. The branch merges main in after it lands. | Jake | Pine Hollow + Driftwood + Nalati load with 0 page errors |
| PH-0.2 | **The shard module interface** (ENGINE-FIT E5): `ShardModule { build, look, quest, audio, fauna, loadSteps }`. Pine Hollow's `isOcean`-else branch moves out of `main.ts:143–322` first, into `src/shards/pineHollow/`. | engine lane (after 0.1, to avoid a second `main.ts` conflict) | each shard's program SHA unchanged by the refactor alone |
| PH-0.3 | **Generalise the house pipelines off their shard names**: `scripts/blender/export-scene.mjs --chunk`; `fit-lut.py` / `palette-delta.py` / `scripts/horizon-matte/*` take the shard; `nalati-chunk-views` / `-camp9` / `-walk` / `-creature-*` → shard-agnostic; `creatureRigBake` reads `public/assets/<shard>/models/`; the Adventure registry per shard | tools lane | each tool re-produces its Driftwood / Nalati output byte-for-byte |
| PH-0.4 | **Track 0 bug audit** (B-table like Driftwood's E7): E94 forest / shadow pop; the rifle muzzle light's program recompiles; `config.ts:15` and `Music.ts` defaulting to Pine Hollow; Pine Hollow's loading nouns showing on Driftwood (V-X1); `isDry` below pond level; the splat NaN sweep (E66 / E91 class); stale `docs/SHARDS.md` | baseline lane | one commit per bug with before / after |
| PH-0.5 | **Baseline**: 9-angle captures at 5 anchors (south gate, Hollow cabin, still pond, ridge cabin, bear den; `tod` frozen, cameras recorded in a JSON the loops reuse); phone ruler at gate / cabin / pond; desktop; `bench:ci`; Jake's iPhone reading | baseline lane + Jake | `art/pine-hollow/round-1-baseline/` + numbers here |
| PH-0.6 | **Boards B1–B4** (§2) | boards lane | Jake names a letter per board |

### Baseline (PH-0.5), measured 2026-09-24 at `0599c67`

**9 angles × 5 anchors** in `art/pine-hollow/round-0-baseline/` (the round-1 slot went to board B1):
- `cameras.json` holds every camera, resolved. Each anchor has P and a face-to point, its ground height, and the nine
  cameras. The look loops (PH-L1) re-shoot exactly these with
  `node scripts/pine-hollow-views.mjs [--only=pond] [--tag=after] [--url=…]`.
- Shots 1–4 are FP at P: front / left / right / back, phone tier, iPhone 16 Pro UA, 390×844 @3, touch HUD, pitch −0.06.
- Shot 5 is TOP, 90 m straight down with the front up. Shots 6–9 are DIAG front / left / right / back, 45 m up and
  55 m out, looking at P. Shots 5–9 are desktop tier, 1600×900, fov 72°, no HUD, with the forest and grass LOD
  around the eye.
- Pine Hollow has no day clock yet (a fixed HDRI sunset), so `tod=0.4167&clock=1000000` only matters once PH-L2
  lands. Clouds and wind still move between shots. Animals are `calm`.
- The sheets are `gate-sheet.jpg` (P 0, −215), `cabin-sheet.jpg` (−20, −50 → the Hollow cabin),
  `pond-sheet.jpg` (−56, 95 → north over the pond), `ridge-sheet.jpg` (100, 131 → the Ridge cabin) and
  `den-sheet.jpg` (−127, −127 → the den at −150, −150). Each cell is labelled with its calls / tris.

**What the sheets show, for the loops:**
- The pine crowns read near-black from above.
- Close crowns are flat radial cards: the den and the ridge FP-right look into one.
- The 17 Sep ridge rings read as blue paper cut-outs in every DIAG.
- The chunk-edge glass wall shows behind the gate.
- The sun blows out into a bloom disc when you look west (cabin FP-left, den FP-back).

**Phone ruler.** `node scripts/pine-hollow-perf.mjs --url=<vite preview of a clean git archive HEAD export>`.
It reports the median of 30 frames of `game.lastFrame` per pose, 6 s after a spawn. Phone is iPhone 16 Pro
390×844 @3 `tier=phone`; desktop is 1600×900 `tier=desktop`. Raw numbers: `progress/pine-hollow-perf-baseline.json`.

| pose | phone calls / tris | desktop calls / tris |
|---|---|---|
| gate `x=0&z=-200&yaw=3.1416` | 114 / 1.32 M | 902 / 10.41 M |
| cabin `x=-14&z=-62&yaw=3.1416` | 153 / 1.65 M | 1073 / 10.53 M |
| pond `x=-56&z=95&yaw=3.1416` | 151 / 1.39 M | 690 / 8.31 M |

- Programs at play: 76 on the phone, 84 on desktop. The forest is on the batched path.
- Headless frame time is vsync-pinned at 16.6 ms p50. There is no 30 fps cap on the phone tier yet (PH-P1).
- Against the 22 Sep lever-12 numbers (104 / 133 / 120 calls), the cabin and the pond have drifted up by 20–30 calls.
  The drift is not yet broken down per group. One known contributor is E90: phone animal shadows now reach 80 m,
  where they stopped at 30 m.

The 9-angle FP shots at phone tier range from 79 calls / 0.72 M (the gate looking back) to 189 / 2.03 M (the pond
looking west) and 169 / 2.08 M (the ridge looking back). The god views run 250–1 630 calls and 5–12 M tris at desktop
tier. That is the E4b desktop problem, seen from above.

**Load** (`bench-load.mjs --url=… --conditions=wifi --cache=cold --query=chunk=pine-hollow&tier=phone`, 390×844, 4×
CPU):
- 24.36 MB over the network in 132 requests; 9.8 MB of that is `.bin`.
- Playable at 7.7 s. The longest steps are audio 2.0 s, shaders 1.05 s and terrain 1.03 s.

Jake's iPhone reading is still to come (his part of PH-0.5).

## 4. The world (Map D, layout A — `art/pine-hollow/round-1-map/`)

**Compass first:** today's names disagree with the compass (the "East cabin" at x = +62 sits west of the crossroads on the in-game compass; the den at (−150, −150) is SE on it). Layout A follows the **in-game compass** (N up on the minimap): the build renames / moves POIs to match it, and whoever writes `pineHollowLayout.ts` records the axis convention in its header.

All coordinates live in one import-free `src/chunks/pineHollowLayout.ts` (Nalati's pattern), with a 1 m flood-fill walkability
check (≤ 44°), then a re-baked `terrain.bin` and navmesh.

| Zone | What's there | New |
|---|---|---|
| **The Hollow** (today's bowl) | South gate spawn, crossroads, the Hollow cabin = **the ranger's home** (trophy wall), East cabin | Waystone lantern posts on the paths |
| **Still pond & the creek** | The pond (cheap reflection, PH-L9), reeds, a beaver dam; the creek falls from the ridge | Footbridge, waterfall, the canoe to the islet (secret) |
| **The Ridge** | Blender-sculpted granite crags above the Ridge cabin | **Fire-lookout tower** (vista bench, the ridge lantern) and the **zipline** down to the Hollow |
| **The Den** | Bear country, NW; a shallow **cave interior** | Old Blackpaw, the den lantern, cave reverb |
| **The Old-growth** | Giant firs and cedars, ground fog, moss boulders, fallen giants to walk along | **The Antler King's clearing**: standing stones, lanterns hung in the canopy; thralls at night |
| **The mill hamlet** (south) | Watermill + wheel on the creek, 3–4 buildings, fences, woodpiles | **The hunting lodge** (contract board), **the trader**, **the miller** |

## 5. The rows by track

### L: the look (photoreal; the method is Driftwood's loop with photoreal targets)

| # | Row | Gate |
|---|---|---|
| PH-L1 | **9-angle mockup loops** per zone (`art/driftwood-isle/round-4-remaster/README.md`): capture → 9 codex *photoreal* target edits → gap list → TOP-10 routed to tracks → 3×3 sheets → loop. Order: Hollow → pond → ridge → den → old-growth → hamlet. | Jake signs each zone's 3×3 |
| PH-L2 | **Photoreal day / night** (PH-U7): a physical sky + an HDRI set per time (dawn / day / golden / night, Poly Haven CC0, blended; `BakedSky` per key), CSM sun and moon, `Atmosphere` / `Volumetrics` re-keyed per time; the canopy god rays stay (the signature). The fixed sunset remains buildable by URL for captures. | program count stable over a full day; the variant sheet goes to Jake (taste) |
| PH-L3 | **Night lights**: cabin windows, lanterns, the fire pit and the waystones on the clock, from a fixed light pool driven by intensity only (Driftwood `c282abe`); moon shafts in fog; fireflies at the pond | no program churn over a day |
| PH-L4 | **Learned LUT** `public/assets/lut/pine-hollow.bin` from the signed-off photoreal mockups (`fit-lut.py`, `&nolut`) | every region under ΔE00 6; before / after sheet |
| PH-L5 | **Painted 360° horizon, photoreal**: forested ridges and far peaks, day + night (the `horizon-matte` pipeline, stacks topping near 10°); replaces the 17 Sep rings. Only infinity is painted; the walkable world stays 3D. | seamless at every heading; −calls |
| PH-L6 | **One shared wind**: pines, twigs, undergrowth and grass on `wind.ts` (`aSway`, `swayDepthMaterial`); a gust front visibly crosses the canopy | 0 extra draws |
| PH-L7 | **The forest re-LODded** (E94): the hi→lo swap and the shadow cascade agree; lo trees cast; the impostor cross-fades (dither); E90's method, cost measured first | walk-around video, no pop |
| PH-L8 | **Ground**: needle litter, moss and fern density by canopy; grass trample (Nalati's `GrassTrample`); photoreal ground sets re-checked for tiling from the mockups | ≤ the old tris |
| PH-L9 | **Water**: the pond off its planar re-render (a probe / panorama reflection + ripples, lily pads, reeds); the creek + waterfall with foam; rain rings | pond pose p95 under 33 ms (phone 30 fps) |
| PH-L10 | **Weather** (PH-U8): dawn ground fog pooling in the bowl and burning off; rain (canopy drips, wet PBR darkening + roughness drop, puddles, pond rings; animals shelter), on Nalati's `Weather` / `WeatherFX` | taste sheet (dry / fog / rain) to Jake |

### B: Blender and the asset pipeline

| # | Row | Gate |
|---|---|---|
| PH-B1 | **Blender Hollow**: `pnpm blender:island --chunk pine-hollow`; terrain at 2× grid; Geometry-Nodes scatter (rocks, logs, stumps, ferns); Cycles AO + bounce lightmaps (sun live); caster / cover tiles LOD'd and culled (`BlenderIsland` generalised); `?island=procedural` stays | phone ≤ the 30 fps budget at every pose; colliders + anchors exported |
| PH-B2 | **The Ridge crags + the cave** sculpted in Blender (V-B3's lesson: lightmap texel density up front) | hold at Native render scale |
| PH-B3 | **Hero props via image-to-3D** (TRELLIS.2 default, Hunyuan turbo; `run-locked.sh`; **PBR textures kept, no facet flattening**): the lodge, the lookout tower, the watermill + wheel, the standing stones, waystone lanterns, trophy mounts, beaver dam, footbridge, canoe, trader's stall, carved tokens, resin drops | a versus board per batch |
| PH-B4 | **Trees** (PH-U17): hero Scots pine, old-growth fir / cedar, birch, snags, saplings in Blender (Geometry Nodes, photoreal bark + needle textures), baked into the card + impostor atlases | lineup board; forest pose tris flat or down |
| PH-B5 | **CC0 photoreal kit**: Poly Haven models / textures (the shard's existing source), plus scanned rocks / logs; no low-poly packs | 20–30 models in `public/assets/models/pine-hollow-*` |
| PH-B6 | **The cabins, kept and lifted**: the ranger's home (bunk, map table, the trophy wall), the lever-action on its rack; each interior gets a reverb zone | Explore models re-registered |

### M: creatures and characters (Nalati's pipeline, PBR)

| # | Row | Gate |
|---|---|---|
| PH-M1 | **Deer, boar, elk, bear remodelled** (PH-U11): codex reference (legs planted, head straight) → TRELLIS.2 / Hunyuan with PBR texture → `creatureRigBake` onto their procedural skeletons → `<hull>[.phone].rigged.glb`; the variants (Ghost Stag, piebald, pale elk, Scarback…) as coats; `?creatures=proc` fallback | strips + lineup + motion video; phone creature tris ≤ today's |
| PH-M2 | **The thralls** (PH-U9): elk + boar hulls with a "thrall" coat (moss, bark scabs, glassy eyes) + a stiff gait variant | read as eerie folklore on the board (B3) |
| PH-M3 | **The Antler King** (board B2): a 7 m moss-and-bark elk, a glowing ribcage, antler lanterns; Hunyuan full + paint (the Drowned Captain's path); `selfLight` on the ribcage | boss strip + fight video |
| PH-M4 | **The NPCs**: the ranger (board B3), the miller, the trader. Generated, rigged humans with idle / talk / point clips. | read at 2 m on the phone |
| PH-M5 | **Ambient life** without wolves: owls, ravens (they come to a carcass), a woodpecker, hares; gull-style breadcrumbs toward unvisited POIs | `animals.update` ≤ 1.4 ms |

### C: content

| # | Row | Detail |
|---|---|---|
| PH-C1 | **Quest: *The Warden's Hollow*** | 1. The ranger: the Hollow's three waystone lanterns went dark, and something with antlers of light walks the old-growth at night. 2. **The pond lantern**: a creek-dam puzzle; drain the pool to reach it. 3. **The ridge lantern**: climb the lookout, then take the zipline back. 4. **The den lantern**: in Old Blackpaw's cave. 5. Follow the Ghost Stag to the old-growth. 6. **The Antler King**. 7. **Dawn over the Hollow**: the lanterns lit shard-wide, the Warden's Longbow. Driftwood's objective HUD, flags and interactables kit; saves per shard. |
| PH-C2 | **The Antler King** (Nalati's `Boss.ts`, `GroundTell`) | Night only, in the clearing; the fog closes as the arena wall. **I, the Warden**: antler sweeps and root-ring stomps (jump the ring); shoot the ribcage when it opens. **II, Lanterns Fall**: his lanterns drop and burn as hazards; he calls **thralls** out of the fog. **III, the Last Light**: all dark but his ribcage and your lantern, then charges down lanes. Phase checkpoints, reward orb, `?boss=antler-king`. Drops the **Warden's Longbow** (Nalati's `Bow.ts`: drop arc, wind drift) + a crossbow skin. |
| PH-C3 | **Four elites** (Nalati's `Elite.ts`) | **Old Ironhide, Terror of the Hollow**: telegraphed gore charge. **The Ghost Stag**: fades, unaimable for 2 s, reappears behind you; it leads quest beat 5. **Old Blackpaw**: roar-stun, ambush from the cave mouth. **The Imperial Bull**: at dusk his bugle calls rival bulls in. Each has a leash, phase 2 at 50 %, a banner, a minimap skull, a 20 min respawn, and a cosmetic drop + trophy. |
| PH-C4 | **The trophy wall** | In the ranger's cabin: every legendary and elite taken, mounted and persisted, with the joke title. Examine one = its journal page. |
| PH-C5 | **The Compendium (engine) + the hunter's journal (skin)** | `src/ui/compendium/`: data-driven entries (species / variant / elite / boss / place), discovered → seen → taken, per-entry stats, the Explore 3D viewer as the entry's plate. Each shard supplies data + a skin. Pine Hollow's: a leather journal, pencil sketches, pressed-page tabs (board B4). Driftwood / Nalati can adopt it later (not in this plan). |
| PH-C6 | **The mill hamlet** | **The lodge's contract board**: 3 rotating contracts (a species / a rarity / an elite / a thrall cull); finishing one draws the next; pays in trophies + skins; works offline. **The trader**: item-for-item swaps. **The miller**: a side errand (e.g. clear the thralls off the millrace at night; the wheel turns again). |
| PH-C7 | **Night & weather play** | Thralls roam the old-growth at night and flee the dawn. Rain makes animals shelter under the big firs. Dawn fog hides the Ghost Stag. |
| PH-C8 | **Collectibles & secrets** | ~30 amber resin drops, 8 carved wooden tokens (all 8 = a cabin decoration + a title); the lookout's vista bench, a hollow-log passage, the canoe to the pond's islet |
| PH-C9 | **Map & places**: named places with discovery, quest markers, the pond reading dark fixed (EXPLORE-V2 V3), pins for the new zones | every zone discoverable |
| PH-C10 | **Achievements to 14 or more** in the house voice: the King, each elite, the three lanterns, all resin, all tokens, the journal complete, a contract streak, the miller's errand | `achievements.ts` |
| PH-C11 | **Loadout** (ranged only): crossbow (hero), **lever-action** (PH-U5: model via image-to-3D, action cycle, its own SFX), the Warden's Longbow; special bolts / cartridges from the trader | the weapon strip reads on touch |

### F: combat feel

| # | Row |
|---|---|
| PH-F1 | Driftwood's hit-stop, trauma shake, hurt arc and impact kit for the crossbow / lever-action / longbow and the animals; `GroundTell` telegraphs for the bear and boar charges and the King; lock-on (E50) checked on fast creatures |
| PH-F2 | Harvest feel: a short skinning beat with sound; the carcass stays for the ravens |

### A: audio (MiniMax only for music; every SFX made by MOSS v2 + Stable Audio 3, the better take ships)

| # | Row | Gate |
|---|---|---|
| PH-A1 | **Music** (PH-U12): **keep theme 1** (pine calm / tension, 3 styles) + **new slots**: calm-night, the Antler King (3 phase stems), the dawn reward sting; ~6 takes per slot, `rank_v3.py`, demucs stems, bar-exact loops, −18 LUFS, ≤ 5 MB per style | a listening page for Jake (E57 style) |
| PH-A2 | **Zoned ambience**, `ForestAmbience` (the `IslandAmbience` pattern): Hollow, pond, creek / waterfall + the mill wheel, ridge wind, old-growth hush, cave, night (owls, crickets, the thralls' far calls), rain on canopy vs open, dawn birds | zones cross-fade |
| PH-A3 | **SFX set**: crossbow, lever-action (cycle, shot, the ridge echo), longbow; every animal voice (elk bugle, bear roar, boar squeal) + the thralls + the King (antler-bells, root stomps); footsteps on needle / mud / wood / rock / wet; doors, lanterns, the zipline, the waterfall, the mill | `sfx-best.json` per sound |
| PH-A4 | **NPC barks** (PH-U23): the ranger, the miller and the trader, 6–10 short generated barks each | versus-take page |
| PH-A5 | **Reverb IRs**: cabin, cave, old-growth, the bowl | on zone entry |

### P: perf and load (every row carries before / after numbers)

| # | Row | Gate |
|---|---|---|
| PH-P1 | **The 30 fps tier** (PH-U18): Pine Hollow's phone frame cap locked at 30 (no 30↔60 judder); the phone budget re-derived from Jake's iPhone at 30 (headless proxy: calls / tris logged per pose, target set after PH-0.5) | steady 30 on the iPhone at every pose |
| PH-P2 | **Desktop draws** (E4b): 880–990 → ≤ 300 (merge the cabin detail, BatchedMesh for props, undergrowth by cell) | ≤ 300, 60 fps |
| PH-P3 | **Load**: ≤ 30 MB cold; KTX2 / Basis for the photoreal sets; a Pine Hollow `SHARD_STEPS` with honest nouns | `bench:ci` with Pine Hollow's own budget |
| PH-P4 | **Physics**: creature physics LOD, navmesh re-baked for layout v2, `physics-baseline --mode=walk / --trails` 0 stuck, the zipline + cave colliders | ≤ 1.5 ms p50 |
| PH-P5 | **WebGPU** (V-G2): Pine Hollow on the TSL path; parity at the 9 cameras | mean \|Δ\| under 6/255; WebGL stays default |

### S: ship (graduation)

| # | Row |
|---|---|
| PH-S1 | Hero art from in-engine captures (the King's clearing at night, the Hollow at dawn); the native icons re-made |
| PH-S2 | `experimental` off; the blurb, enter hint and hazard band gone; the card sits after Driftwood |
| PH-S3 | `docs/SHARDS.md` rewritten for three shards |
| PH-S4 | Jake merges; the plan is archived; tag **v0.3** |

## 6. How it gets built

**Where:**
- worktree `../wildshard-pine-hollow`, branch `pine-hollow-remaster`, off main;
- **never pushes**;
- the dev server on its own port (5176);
- a playable preview on its own Vercel project (`pine-hollow-remaster`), from a clean `git archive HEAD` export;
- merged into main by Jake (the physics / Nalati recipe).

**How:**
- Up to 3 build subagents at a time, on disjoint files. The parent integrates, measures and redeploys the preview.
- Every milestone gets before / after shots in `progress/pine-hollow-<row>-<nn>-<slug>.jpg`.
- Art goes in `art/pine-hollow/round-<n>-<label>/`, committed as JPEG.
- Every taste change keeps the old look selectable and goes to Jake as a board.
- Headless browsers are muted, run as "iPhone 16 Pro", with at most 3 open on the machine.

| Wave | Rows | Lanes (disjoint files) | Waits on |
|---|---|---|---|
| **0** | PH-0.3 → 0.6, PH-A1 → A5 | boards (`art/pine-hollow/`), baseline + bugs (`Forest`, `tier`, `Rifle`, `config`, boot steps), sound (`scripts/music`, `public/assets/{music,sfx}`, `audio/*`) | — |
| **1: Look** | PH-L1 → L10, PH-B4 | look (sky / day-night / LUT / horizon), forest (`Forest`, `TreeFactory`, `wind`, Blender trees), water + weather | the baseline |
| **2: World** | layout v2, PH-B1 / B2 / B3 / B5 / B6, PH-C9 | blender, assets, layout + bake | board B1 |
| **3: Life** | PH-M1 → M5 | creatures, the King + thralls, NPCs | boards B2 / B3; Nalati on main |
| **4: Play** | PH-C1 → C11, PH-F1 / F2, PH-0.2 | quest + NPCs, elites + boss, compendium + trophy wall + hamlet | waves 2–3; board B4 |
| **5: Ship** | PH-P1 → P5 (running since wave 1), PH-S1 → S4 | integrator | Jake's sign-offs + iPhone |

## 7. Risks

- **Photoreal is the hardest target**, and the phone was already the tightest in the game. The 30 fps lock buys headroom;
  the pond, the desktop draws and the painted horizon are paid down first.
- **The `main.ts` conflict with the Nalati merge.** PH-0.2 waits until Nalati is on main, and the branch keeps its
  `main.ts` diff small until then.
- **Trees through image-to-3D come out as blobs**, so PH-B4 is built in Blender on purpose.
- **Nalati's systems are young.** Elite / Boss / Weather have only run on the steppe; the retrofit will find their shard
  assumptions (sealed-arena radius, grass-height stealth).
