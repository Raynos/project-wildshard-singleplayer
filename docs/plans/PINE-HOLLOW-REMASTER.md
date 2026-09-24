# Pine Hollow — the mega remaster (graduate Pine Hollow out of experimental)

**State:** `in progress` 2026-09-24 — Jake's go ("mega build this plan") after 5 rounds of picks (§2). Built in the worktree `../wildshard-pine-hollow` (branch `pine-hollow-remaster`, never pushes; previews go to their own Vercel project; Jake merges). **Wave 0 is running:** the 4 decision boards (§2 B1–B4), the baseline plus the Track 0 bug audit, and the sound lane. Waves 3–4 reuse Nalati's systems, so they wait on the Nalati merge to main (N10). **Wave 1 look:** PH-L2 day / night (`1cdeab3`), PH-L3 night lights (`7b1430b`) and PH-L6 wind (`20b58c9`) are built; the day / night board (`art/pine-hollow/round-5-day-night/board.jpg`, A clock vs B fixed sunset) waits on Jake's pick. PH-L9 water is built (`f996e5c`); its pond board (`art/pine-hollow/round-7-water/board.jpg`, A new vs B planar) waits on Jake's pick. **The perf lane** (§5 P, `ce944b5` → `fcb1f66`): the phone tier is locked at 30 fps, phone calls 99–155 at the six poses, desktop 1 059–1 070 → 224–490 (≤ 300 at 3 of 6; the rest waits on Cabin.ts merges and far animals); the cabins cast shadows again; the sky rings were the old planet. This is a parallel track, at equal priority with the other live work.

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
- **B4**, the journal + trophy wall UI (phone portrait) → **the journal = A**: a full-screen open leather book, one species per page, a pencil-sketch plate, a TAKEN stamp, SEEN / TAKEN / BEST / RARITY stats, tabs for BEASTS / ELITES / PLACES / TROPHIES, and sketches of the neighbouring entries with ??? for the unfound ones. **The trophy wall = C**: the mounts you have taken hang on the log wall, and what is left shows as chalk outlines with its name and a NOT YET TAKEN tooltip on look. The wall is its own to-do list.

**All four boards are picked** (2026-09-24): map A, King A, ranger A, thralls A, journal A, wall C.

**Round 6 (2026-09-24, after Wave 0):**
- **Day / night = A + a brighter night.** Keep the clock. Lift the moonlight so the forest reads at night, warm golden hour up so it doesn't read as dawn, and give cabin interiors a warm room lamp at night (from the light pool, intensity only).
- **Nalati: port the pieces now.** Jake chose not to wait for N10. The generic systems (Elite / EliteBar / eliteBrain, Boss / BossBar, the creature pipeline creatureRigBake / glbCreatures / creatureCoats / creatureRigs, and the shared Animal / AnimalFactory / AnimalManager / registry / WeaponPickup hunks they need) are copied from `nalati-grasslands` **verbatim** where possible, so the later merge sees identical files. Anything adapted is listed in the port commit.
- **Perf is a lane now**, at the next free slot: trace the +9–22 phone calls from the layout, the locked 30 fps phone cap, the desktop draw cut (~1,000 → 300).
- **No preview site.** Jake follows progress through images and boards only.

## 3. Wave 0: prerequisites (running)

| # | Row | Owner | Gate |
|---|---|---|---|
| PH-0.1 | **Nalati on main** (N10, Jake merges). Waves 3–4 reuse its Elite / Boss / DayClock / Weather / creatureRigBake / GroundTell. The branch merges main in after it lands. | Jake | Pine Hollow + Driftwood + Nalati load with 0 page errors |
| PH-0.2 | **The shard module interface** (ENGINE-FIT E5): `ShardModule { build, look, quest, audio, fauna, loadSteps }`. Pine Hollow's `isOcean`-else branch moves out of `main.ts:143–322` first, into `src/shards/pineHollow/`. | engine lane (after 0.1, to avoid a second `main.ts` conflict) | each shard's program SHA unchanged by the refactor alone |
| PH-0.3 | **Generalise the house pipelines off their shard names**: `scripts/blender/export-scene.mjs --chunk`; `fit-lut.py` / `palette-delta.py` / `scripts/horizon-matte/*` take the shard; `nalati-chunk-views` / `-camp9` / `-walk` / `-creature-*` → shard-agnostic; `creatureRigBake` reads `public/assets/<shard>/models/`; the Adventure registry per shard. **Main-side done 2026-09-24** (`cd594f2` Blender `--chunk`, `430b08b` LUT, `fb4da1b` horizon matte, `0b1402f` img2mesh `build_props.py` + `--keep-texture` PBR, `1499e55` Adventure registry). Driftwood's outputs are byte-identical and its program set is unchanged. **Left for after PH-0.1:** the `nalati-*` capture / creature scripts and `creatureRigBake` (not on this branch) | tools lane | each tool re-produces its Driftwood / Nalati output byte-for-byte |
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

### B-table (PH-0.4), the Track 0 bug audit, 2026-09-24

Each row is one commit on `pine-hollow-remaster`. The perf numbers use the phone ruler above, from a clean export.

| # | Bug | Commit | Before → after |
|---|---|---|---|
| B1 | **E94 forest / shadow pop.** On the phone, crowns swapped hi → lo at 55 m, inside the 80 m cascade. Twigs popped at 24 m, the impostor popped at 130 m, and trees 45–80 m behind you dropped their 200 m sunset shadows in and out of frame. | `cbbd51c` | Hi cards now reach 80 m, the cascade's edge. Lo → impostor dissolves over 118–130 m with complementary dither, and the twigs dissolve over 18–24 m. A shadow-aware cull keeps any tree whose shadow can reach the view. Phone tris at yaw π: 1.32 / 1.65 / 1.39 → 1.42 / 1.68 / 1.56 M. Looking down the shadows (yaw 0.95): 0.92 / 1.35 / 1.57 → 1.11 / 1.61 / 1.93 M. Calls and desktop are unchanged. On the board `progress/pine-hollow-e94-01-lod-pop.jpg`, mean \|A−B\| at 55 m drops 2.63 → 0.83 and at 130 m 3.54 → 2.16. Measured first: hi to 110 m (E90's distance) cost another 0.06–0.24 M, 2.13 M at the pond. |
| B2 | **The rifle muzzle light added a point light mid-play.** Taking the AR-15 or firing it recompiled every lit program. | `3b24464` | The light is now a pooled LightPool light, driven by intensity only (Driftwood `c282abe`), with none on Driftwood. Programs over take → fire → back were 76 → 104 → 113 → 113; now 76 → 76 → 76 → 76. |
| B3 | **`config.ts` defaulted to Pine Hollow** (`chunk://local/pine-hollow`, seed 1337) while `DEFAULT_CHUNK` is Driftwood. | `5026e39` | The defaults are now Driftwood's: `chunk://local/driftwood-isle`, 0 trees, seed `0x5ea1`. |
| B4 | **Pine Hollow's loading nouns showed on Driftwood** (V-X1): HDRI → PMREM, pine branch cards, cabins, crossbow, pine bark. | `cfe423f` | Nalati's `SHARD_STEPS` / `useShardSteps` / per-shard timing key are ported verbatim, so the N-merge is a no-op there. The shared table is now neutral, and Pine Hollow has its own nouns. Driftwood shows 5 Pine Hollow nouns before, 0 after (`test/boot-plan.test.ts`). |
| B5 | **`isDry` called Pine Hollow's valleys below the pond's level wet.** It fell back to a navmesh query per call; with no navmesh it called them wet. | `c8d42e5` | `isDry` now uses the navmesh bake's own wet test: under water only inside the pond's square, or anywhere on an ocean shard. 31 356 m² of dry valleys are dry again. At load, 22 of 168 animals stood in them; they no longer need a navmesh query per call. |
| B6 | **NaN sweep** (the E67 / E91 class) over the splat, water, grass, undergrowth and tree shaders. | `0f2bc9d` | `scripts/pine-hollow-nan-scan.mjs` found 0 non-finite pixels at all 45 cameras × 2 tiers. The pond's unguarded `vMirror.w` divide is now guarded. Every `pow(1 − N·V)` base was already clamped. |
| B7 | **Stale `docs/SHARDS.md`**: "only `'pine'`", "deer / boar", Pine Hollow as the only shard, and a pond pose facing away from the pond. | `e339dae` | The doc now covers two shards, `'pine' \| 'none'`, the 8 registered species and the right pose. |
| — | **`Music.ts` defaults to `'pine'`.** | not built | `src/audio/**` is the sound lane's. Handed to that lane. |

Found on the way, not built:
- Grass (`Grass.ts:331`), undergrowth and tree placement (`placement.ts`) still drop everything below the pond's
  level chunk-wide. The ~3.1 ha of valleys are bare of grass for the same reason B5 fixed. Fixing it changes the
  forest layout and colliders, so it needs a navmesh re-bake: it belongs with PH-B1 / layout v2.
- The instanced forest fallback (no `WEBGL_multi_draw`) keeps `loTreeShadows: false` on the phone. Lo trees now begin
  at 80 m, past the cascade, so they have nothing to cast. The iPhone should confirm `__world.forest.path === 'batched'`.
- The hi → lo swap at 80 m is still a hard swap. It is a silhouette change at the shadow edge, not a shadow change.
  Cross-dissolving it needs a second needles instance per tree in the band, which is a PH-L7 option.

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

### As built: layout v2 (layout lane, 2026-09-24, `870e707`)

**Axis convention (checked in code):** origin at the slab centre, ±250 m. **+z = north, +x = WEST, −x = east.** Sources: `HUD.ts` `bearingTo`
(heading = 180 − yaw°, 0 = +Z, 90 = −X), `Minimap.ts` (u = HALF − x, v = HALF − z), and spawn yaw π faces +Z. A map-A pixel (col, row)
on the 1254² board is ≈ (250 − 0.41·col, 250 − 0.41·row). Every coordinate is in `src/chunks/pineHollowLayout.ts`, whose header carries this.
Evidence: `progress/pine-hollow-layout-01-vs-map-a.jpg` (map A | god top-down | walk-check reach map) and
`progress/pine-hollow-layout-01-fp.jpg` (phone FP at the lookout, pond, hamlet and clearing).

| What | v1 | v2 (x, z · height) | Why |
|---|---|---|---|
| Spawn, crossroads, S road | (0, −235) π · (0, −10) | unchanged | map A: the gate and the Hollow stay |
| Ranger's cabin (v1 "Hollow cabin") | (−14, −34) | same site, pad +2.96 → **+3.59** | renamed; the landscape under it changed |
| **West cabin** (v1 "East cabin") | (62, 30) | same site, pad −11.2 → **−1.4** | x = +62 is west on the compass; the soft floor lifts it out of the old basin |
| Ridge cabin | (118, 142) | unchanged, +4.7 | it sits at the new ridge's foot, on the way to the Den |
| **Still pond** | (−56, 120), r 22, water −6.06 | **(−100, 110), r 30, water −3.00** | map A puts it north-centre-east, fed by the waterfall. The water line is now the datum: only the pond and the creek bed sit below it (0.56 ha, v1 2.96 ha of dry land below the pond) |
| Islet | — | (−94, 118), r 8, +1.4 above the water | the canoe secret; not reachable on foot; no trees on it (the forest skips pondMask) |
| The Ridge | — | foot z ≈ 150–175, crags +40 … +63, pass \|x\| < 13 for the N road | map A's north edge; the fundamentals keep the N road at y = 0, so it crosses through a pass |
| **Fire lookout** pad | — | **(36, 214), +46.5**, r 7 | the pass's west shoulder (map A: top centre). Reached by a graded traverse from the den spur: (150, 142) → (146, 158) → (110, 178) → (76, 196) → pad, ≤ 29° |
| Zipline | — | lookout deck (+11) → landing (4, 20), +0.3 (+3 deck) | 197 m, drop 54 m (15.4°), ≥ 6.4 m over the ground; a 5 m cut through the forest |
| Waterfall | — | lip (−86, 178) +32.8 → foot (−88, 146) +2.4; ridge-top stream from (−70, 236) | map A: it drops off the ridge into the pond's north shore |
| **Creek** | — | 13 points (−118, 92) → (−218, −250), 360 m. Bed −3.45 → beaver-dam sill (−138, 64) −2.8 → −4 … −9 at the S edge; ~31° banks | map A: pond → SE → the mill → off the slab |
| Creek bridge | — | (−151, −3), on the E road | the E road crosses the gully (a ford until the footbridge is built) |
| **The Den** | "Bear den" (−150, −150), SE on the compass | **(190, 186)**, floor +9, rock walls to +36 N and W; bear cave mouth **(200, 200)**, facing SE | map A: the NW corner |
| Bears | black ×2 at (−150, −150), brown at (+150, −150) (= SW) | black ×2 at (196, 192), brown at (182, 172), all in the Den | "move the bears' den there"; still 3 bears |
| Old-growth | — | ellipse (150, −40), 105 × 175 m; tree keep × 4, scale × 1.25 | map A: the west third |
| **King's clearing** | — | **(150, −30)**, flat r 30 (+3.8), blend to 42, bare to 38; 7 stones at r 24 with a gap facing the path in from the N | the boss arena |
| **Mill hamlet** pad | — | **(−150, −138)**, r 32, −0.4 (2.6 m above the water line) | map A: SE, on the creek's west bank |
| Hamlet sites | — | lodge (−162, −118), trader (−126, −120), miller (−142, −162), mill (−181, −144) + wheel (−191, −144) in the gully, shed (−118, −150) | pads for the asset lane's buildings |
| Trails | 5 (4 entry roads + a ridge-cabin spur) | 12: S / N / W / E roads + den, clearing, pond, hamlet ×2, ridge-cabin, lookout spurs | every zone joined; the W road runs through the old-growth, the E road over the creek |
| Explore POIs | 7 | 18, compass names (`PINE_HOLLOW_POIS`) | "Bear den" → The Den + Bear cave; plus lookout, zipline, waterfall, islet, dam, bridge, clearing, hamlet, lodge, mill |
| Trees | 1 770 | 1 519 | the ridge face is too steep to plant (−240); the pond, creek and pads take the rest; the old-growth gains |
| Fauna | deer 90 · elk 24 · boar 51 · bear 3 | deer 90 · elk 22 · boar 53 · bear 3 | fauna grid 60 → 56 m, so the cells the ridge / hamlet / arena / Den take come back elsewhere |
| Height range | −13.5 … +16.8 | −9.0 … +63.4 | the ridge (the chunks test's ceiling is 80; no change needed) |

**Checks.**
- **Walk check** (`node scripts/pine-hollow-walkcheck.mjs`, 1 m, ≤ 44° by the surface gradient): every POI with a foot spot is reachable from the gate; 85 % of the slab is reachable; the zipline clears the ground. PASS.
- **`physics-baseline --mode=walk`:** 0 stuck. The route's pond leg now goes to the new shore, and the porch expects +3.815.
- **`physics-baseline --trails`:** 14 legs, 0 stuck, 0 swim frames.
- **Draft fixes.** The first draft's lookout switchbacks got stuck at every hairpin: two graded shelves meet on the bisector with a step. A leg that climbs the face head-on becomes a half-fill embankment that starts metres above the ground. The fix is one diagonal traverse, with no hairpins.
- **Bake guard.** `bake-chunk.mjs` now hashes a chunk's sibling modules. Before, a layout-only edit left a stale `terrain.bin` marked "up to date".

**Phone ruler** (`pine-hollow-perf.mjs`, clean exports, same session). Before is `e2beca4`, after is `870e707`:

| pose | phone calls / tris before → after | desktop calls / tris before → after |
|---|---|---|
| gate | 113 / 1.42 M → 122 / 1.37 M | 902 / 10.41 M → 1052 / 10.64 M |
| cabin | 153 / 1.68 M → 175 / 1.50 M | 1073 / 10.53 M → 1073 / 9.94 M |
| pond pose (−56, 95), now forest between the Hollow and the new pond | 151 / 1.56 M → 161 / 1.34 M | 729 / 8.36 M → 637 / 6.52 M |

Phone tris fall everywhere. Phone calls rise by 9–22, and that is **not yet attributed**. Trees within 160 m of each pose went down, not up
(cabin 560 → 515). Suspects: the fauna grid moved (56 m cells), and the ridge's terrain and shadow casters now show above the horizon.
~~PH-P1 should break this down per group.~~ **Attributed** (perf lane, `ce944b5`, `progress/pine-hollow-drawcalls-layout-*.json`): all of it is animals — gate +4 main +5 shadow, cabin +14 +9, pond +2 +8; terrain, sky, forest and horizon unchanged. The 56 m fauna grid put more rigs within 45 m (3 draws each, per pass) and inside the 80 m cascade; the ridge adds nothing. Paid back by one shadow draw per animal (`925f0cf`). Phone FP at the new places: lookout 130 / 1.37 M, pond W shore 158 / 1.33 M, hamlet 122 / 1.21 M,
clearing 126 / 1.55 M.

**Left for other lanes:**
- ~~**No water surface in the creek or the waterfall.**~~ Built by PH-L9 (`f996e5c`, `src/world/PineStreams.ts`).
- ~~**Boundary line over the creek's exit.**~~ Fixed by PH-L9 (`f996e5c`): the line follows the ground, or the pond / creek water over it.
- **Baseline anchors point at empty forest.** In `art/pine-hollow/round-0-baseline/cameras.json`, the anchors `pond` (−56, 95) and `den` (−127, −127) now point at empty forest, and so do `pine-hollow-perf.mjs`'s pond pose and `physics-baseline.mjs`'s PH poses. New spots for the baseline lane's next round: pond (−60, 106) facing E; den (170, 165) facing NW.
- **Provisional Blender area.** `blenderArea.ts`'s provisional Pine Hollow area (the Hollow) is still valid, and wave 2 re-cuts it for map A.
- **Landmarks are pads only.** The tower, zipline, cave, stones, hamlet buildings, bridge and dam have no placeholder meshes yet. The coordinates are in the layout file for the asset lane.

## 5. The rows by track

### L: the look (photoreal; the method is Driftwood's loop with photoreal targets)

| # | Row | Gate |
|---|---|---|
| PH-L1 | **9-angle mockup loops** per zone (`art/driftwood-isle/round-4-remaster/README.md`): capture → 9 codex *photoreal* target edits → gap list → TOP-10 routed to tracks → 3×3 sheets → loop. Order: Hollow → pond → ridge → den → old-growth → hamlet. | Jake signs each zone's 3×3 |
| PH-L2 | **Photoreal day / night** (PH-U7): a physical sky + an HDRI set per time (dawn / day / golden / night, Poly Haven CC0, blended; `BakedSky` per key), CSM sun and moon, `Atmosphere` / `Volumetrics` re-keyed per time; the canopy god rays stay (the signature). The fixed sunset remains buildable by URL for captures. | program count stable over a full day; the variant sheet goes to Jake (taste) — **built `1cdeab3`, needs Jake's pick** on `art/pine-hollow/round-5-day-night/board.jpg` (A the clock at dawn / day / golden / night, B the old fixed sunset; the Hollow cabin anchor + the porch). `src/world/PineDayNight.ts`: 7 Poly Haven "Qwantani" pure-sky keys (dawn, sunrise, day, golden, the old sunset, dusk, moonlit night; `pineSkyKeys.ts`, pairs baked by `scripts/bake-sky-keys.mjs` with each key's sun painted out) blended on a dome turned to the clock's sun, the IBL re-rendered from the blend every 2 s in place; the same CSM lights (sun by day, a high cold moon by night, 0.25° steps), hemisphere, fog, in-scatter, shafts, god rays, grade saturation, clouds and far haze keyed per time. Sunrise NE, 52° at noon, sunset NW where the old sun sat. `?tod=<0..1\|dawn\|day\|golden\|sunset\|dusk\|night>&clock=1e6`; B = Settings ▸ Debug ▸ Sky "Fixed sunset", `?pinesky=sunset` or `?tod=sunset-fixed` (unchanged path; vs HEAD MAE 0.8 %). **Programs 79 at all 49 phases of a day** (fixed 76 as before; desktop 84 → 87: the dome, its env pass, PMREM kept). Phone calls / tris HEAD `20b58c9` 122 / 1.37 M · 175 / 1.50 M · 161 / 1.34 M (gate · cabin · pond) → day 122 / 1.34 · 177 / 1.53 · 157 / 1.34, night 122 / 1.33 · 177 / 1.52 · 158 / 1.34; desktop 1052 / 1067 / 640 → 1042 / 1045 / 648. Driftwood's program sources unchanged (phone 93, desktop 101, same sha). +1.6 MB of key pairs, fetched on demand. Note: `cameras.json`'s query pins `tod=0.4167`, so `pine-hollow-views.mjs --query=tod=…` cannot override it (first `tod` wins) — pass a cameras file without it. |
| PH-L3 | **Night lights**: cabin windows, lanterns, the fire pit and the waystones on the clock, from a fixed light pool driven by intensity only (Driftwood `c282abe`); moon shafts in fog; fireflies at the pond | no program churn over a day — **built `7b1430b`**: fires (pit, hearth) 0.7 → 1 and lamps (porch lantern, room) 0.1 → 1 of today's by `sky.lamps`, window / lantern glass emissive with them, the chimney plume's glow, moon shafts (the volumetrics keyed to the moon), fireflies at the pond (motes that move to a low 50 m band at night: 0 draws added). Found: the phone's shared cabin lights were never created (no cabin light on the phone at all) → now 2 pooled LightPool lights on the nearest cabin's fire pit + lantern (phone point lights 2 → 4, fixed). Programs 79 over the day. `progress/pine-hollow-L3-01-night-lights.jpg`, `-02-fireflies.jpg`. Waystones wait on the layout / quest lanes (they take pool lights the same way). |
| PH-L4 | **Learned LUT** `public/assets/lut/pine-hollow.bin` from the signed-off photoreal mockups (`fit-lut.py`, `&nolut`) | every region under ΔE00 6; before / after sheet |
| PH-L5 | **Painted 360° horizon, photoreal**: forested ridges and far peaks, day + night (the `horizon-matte` pipeline, stacks topping near 10°); replaces the 17 Sep rings. Only infinity is painted; the walkable world stays 3D. | seamless at every heading; −calls |
| PH-L6 | **One shared wind**: pines, twigs, undergrowth and grass on `wind.ts` (`aSway`, `swayDepthMaterial`); a gust front visibly crosses the canopy | 0 extra draws — **built `20b58c9`**: `wind.ts` `WIND_FIELD_GLSL` / `windGustAt` (a front every 150 m at 11 m/s downwind, bent and patchy); pines lean downwind in world space (crown ² weight, trunk gentle, twig flutter; depth materials too, so shadows move), grass / flowers / undergrowth on the same field (their private gust retired, look kept). Driftwood's sway untouched. Calls / tris / programs identical (phone 113 / 153 / 151, 76). `progress/pine-hollow-L6-01-wind-strip.jpg`. Left: trunk shadows still use the default depth material (a few cm of motion). |
| PH-L7 | **The forest re-LODded** (E94): the hi→lo swap and the shadow cascade agree; lo trees cast; the impostor cross-fades (dither); E90's method, cost measured first | walk-around video, no pop |
| PH-L8 | **Ground**: needle litter, moss and fern density by canopy; grass trample (Nalati's `GrassTrample`); photoreal ground sets re-checked for tiling from the mockups | ≤ the old tris |
| PH-L9 | **Water**: the pond off its planar re-render (a probe / panorama reflection + ripples, lily pads, reeds); the creek + waterfall with foam; rain rings | pond pose p95 under 33 ms (phone 30 fps) — **built `f996e5c`, needs Jake's pick** on `art/pine-hollow/round-7-water/board.jpg` ("which pond?" A the new pond, B the planar before, `?pond=planar`; pond W shore day / night + the N-shore shallows). `src/world/waterSurface.ts`: one water program ('ph-water') for pond, creek and fall, no extra render pass — the clock's PMREM sky with Fresnel (ior 1.333), the treeline and the Ridge mirrored through a 1-D **skyline probe** (per azimuth round the pond: the tallest crown from `forest.trees` or ridge, intersected per pixel as a cylinder), wind.ts ripples whose strength and roughness follow `windGustAt` (the gust fronts cross the pond; calm patches mirror), a Beer–Lambert depth tint (peaty, the shallows show the bed), foam, a shore scum line and a wet film draped on the bank. `Water.ts`: the probe pond (1 draw) + ~110 lily pads and a few water lilies (1 draw, turning and bobbing on the wind). The shore reeds were already Undergrowth's, on the L6 wind. `PineStreams.ts`: the creek ribbon along the layout's polyline over `creekSurfaceAt` (bed + 0.45 m, a thin sheet over the beaver dam's crest), uv.y = travel time so the ripples ride the flow and stretch where it is fast, white down the dam's face; the waterfall a curved sheet down the Ridge (off the rock where it is steep, bulged mid-sheet), a plunge foam ring on the pond and a mist spray (Particles' texture + fog): **2 draws** for all running water, 0 per-frame CPU (wind clock). **Physics:** the creek is water — `ChunkDef.streamAt` ← `creekWaterAt`: the player wades it (0.43–0.76 m, never swims), `isDry` calls it wet so nothing spawns in it, the navmesh still fords it (bake unchanged, up to date); `physics-baseline --mode=walk` 0 stuck (the creek-bridge leg wades across), `--trails` 14 legs 0 stuck 0 swim. `Boundary.ts`: the edge line now dips into the creek's notch. **Phone ruler** (`pine-hollow-perf.mjs`, clean exports `8995591` → `f996e5c`, + a `shore` pose (−60, 106) facing E): calls / tris gate 122 / 1.36 → 126 / 1.38 M, cabin 178 / 1.52 → 179 / 1.53, pond 161 / 1.35 → **127 / 1.11**, shore 168 / 1.37 → **121 / 1.14**; desktop pond 639 → 538, shore 836 → 629. 4× CPU (`physics-baseline --mode=poses`): pond render 11.2 / 13.9 → **6.8 / 8.6 ms** p50 / p95, rAF p95 20.3 → 20.1 ms (headless vsync; the phone's own 30 fps reading is Jake's). Programs 79 → 81 (water, lilies, spray; the planar program gone), **81 at all 49 phases of a day**; NaN sweep 0 non-finite at 11 water cameras × 2 tiers. `art/pine-hollow/round-7-water/water-day-night.jpg` (shore, fall, dam, creek at the road × day / night). Left: rain rings wait on PH-L10; the dam / footbridge meshes are the assets lane's (the water is shaped for them: the dam's crest is dry, the creek runs under the E road at (−151, −3)); the concentric rings in the sky NE of the pond are PH-L2's (on the before too). |
| PH-L10 | **Weather** (PH-U8): dawn ground fog pooling in the bowl and burning off; rain (canopy drips, wet PBR darkening + roughness drop, puddles, pond rings; animals shelter), on Nalati's `Weather` / `WeatherFX` | taste sheet (dry / fog / rain) to Jake |

### B: Blender and the asset pipeline

| # | Row | Gate |
|---|---|---|
| PH-B1 | **Blender Hollow**: `pnpm blender:island --chunk pine-hollow`; terrain at 2× grid; Geometry-Nodes scatter (rocks, logs, stumps, ferns); Cycles AO + bounce lightmaps (sun live); caster / cover tiles LOD'd and culled (`BlenderIsland` generalised); `?island=procedural` stays | phone ≤ the 30 fps budget at every pose; colliders + anchors exported |
| PH-B2 | **The Ridge crags + the cave** sculpted in Blender (V-B3's lesson: lightmap texel density up front) | hold at Native render scale |
| PH-B3 | **Hero props via image-to-3D** (TRELLIS.2 default, Hunyuan turbo; `run-locked.sh`; **PBR textures kept, no facet flattening**): the lodge, the lookout tower, the watermill + wheel, the standing stones, waystone lanterns, trophy mounts, beaver dam, footbridge, canoe, trader's stall, carved tokens, resin drops | a versus board per batch — **built** `d33c126` (kit + indoor lamps), `5901c55` (landmarks), `4a1ba34` (physics / navmesh), `75743aa` (art + evidence). **Buildings are procedural** on the cabins' kit and materials (image-to-3D is poor at buildings): the **fire lookout** (legs, bracing, five stair flights in a railed cage as Rapier treads, an open stairwell, the glazed cab lit by the cabins' lamp glass, the deck railing, the zipline launch + gantry); the **zipline** cable (197 m, 1.2 % sag) to the **landing** at (4, 20), which the N road runs under (`PineLandmarks.zip.{top,bottom,launch,landing}` for the ride row); the **mill hamlet** as ONE merged cluster (`new Cabins(sky, pineHamletBuildings())`: the lodge's log hall + porch + trestle table, the trader's stall with its hatch / counter / awning, the miller's house, the watermill with its stilted wing and the undershot wheel turning in the creek (`Cabins.wheelSpeed`; its door shut until PH-C6), the shed); the **creek footbridge**. **Props** (TRELLIS.2, `--keep-texture`; LOD0 1024² desktop / `.phone.glb` 512² / LOD1 256²; one InstancedMesh per LOD; hull colliders; `scripts/img2mesh/props/pine-hollow-hero.json`): stones a / b / c ×7 round the clearing (carved faces to the arena, ×1.35–1.6), waystones ×3 (pond W shore, ridge by the stair door, the den's mouth; an additive flame on `sky.lamps` + a lamp site the phone's pooled pair visits; `setLit(id)` for PH-C1), the beaver dam on the sill, the contract board by the lodge steps, the cave arch with a dark mouth (the interior is a later row). The waystone and board skip the normal map (the bake tore on thin parts). Boards: `art/pine-hollow/round-8-assets/board-props-1.jpg`, `-2.jpg`; evidence `progress/pine-hollow-assets-01-fp-day.jpg`, `-fp-night.jpg`, `-landmarks.jpg`. **Phone ruler** (clean exports 559cd90 → 4a1ba34, one session; calls / tris): gate 113 / 1.37 → 127 / 1.43 M, cabin 155 / 1.54 → 163 / 1.59, pond 104 / 1.11 → 109 / 1.13, shore 103 / 1.14 → 109 / 1.15, **hamlet** 98 / 1.12 → 140 / 1.56, **lookout** (the catwalk; before = the bare pad) 118 / 1.32 → 136 / 1.36 — every pose ≤ 175; programs 81–82 → 83–84, none added mid-play. Desktop calls 357 / 503 / 255 / 276 / 254 / 359 → 397 / 531 / 274 / 304 / 341 / 388 (PH-P2's). **Physics**: `--mode=walk` 6 / 6 PH legs 0 stuck (new: lookout-climb to the catwalk +11, zip-landing, creek-bridge, lodge-porch); `--trails` 14 / 14 legs 0 stuck (a trail ending under a building's floor now ends at the building); navmesh re-baked with the hamlet + landmarks. **Also** (Jake's round-6 'brighter night'): indoors, the phone's pooled pair takes the room lamp + hearth (`d33c126`, `progress/pine-hollow-assets-00-indoor-lamp.jpg`). **Left:** the canoe (TRELLIS made two crossed hulls from both refs; a reseeded run was queued); trophy mount shields (optional; the wall's own shields stand); carved tokens + resin drops (PH-C8's); the mill's door opens with the miller's errand. |
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
| PH-C4 | **The trophy wall** | In the ranger's cabin: every legendary and elite taken, mounted and persisted, with the joke title. Examine one = its journal page. **Built** `5695d34` (board B4 wall C): `src/world/TrophyWall.ts`, 7 slots on the ranger's cabin back wall (the Ghost Stag · the Antler King · the Imperial Bull over Old Ironhide · Scarback · the Grizzled Sow · Old Blackpaw) — taken = the species' own head + shoulders clipped from its bind-pose model on a wooden shield (one merged mesh), the rest a chalk outline + chalk name (one decal mesh); look at one → NOT YET TAKEN / name + joke title tip, [E] Examine → its journal page. Evidence `progress/pine-hollow-journal-01-wall.jpg` (left: one mount + chalk; right: a 6-mount preview). **Left:** the creature lane's generated mounts replace the clipped bind-pose heads (`TrophySlot.mount`); the King's mount when PH-M3 lands. |
| PH-C5 | **The Compendium (engine) + the hunter's journal (skin)** | `src/ui/compendium/`: data-driven entries (species / variant / elite / boss / place), discovered → seen → taken, per-entry stats, the Explore 3D viewer as the entry's plate. Each shard supplies data + a skin. Pine Hollow's: a leather journal, pencil sketches, pressed-page tabs (board B4). Driftwood / Nalati can adopt it later (not in this plan). **Built** `5695d34` + art `3d6501b` (board B4 journal A): state + save (`ws.compendium.v1`), hooks (animal within 120 m → discovered, in view ≤ 70 m with a clear line → seen, `onKill` → taken + kg, POI radius → visited), the leather book (phone portrait + a desktop two-page spread), 11 beasts / 4 elites / the King / 18 places, 39 codex sketches (`art/pine-hollow/round-6-journal-sketches/`). Open: **N** (desktop; J is lock-on's), the pause menu's JOURNAL, the touch JOURNAL disc under PAUSE, Examine on the wall. Evidence `progress/pine-hollow-journal-01-pages.jpg`, `-desktop.jpg`; 16 vitest. **Left:** elites move their `match` to the elite kinds when PH-C3 lands; the King answers to kind `antler-king` (PH-C2); the plate's 3D button (`Journal.onViewModel`) is unwired — Explore is title-only today. |
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
| PH-P1 | **The 30 fps tier** (PH-U18): Pine Hollow's phone frame cap locked at 30 (no 30↔60 judder); the phone budget re-derived from Jake's iPhone at 30 (headless proxy: calls / tris logged per pose, target set after PH-0.5) | steady 30 on the iPhone at every pose — **built `bea1910`** (headless: 100 % of drawn frames at 33.3 ms at all 6 poses, 4× CPU work p95 12.6–14.7 ms; the budget below). **Jake's iPhone reading is next** (Low Power off; `?fps=60` for the uncapped comparison) |
| PH-P2 | **Desktop draws** (E4b): 880–990 → ≤ 300 (merge the cabin detail, BatchedMesh for props, undergrowth by cell) | ≤ 300, 60 fps — **in progress**: 1 059–1 070 → 224–490 (`925f0cf`, `0bf74dc`, `fcb1f66`); ≤ 300 at the pond, shore and hamlet; the gate 358, lookout 376 and cabin 490 wait on the levers under "Left" |
| PH-P3 | **Load**: ≤ 30 MB cold; KTX2 / Basis for the photoreal sets; a Pine Hollow `SHARD_STEPS` with honest nouns | `bench:ci` with Pine Hollow's own budget |
| PH-P4 | **Physics**: creature physics LOD, navmesh re-baked for layout v2, `physics-baseline --mode=walk / --trails` 0 stuck, the zipline + cave colliders | ≤ 1.5 ms p50 |
| PH-P5 | **WebGPU** (V-G2): Pine Hollow on the TSL path; parity at the 9 cameras | mean \|Δ\| under 6/255; WebGL stays default |

### P as built: the perf lane (2026-09-24, `ce944b5` → `fcb1f66`)

**Rulers.**
- `node scripts/pine-hollow-drawcalls.mjs --url=<clean export> [--tiers=] [--poses=] [--query=tod=day&clock=1000000]` charges
  every draw three.js counts to the `__world` entry that owns the object, its pass (main / shadow / post) and its render
  target. The sum is exactly `game.lastFrame.calls`. Six poses: gate, cabin, pond, shore, hamlet (−150, −130) facing S
  and lookout (36, 208) facing S. It writes `progress/pine-hollow-drawcalls-<tag>.json`.
- `node scripts/pine-hollow-fps.mjs --url=<clean export>` runs the phone tier at 4× CPU. It records the drawn-frame
  interval (p50 / p95, the share at 33.3 ± 4 ms, frames under 25 ms) and the main-thread work per frame (input → fixed
  steps → updaters → composer.render).

**Per group, calls (main + shadow), tod = day.** Before is `ea1f44e`, after is `fcb1f66`.

| pose | phone before → after | desktop before → after | desktop after: animals · cabins · post · viewmodel · boundary · shadows total |
|---|---|---|---|
| gate | 126 → **114** | 1 059 → **358** | 130+26 · 27+12 · 37 · 26 · 19+3 · 65 |
| cabin | 178 → **155** | 1 070 → **490** | 84+61 · 83+76 · 37 · 26 · 17+3 · 179 |
| pond | 125 → **99** | 563 → **261** | 17+49 · 0+44 · 37 · 26 · 15+3 · 123 |
| shore | 120 → **99** | 613 → **274** | 32+45 · 0+47 · 37 · 26 · 15+3 · 122 |
| hamlet | 123 → **103** | 580 → **224** | 30+48 · 0+6 · 37 · 26 · 15+3 · 81 |
| lookout | 124 → **123** | 1 052 → **376** | 119+23 · 50+37 · 37 · 26 · 19+3 · 87 |

On the phone after, the cabin pose is animals 16+17, cabins 30+6, post 21, viewmodel 13, sky 7, boundary 8+1, pickup 8,
forest 3+3, props 3+3, undergrowth 5, water 4, particles 3, terrain 2 and grass 2.

**What was built.**
- **Animal shadows, one draw per rig** (`925f0cf`, `src/entities/animalShadow.ts`). three.js drew each fur / hard / eye
  group into every cascade. Now a skinned caster on the rig's own skeleton and buffers draws it once. A same-instant
  A/B lands inside the frame-to-frame noise.
- **Shadow-only casters are drawn at all** (`925f0cf`, `src/core/shadowLayer.ts`). three tests a caster's layers
  against the view camera in the shadow pass, so Cabin.ts's depth proxies (lever 12, `46868b5`) had never been drawn.
  **Since 22 Sep the cabins and the hamlet cast no wall or roof shadow.** They do again: phone cabin pose +4 shadow draws.
- **n8ao's transparency pass** (`0bf74dc`, desktop). It set `visible = undefined` on every multi-material mesh, so every
  animal was drawn a second time, 200–350 draws. It also re-drew all 3 shadow cascades after the main pass. Both are
  gone. The AO-only view is unchanged.
- **Desktop animal draw LOD** (`0bf74dc`): eyes merge at 60 m, one draw at 150 m (the phone uses 45 / 100). A
  same-instant A/B at 4 poses shows no animal in the diff.
- **The pickup's desktop draw distance** (`fcb1f66`): item 90 m, orb 200 m. The walls hide the AR-15 in cabin 1 at
  every distance measured.
- **The sky rings** (`297ca39`) were the 16 Sep ringed planet (`Sky.buildPlanet`, NE). Its banded ring read as ripples
  on the photo day keys, and it ignored the clock. On the clock it now fades with `Sky.night` and is not drawn by day.
  The fixed sunset is unchanged. `progress/pine-hollow-P-01-sky-rings.jpg`.
- **The 30 fps lock** (`bea1910`, `Game.start` + `tier.ts frameCapFps`). A frame is drawn once 33.3 ms − 4 ms have
  passed since the last one. That is every 2nd vsync at 60 Hz, every 4th at 120 Hz and every one in Low Power, and
  never two vsyncs in a row. A skipped vsync does nothing, so dt = 33 ms and the fixed steps run 2 × 1/60. Only Pine
  Hollow's phone tier is capped. Settings ▸ Debug ▸ Frame rate or `?fps=60|30` overrides it.
- Programs are unchanged: Driftwood 93 / 101, Pine Hollow 81 / 90; the cache keys differ only in minified names.

**The phone budget at a locked 30** (headless proxy; Jake's iPhone is the truth):

| | budget | now, worst pose | derived from |
|---|---|---|---|
| calls | ≤ 180 | 155 (cabin) | the 22 Sep iPhone held 30 at 179–209 calls (levers 1–3) and not 60 at ~180 |
| tris | ≤ 2.0 M | 1.55 M (cabin) | the same receipts at 1.7–2.2 M |
| 4× CPU work p95 | ≤ 20 ms | 14.7 ms (pond) | 60 % of the 33.3 ms frame; the rest is GPU and compositor |
| lock | ≥ 98 % of drawn frames at 33.3 ± 4 ms, 0 under 25 ms | 100 %, 0 | `pine-hollow-fps.mjs` |

The old 60 fps line (≤ 150 calls, iPhone ≤ 18 ms) is retired for Pine Hollow.

**Left (desktop ≤ 300 at gate / cabin / lookout).**
- **Cabin.ts (the assets lane's).** The cabin pose draws 83 main + 76 shadow cabin calls. Merge each cabin's detail
  (hardware / lantern / fire pit / crates / glass) per material. The near cabin's 20+ detail meshes and the props'
  per-cabin InstancedMeshes could share one `BatchedMesh`, and the detail casters could go into the depth proxy (desktop
  `cabinDetailShadows`). Worth about −100 at the cabin and −40 at the lookout. Import `SHADOW_LAYER` from
  `src/core/shadowLayer.ts` in place of Cabin.ts's own `9`.
- **Far animals** are ~100 one-draw rigs at 150–400 m: 130 draws at the gate, 119 at the lookout. Hiding past 250 m is
  inside the noise at the gate, cabin and mid poses, but moved a speck at the lookout vista, so it is a look change and
  Jake's call. The structural fix is a far-animal impostor batch: one draw.
- **Per-cascade shadow culling.** Near casters are drawn into all 3 cascades (cabin pose: 46 / 65 / 68 per cascade).
  Skipping a small caster in a cascade its shadow cannot reach is worth −30 to −40 at the cabin.
- **n8ao gives the world almost no AO.** In its AO-only view only the crossbow is shaded, because its transparency mask
  cancels the AO wherever nothing transparent is drawn. Its two extra scene renders cost ~40 desktop draws for that.
  Turning `transparencyAware` off would give the world AO (a look change, Jake's call) and save those draws.
- **The post chain** (37 on desktop, 21 on the phone) and the viewmodel (13, drawn 26 on desktop through n8ao) are
  other lanes' and unchanged.

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
