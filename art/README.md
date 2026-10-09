# AAA target mockups

## Index — `art/<subject>/round-<n>[-<label>]/`

One folder per thing being mocked up, one subfolder per round (a round = the images generated
together for one ask). File names never change; a new round gets a new folder. Rounds dated from
when the images were generated.

| folder | round | files |
|---|---|---|
| `pine-hollow/` | `round-1-target-look` (09-16) | `mockup-01…06` — the AAA target look + title screen (below) |
| `hero-images/` | `round-1-coming-soon` (09-17) | `hero-{driftwood-isle,nalati-grasslands}-{portrait,landscape}` — deck-menu heroes for the "coming soon" shards |
| | `round-2-pine-hollow` (09-17) | `hero-pine-hollow-{portrait,landscape}` (copied into `src/chunks/thumbs/`) |
| | `round-3-nalati-in-engine` (09-23) | `hero-nalati-grasslands-{portrait,landscape}` — in-engine captures of the finished shard (the valley camp; the kokpar field under the crags), lightly graded, no paint-over (copied into `src/chunks/thumbs/`, + the 640×360 thumbnail) |
| | `round-4-pine-hollow-in-engine` (09-25) | PH-S1: in-engine captures of the finished shard replace round 2's paintings. 7 candidate scenes (`candidate-*`, `contact-sheet.jpg`) and `board.jpg` (A / B / C). Wired: A + A, `hero-pine-hollow-{portrait,landscape}.jpg`, the Antler King in his clearing at night (copied into `src/chunks/thumbs/`, + the 640×360 thumbnail). `hero-pine-hollow-landscape@2x.jpg` feeds `scripts/native-icons.py` (the app icon + splash) |
| | `round-5-stage-band` (10-02) | E396: every shard's portrait title hero re-aimed so the subject sits in the 8–46 % band above the deck (`scripts/hero-shots.mjs`, lens-shifted, 402×813 @3). Per shard `<slug>/board.jpg` (NOW / A / B / C under the real menu) and `<slug>/views.json` (the cameras) |
| `game-normalization/` | `round-1-infographic` (09-30) | E357: infographics of the GAME-NORMALIZATION v2 plan and goal (codex image_gen, gpt-6-sol, portrait): `A-layer-cake`, `B-metro-map`, `C-blueprint`, `D-before-after`, `E-poster`, + `board-A-E.jpg` (C and D re-rolled once: their first islands weren't our shards) |
| | `round-2-technical` (09-30) | E357: the technical infographics — how the engine · game · kit · shard layers separate and why shard 5 is standalone (codex image_gen, gpt-6.1-sol): `T1-layer-rules`, `T2-shard-anatomy`, `T3-shard5-path`, `T4-plugin-socket`, `T5-one-pager`, + `board-T1-T5.jpg` |
| `thin-ice/` | `round-0-references` … `round-10-content-round-2` (10-01) | E359: the WorldClaw pilot's fjord dry run, originals only (codex image_gen, Blender): references, P2 pitches, P3 art direction ("Aurora, kept simple"), P4 18 concepts, P5 map wave 1 → revision 1 → revision 2 (approved, with its blockout), P6 first-person try 1 and wave 2, P5b content rounds 1–2. A README per round; THIN-ICE §4.1 lists them; the review copies are at the tag `worldclaw-archive` |
| `worldclaw-tools/` | `round-1-draft-and-explorers`, `round-2-screens`, `round-3-draft-explore` (10-01) | E359: WORLDCLAW-TOOLS' mockups and boards: Draft mode, Map Lab, the Composition and Coverage Explorers; the game's COMING SOON card, the drafts title, a stage page, the splash, Route & Beats; Draft Explore's five tabs, the Explore bar, Coverage's ladder. Picks J13–J52 |
| `marketing-site/` | `round-1-direction` (10-09) | E465, MARKETING-SITE MS2: three directions for the Project Wildshard home page, built as real phone-first HTML on in-engine captures (`a/`, `b/`, `c/` `index.html`; `BRIEF.md` has the words): A The Lattice, B The Atlas, C The Prompt. `<x>-hero.jpg` (first phone screen), `<x>-full-<n>.jpg` (the whole page), `board.jpg` (A / B / C) · `round-2-merge` (10-09): Jake's pick, C's page in A's colours with B's map, the new sections (motion, one sentence → a shard, devlog, shardfile peek, claim a cell, founding authors, coming worlds, FAQ, install); `index.html` with three accents `a/b/c-hero.jpg` (cyan, violet, hot pink), `a-full-<n>.jpg`, `board.jpg` |
| `worldclaw/` | `round-1-prototypes` (10-01) | E359: the four WorldClaw prototypes' images (layout maps from a schematic, terrain and bands, paint-then-lift, crop → 3D), WORLDCLAW-SHARD §10's evidence |
| `menu/` | `round-1-main-menu` (09-17) | `menu-{A-cinematic,B-list,C-cards}` — main menu directions; C picked |
| | `round-2-tabs` (09-18) | `menu-tab-{map,inventory,achievements,settings}` — the in-game MENU overlay |
| | `round-3-explore-placement` (09-25) | `{A,B,C}.jpg` + `board.jpg` — E137: one ENTER WORLD banner; EXPLORE WORLD on the card / top-right / footer |
| `settings/` | `round-1-desktop-keybinds` (10-01) | E357 J9: desktop pause ▸ Settings / key bindings, codex image_gen edits of the live 1440×900 capture: `A-two-pane-table` (category rail + two-column ACTION/KEY/ALT table, live conflict) · `B-keyboard-diagram` (keyboard + mouse diagram, detail card) · `C-four-columns` (every context as a column, search + presets) + proposed default-key changes. [Notes](settings/round-1-desktop-keybinds/README.md) |
| `hud/` | `round-1-directions` (09-17) | `hud-A…E` — five HUD directions (below) |
| | `round-2-overlays` | `hud-F…J` — overlays on the real phone frame (below) |
| | `round-3-klmn` | `hud-K-bethesda`, `L-mobileshooter`, `M-diegetic`, `N-outsidebox` |
| | `round-4-k-variants` | `hud-K1-stagingglass`, `K2-holosurvey`, `K3-cartographer` — K1 approved |
| | `round-5-n-bars` | `hud-N1-gripbar`, `N2-consolebar`, `N3-holobar` |
| | `round-6-p-bar-layouts` | `hud-P1-baredges`, `P2-barcorners` — P2 approved (with K1) |
| | `round-14-weapon-swap` (09-29) | E303 one weapon-swap mechanism for every shard: `{A,B,C,D}-{nalati-grasslands,pine-hollow,driftwood-isle}.jpg` — A left rail above HOVER · B swap chip + hold wheel · C right rail · D slots in the bar. Live 390×844 captures with the variant drawn in the page from the game's own HUD classes (exact text, no image model). Board: `progress/e303-weapon-swap/board.jpg` |
| | `round-15-nalati-clean` (09-29) | E319 Nalati left-edge column + swap + the cleanest HUD. `place-{A,B,C,D}-{foot,saddle}.jpg` (HORSE over HOVER, SWAP under: A three tabs · B one rail · C compact disc stack · D SWAP carries the ammo) · `wheel-{A,B,C,D}-strip.jpg` (closed · open · picked: A half-wheel · B flyout cards · C flick pie · D swipe cycle) · `clean-{A,B,C,D}-{explore,saddle,fight}.jpg` (A tidy · B only when needed · C no bar · D bare + compass). Live 390×844 captures, the variant drawn in the page (exact text, no image model). Boards: `progress/e319-hud/{placement,wheel,clean}-board.jpg` |
| | `round-16-reload-brace` (10-01) | E357 J13 touch RELOAD (`J13-{A,B,C}.jpg`: A first-row disc above JUMP · B tap the ammo chip · C small disc on FIRE's rim) and J14 spear BRACE + JUMP (`J14-{A,B,C}.jpg`: A first-row BRACE · B BRACE in the AIM / LOCK slot · C hold ATTACK to brace). codex image_gen edits of live 390×844 captures (Pine lever rifle 4 / 7, Nalati spear). [README](hud/round-16-reload-brace/README.md) |
| | `round-17-reload-chip` (10-01) | E357 J13 tap the ammo chip to reload, three takes on 16-B (`J13-chip-{A,B,C}.jpg`: A bracketed chip + reload glyph, inset shows the tap filling the pips · B a "RELOAD" tab hangs under a part-empty chip · C the chip's border is the reload progress, "TAP" hint at rest). codex image_gen edits of the round-16 Pine capture. [README](hud/round-17-reload-chip/README.md) |
| `hud-explorer/` | `round-1-arena` (09-26) | Portrait shared HUD/Weapon Explorer proposal: three humanoid dummy turntables, nine views of the full grid arena, and in-game HUD mockup. [Review notes](hud-explorer/round-1-arena/README.md) |
| | `round-2-live-arena` (09-26) | First playable portrait arena capture, with its visual gap against the approved target recorded. [Review notes](hud-explorer/round-2-live-arena/README.md) |
| | `round-3-dummy-meshes` (09-26) | Three humanoid armor references: [straw + cloth](hud-explorer/round-3-dummy-meshes/ref-straw-cloth.jpg), [wood + wood](hud-explorer/round-3-dummy-meshes/ref-wood-wood.jpg), [wood + steel](hud-explorer/round-3-dummy-meshes/ref-wood-steel.jpg) |
| | `round-5-explore-entry` (09-27) | [One portrait A–E storyboard](hud-explorer/round-5-explore-entry/explore-entry-A-E.jpg) for developer-only Practice Arena placement inside Explore World, with [review notes](hud-explorer/round-5-explore-entry/README.md) |
| | `round-6-option-a-live` (09-28) | [Live portrait Option A](hud-explorer/round-6-option-a-live/explore-three-cards.jpg), [arena minimap](hud-explorer/round-6-option-a-live/practice-minimap.jpg), and [pause](hud-explorer/round-6-option-a-live/practice-pause.jpg) |
| | `round-7-dummy-rebuild` (09-29) | E285 rebuilt dummies (TRELLIS.2 from new closed-fist refs, closed bake, 18-bone geodesic rig): live nine-angle sheets for [wood](hud-explorer/round-7-dummy-rebuild/wood-wood-nine-angles-live.jpg), [straw](hud-explorer/round-7-dummy-rebuild/straw-cloth-nine-angles-live.jpg) and [steel](hud-explorer/round-7-dummy-rebuild/wood-steel-nine-angles-live.jpg), approved-vs-live A/B, Blender rig gates. [Notes](hud-explorer/round-7-dummy-rebuild/README.md) |
| | `round-8-arena-motion` (09-29) | E285 live captures: the lit room and lineup [on all four shards](hud-explorer/round-8-arena-motion/stills-four-shards.jpg), [before / after](hud-explorer/round-8-arena-motion/before-after-driftwood-nalati.jpg), and hit-reaction videos (sword, crossbow, 3/4 view). [Notes](hud-explorer/round-8-arena-motion/README.md) |
| | `round-9-explorer-and-bolts` (09-29) | E289: [Model Explorer's dummies in the studio light](hud-explorer/round-9-explorer-and-bolts/model-explorer-pine-hollow.jpg), whole-figure catalog thumbnails, and stuck [bolts](hud-explorer/round-9-explorer-and-bolts/crossbow-bolt-rides-pine-hollow.jpg) / [arrows](hud-explorer/round-9-explorer-and-bolts/bow-arrow-rides-nalati.jpg) riding a rocking dummy. [Notes](hud-explorer/round-9-explorer-and-bolts/README.md) |
| `model-explorer/` | `round-1-training-dummy-variants` (09-26) | Three variant-layout concepts, the live Pine Hollow picker video, and the first shared dummy family turntable. [Review notes](model-explorer/round-1-training-dummy-variants/README.md) |
| `explore/` | `round-1-playgrounds` (09-29) | E307 the Explore hub's feature playgrounds, live iPhone 16 Pro portrait captures: [board.jpg](explore/round-1-playgrounds/board.jpg) (A / B the hub list on Nine Dragon and Nalati · C–E the grapple course: the start, mid-zip, the tower top · F–H the horse track: at the start, the east bend, half way), and the canvas recordings [grapple-playground.mp4](explore/round-1-playgrounds/grapple-playground.mp4) (START to FINISH, 17.5 s) and [horse-playground.mp4](explore/round-1-playgrounds/horse-playground.mp4) (mounted, half a lap) |
| | `round-2-playground-cards` (09-30) | E325 the two playground cards' real art: [before-after.jpg](explore/round-2-playground-cards/before-after.jpg) — the Explore hub on Nine Dragon and Nalati, the placeholder glyph (A, C) and the live card art (B: the Fei Zhua mid-zip toward BASE, D: the rider down the jump lane's rails). The cards are `src/explore/img/playground-{grapple,horse}.webp`, shot by `scripts/playground-cards.mjs` |
| `ads-aim/` | `round-1` (09-17) | `ads-{A-centred-low,B-eye-level,C-peep-sight}` — iron-sights pose; A picked, C's peep ring added |
| `minimap/` | `round-1` (09-17) | `minimap-k1-{A-radar,B-terrain,C-holo}` on the K1 HUD; B built |
| `touch-buttons/` | `round-1` (09-17) | `buttons-{A-edges,B-inbar,C-lowered}` — A picked |
| `driftwood-isle/` | `round-1-third-person` (09-18) | `driftwood-spawn-{A,B,C}`, `driftwood-poi-1…3`, `driftwood-sword-{wooden,iron}` (wrong camera, superseded) |
| | `round-2-first-person` (09-18) | `driftwood-fp-*` portrait with the phone HUD + `driftwood-map-topdown` |
| | `round-3-enemies` (09-18) | `driftwood-enemy-{1-crab,2-monkey,3-wreckghost}` |
| `skins/` | `round-1` (09-18) | `skin-{crossbow,rifle}-*` — legendary-drop weapon skins |
| `pickups/` | `round-1` (09-18) | `pickup-{A-bubble,B-ring,C-diegetic}` — AR-15 cabin pickup |
| `nalati-grasslands/` | `round-1/{1-art-style,2-combat,3-enemies,4-new-features,5-concept-art}` (09-22) | Nalati round 1 — see `project/archive/2026-09-23-nalati.md` |
| `nalati-grasslands/` | `round-9-rig-hulls` (09-23) | creature hulls re-generated for rigging (A1 step 5): `snow-leopard-rig`, `eagle-flight` (GLB sources of the `*.rigged.glb` bakes, `scripts/nalati-rig-bake.mjs`), `wolf-rig` (ref + turntable only, not used); `*-ref.jpg` the codex references, `*-turntable.jpg` the TRELLIS.2 results |
| `nalati-grasslands/` | `round-10-models-merge` (09-24) | NALATI-MERGE D1 / D2, every model made both ways (Blender pipeline + image-to-3D): `ref-*.jpg` the codex references (A-pose figures, side-on creatures; `refs-sheet.jpg` all eight), `collie` / `ghost-horse` (`.phone`) the Hunyuan3D-2 hulls behind their `*.rigged.glb` bakes; the in-engine sheets are `progress/nalati-merge/d/` |
| `nalati-grasslands/` | `round-12-faces` (09-29) | NALATI-FINISH B5 / E302, the faces remaster: `portrait-*.jpg` the codex front head-and-shoulders portraits (five camp people + the Golden King) that Hunyuan3D-2 / TRELLIS.2 rebuilt the heads from and that are projected onto the new heads' fronts (scripts/img2mesh/face_remaster.py); the in-game board is `progress/e302-faces/` |
| `pine-hollow/` | `round-20-e322-king-fog` (09-30) | E322 F-L7 / N25 evidence (not a pick): `king-fog-before-after.jpg` — the Antler King's sealed fight under Debug ▸ Weather = Fog, before (the weather's ×29 fog on top of the fight's ×26: a pale ghost) / after (the weather stands down in the sealed clearing); `n25-aim-dodge-phone.jpg` — phone touch HUD with the crossbow, AIM and DODGE discs side by side, no overlap |
| `pine-hollow/` | `round-21-e322-npc-rig` (09-30) | E322 F-M3, Debug ▸ Creatures & NPCs ▸ NPC rig, real build (iPhone portrait): `board.jpg` — A today's upper-body rig / B legs + clavicle / twist + the walk: Hale's point on his right shoulder (A tears the shoulder top; B keeps the cap, the forearm-to-coat web the generator fused still stretches), Hale, Brandt and Mott walking from the side (A slides, B steps). scripts/e322-npc-rig-capture.mjs + e322-npc-rig-board.py |
| `pine-hollow/` | `round-22-e322-beaver-pool` (09-30) | E322 F-L6 evidence (a bug fix, not a pick): the new beaver pool behind the dam, real build, iPhone portrait — `board-dam.jpg` A full / B drained after `open:dam-sluice` (from the dam's west end, looking up the pool to the riffle and the pond), `dam-{full,drained}.jpg`, `upstream-{full,drained}.jpg` (from the upstream bank toward the dam and its sluice) |
| `pine-hollow/` | `round-23-e322-weather-trample` (09-30) | E322 picks, real build, iPhone portrait (phone tier), A = today / B = the Debug row on: `f-l5-rain-extras.jpg` (Sky & weather ▸ Rain extras: splashes at the feet, meadow puddles, drops on the lens; Weather = Rain, the Hollow crossroads) · `f-l4-grass-trample.jpg` (Ground cover & foliage ▸ Grass trample: the Kings clearing after a 23 m walk, looking back down the track). GPU on − off below the A/B noise for both |
| `pine-hollow/` | `round-26-e322-mill-door` (09-30) | E322 F-M7 evidence (a bug fix, not a pick): the watermill's door, real build 1e643a6, iPhone portrait — `mill-door-board.jpg` A before the miller's errand (USE only rattles: the toast, the door stays shut and holds a 4.7 s walk 0.33 m outside it) / B after `errand:done` (it swings open onto the mill floor and the wing's doorway; walking in reaches the back wall) |
| `pine-hollow/` | `round-27-e322-cabin-doors` (09-30) | Evidence, not a pick (real build 2e7d582, iPhone portrait, phone tier): `cabin-doors-strip.jpg` — E322 check of 156bb966 on Hale's cabin door: shut it holds a 4 s walk 0.33 m out, E opens it and you walk in, closing it while standing in the doorway moves you 0.001 m and the leaf stays off until you step clear, then holds from outside (0.33 m) and inside (0.59 m); the mill door is still barred until `errand:done`. `e341-hide-before-after.jpg` — E341: the "black blob" by the camp fire was the drying hide on its rope line (colour 0x120b06, near black), now brown; a float-RT NaN scan found no NaN |
| `pine-hollow/` | `round-28-e322-crowns` (09-30) | E322 F-L3, Debug ▸ Look ▸ Crowns from above, real build, iPhone portrait: `board.jpg` — A today / B the fix from the fire lookout's deck, a 90 m god view and the old-growth floor (unchanged from below), with a zoom row, crown luma, GPU ms and bytes; see its [README](pine-hollow/round-28-e322-crowns/README.md) |
| `pine-hollow/` | `round-29-e322-hands` (09-30) | E322 F-M6 (Jake picked B: the hands are always on), real build, iPhone 16 Pro portrait (phone tier): `crossbow-ab.jpg` — A the hands before the polish (9eda772) / B polished (the coat sleeve with its cuff and waxed-canvas texture, the buckskin glove, the left hand re-posed round the back of the fore-end) at rest, aiming and reloading; `lever-action-ab.jpg` — the same A / B on the lever-action (only the glove's colour changes) with the lever thrown; `measure.json` — draws, triangles, GPU ms and bytes the hands add, before and after (scripts/e322-hands-capture.mjs) |
| `pine-hollow/` | `round-30-e350-arena-rain` (09-30) | E350 F-X4 evidence (a bug fix, not a pick), real build b-muo5pwey, iPhone 16 Pro portrait (phone tier), Debug ▸ Sky & weather ▸ Weather = Rain: `a-arena-no-rain.jpg` — the practice arena with no rain curtain, splashes or lens drops (the rain beds and the wet sheen off too); `b-after-exit-rain-back.jpg` — out of the arena, back in Pine Hollow: the rain is back |
| `pine-hollow/` | `round-31-e350-perf-lap` (09-30) | E350 F-J1 evidence (a tool, not a pick): the fps panel's PERF LAP run headless on the HEAD build f2ee9fa (iPhone 16 Pro portrait, phone tier) — `lap-running.jpg` mid-lap at the King's clearing (the progress line, top centre), `panel-result.jpg` the panel with the finished summary in the LAP row under REC 30 S, `summary.txt` its text (scripts/pine-hollow-perf-lap.mjs) |
| `pine-hollow/` | `round-32-e350-king-fight` (09-30) | E350 F-X2 evidence (a retune, not a pick), real build 106055f8, iPhone 16 Pro portrait, phone tier: `strip.jpg` — the Antler King's fight on his own body, his hit volumes (cyan) and where each blow hurts (amber): I the diving antler sweep, I the rearing strike's slam, II the hit volumes, III a lane charge; `fight-{after,before}.json` the scripted fight's hit / miss vs his mesh, phases I–III (scripts/e350-king-fight.mjs); `measure-*.json`, `gate-*.json`; see its [README](pine-hollow/round-32-e350-king-fight/README.md) |
| `pine-hollow/` | `round-33-e350-hale-arm` (09-30) | E350 F-X3 evidence (a bug fix, not a pick), real build, iPhone 16 Pro portrait, phone tier: `board.jpg` — Ranger Hale A before (HEAD 9118e71: his point drags a grey sheet from sleeve and lantern to the coat) / B after (the forearm-to-coat webs split at load, npcRig.ts splitWebs): standing front and side unchanged, the point clean; see its [README](pine-hollow/round-33-e350-hale-arm/README.md) |
| `pine-hollow/` | `round-18-faces` (09-30) | E304, the faces remaster: `portrait-ranger/trader/miller.jpg`, codex front portraits of Hale, Mott and Brandt (from their round-11 references) that Hunyuan3D-2 rebuilt the heads from, projected onto the new faces (scripts/img2mesh/e304_faces.sh); the in-game board is `progress/e304-faces/pine-hollow-board.jpg` |
| | `round-19-e322-bears-birds` (09-30) | E322 F-M2 bears + F-M5 birds, Debug ▸ Creatures & NPCs A/B boards from the real build (iPhone portrait): `bears-board.jpg` (Bear fix: the stub-tail flap pressed away, coats measured onto grizzly tones), `birds-*.jpg` (Bird fix); [README](pine-hollow/round-19-e322-bears-birds/README.md) |
| `driftwood-isle/` | `round-14-faces` (09-30) | E304, the faces remaster: `portrait-captain.jpg`, a codex front portrait of the Drowned Captain in the island's faceted toon look that Hunyuan3D-2 rebuilt his head from (scripts/img2mesh/e304_faces.sh); Wendell's and the sailor's faces are code; the in-game board is `progress/e304-faces/driftwood-isle-board.jpg` |
| `nine-dragon-stack/` | `round-27-faces` (09-30) | E343, the D heads: `portrait-ndcook.jpg`, `portrait-ndelder.jpg`, codex front portraits in the flat-wash look that Hunyuan3D-2 rebuilt as heads (scripts/img2mesh/head_cut.py → driftwood_post.py) for the square's brushed figures; the board is `progress/e343-faces/nine-dragon-board.jpg` |
| `loot/` | `round-2-props` (09-30) | E314 DRIFTWOOD-LOOT props, code models (not a pick): `board.jpg` — the sea glass wind chime at 0 / 5 / 10 / 15, the trophy plaques empty / bear / boar / both, the captain's hat and the sailcloth cape at four turns, the Bag icons; live Model Explorer captures, iPhone 16 Pro portrait — see its README |
| `bushes/` | `round-1-directions` (09-24) | E116 hibiscus bush: `board.jpg` (NOW / A leaf clump / B sculpted canopy / C leaf cards, live phone captures: Explore turntable + in world), `mockups.jpg` (the local-Qwen direction mockups); `?bush=a\|b\|c`, see its README |
| `rocks/` | `round-1-directions` (09-24) | E114 rock looks: `board.jpg` (NOW / A chiselled / B smooth painted / C layered slabs / D ink outline, mockup only), `mockup-{A..D}` (masked Qwen edits of `ref-live-reef`), `game-{reef,wreck,boulder}-{current,a,b,c}` (`?rocks=`), `boulder-crack-fix-before-after` — see its README |
| `rocks/` | `round-2-b-final` (09-25) | E114 B (smooth painted) built and made the default: `board.jpg` (before `?rocks=now` / after, iPhone 3× captures: wreck reef, shore, spawn beach, tidepools, Explore Boulder), `{before,after}-*.jpg`, `mockup-vs-after-reef.jpg` — see its README |
| `rocks/` | `round-3-blender-island` (09-25) | E114 the Blender spawn island's boulders + small rocks in B (crags stay): `board.jpg` (before / after / `?rocks=now`, 3 iPhone cameras), `{before,after,rocks-now}-{spawn,cluster,slope}.jpg` — see its README |
| `driftwood-isle/` | `round-13-waterfall` (09-25) | E150 toon waterfall (audit T5): `board.jpg` (before `?waterfall=v1` / after, the audit camera + a close one, iPhone 3×), `{before,after}-{audit,close}.jpg`, `waterfall-before-after.mp4` (3 s, fixed camera) — see its README |
| `driftwood-audit/` | `round-3-style-picks` (09-29) | E310 the phone audit's open style items as decision boards: `t1-lookout-banner.jpg` (A live / B–D codex mockups), `t2-rock-palette.jpg` and `t3-driftwood-logs.jpg` (real in-game variants), iPhone 16 Pro portrait. [README](driftwood-audit/round-3-style-picks/README.md) |
| `driftwood-audit/` | `round-4-slop-sweep` (09-29) | E318 the slop sweep: `board.jpg`, the top 12 cut candidates as numbered cards (live 412d443, iPhone 16 Pro portrait); the numbers are rows of `docs/plans/DRIFTWOOD-SLOP.md`. [README](driftwood-audit/round-4-slop-sweep/README.md) |
| `nine-dragon-stack/` | `round-1-concept` (09-25) | E169 shard 4 concept art (codex): the 500 m cube key art, the nine-strata section, the spawn, the Yamen Well, the Crown, the Shelter Market, Old Street, the Neon Jian + Fei Zhua sheet, the cast; `contact-sheet.jpg` — see its README |
| | `round-2-mockups` (09-25) | E169 spawn compositions A–D on the phone HUD (realism baseline; the HUD reference turned out stale — redone in round 6) |
| | `round-3-art-styles` (09-25) | E169 the spawn in six styles (ink, gongbi, Chungking Express, shadow theatre, woodblock, neon-noir) — `board.jpg` |
| | `round-4-jiehua-neon` (09-25) | E169 界画霓虹 Jiehua Neon (the research pick): spawn, gold-on-indigo, down the Well, dusk — `board.jpg`; `A-jiehua-spawn.jpg` is the look target |
| | `round-5-cleanroom` (09-25) | E169 the from-scratch clean room (`dev/nine-dragon.html`) with the baseline HUD: `mockup-vs-cleanroom.jpg`, `v1-vs-v2.jpg`, `hud-*.jpg` |
| | `round-6-baseline-hud` (09-25) | E169 rounds 2–4 redone on a fresh live capture of the baseline HUD: `board-styles.jpg` (A–F, Jake picked A), `board-compositions.jpg` (Jake picked A); `ref-live-*.jpg` |
| | `round-7-lab-{ink,neon,facade,hero}` (09-25) | E169 look labs (throwaway prototypes, `dev/nd-lab-*.html`): loop sheets, `final.jpg`, README = LEARNINGS + integration |
| | `round-18-portrait-teaser` (09-26) | Preliminary 15 s portrait fall cut and contact sheet, retained as capture history |
| | `round-19-portrait-grapple` (09-26) | [15 s portrait recut](nine-dragon-stack/round-19-portrait-grapple/README.md) with the playable Fei Zhua crossing, awaiting Jake's review |
| | `round-20-facade-budget` (09-26) | [Eight center-view engine captures and facade A/B](nine-dragon-stack/round-20-facade-budget/README.md), with the 76-pose draw-call result and unresolved F7 look gaps |
| | `round-21-b2-bridge-camera` (09-26) | [B2 camera correction](nine-dragon-stack/round-21-b2-bridge-camera/README.md): the old eye clipped a cinnabar railing; the bridge-center eye reveals the canyon |
| | `round-21-grapple-parity` (09-26) | [Portrait hook sculpt and live grapple motion check](nine-dragon-stack/round-21-grapple-parity/README.md): LOCK/fire/zip and safe miss/reel/dock; awaiting physical iPhone review |
| | `round-22-portrait-grapple-final` (09-26) | [Current 15 s portrait trailer review cut](nine-dragon-stack/round-22-portrait-grapple-final/README.md) with recaptured Fei Zhua crossing and three-talon flying claw |
| | `round-25-phone-perf` (09-29) | E283 the phone's GPU frame, before / after stills of the Debug ▸ Performance rows at the four mockup cameras with 100 % crops: `vm-lite.jpg` (the lighter viewmodel: Jake's pick, now permanent), `lod-meshes.jpg` (distance LODs: coarser meshes — hooks, lions, crowd, far lanterns), `lod-detail.jpg` (distance LODs: thin detail — the facade's bars, brackets and cords, the balustrade's scrolls) |
| | `round-26-grapple-ux` (09-29) | E286 the Fei Zhua on the baseline touch HUD: `board.jpg` (before: LOCK dim, no hook in reach at the spawn or the rim; after: LOCK lit at rest → GRAPPLE with ◇ markers → LOCKED + ZIP → the landing, at the spawn, the rim across the Well and the rim → square mast hook) |
| `grid/` | `round-1-overview` … `round-12-vr-void` (10-04) | E438, SHARD-PLATFORM's grid mockups (Jake's picks G72–G98 in the plan's §10): world from above, highway, seams, crossroads grade, far view, outer edge, safe zone, soft wall, hoverboard speed, asphalt road + crossroads, seam heights (66 World Explorer edge captures + blend board), VR void. Each round has a `board.jpg` and a README; [review page](https://claude.ai/artifact/ULYWRuxwbqYWKVUXZFKAwH) |
| `menu/` | `round-4-two-entries` … `round-7-new-main-menu` (10-04) | E438: the two title entries (rejected), entering the grid, the needs-upgrade card, the new main menu (G88: B crossroads + cards) |
| `hud/` | `round-18-border-crossing`, `round-19-ui-kit` (10-04) | E438: crossing into a shard (G82: A title card), the platform UI kit (G87: big cards + a shard accent) |
| `minimap/` | `round-2-grid-map` (10-04) | E438: a 3 × 3 grid map (rejected, G84: the map stays per shard) |
| `settings/` | `round-2-new-game` (10-04) | E438 / E439: New game per shard (G83: C save cards + before/after sheet) |
| `driftwood-isle/`, `far-reach/`, `sunscar-dunes/`, `nine-dragon-stack/`, `nalati-grasslands/` | `round-15-grid-entries`, `round-38-grid-edges`, `round-30-grid-look`, `round-29-grid-look`, `round-13-grid-look` (10-04) | E438: each shard meeting the grid (G93 midpoint entries, G99 Sky Reach rules, G94 Dunes haze, G95 Nine Dragon dusk fog, G96 Nalati painterly kept) |
| `grid/`, `far-reach/`, `hud/`, `menu/`, `minimap/` | `grid/round-13-turn-in` … `round-15-cell-aerial`, `far-reach/round-39-entryways`, `hud/round-20-accent-palette`, `hud/round-21-crossing-storyboard`, `menu/round-8-shard-select`, `minimap/round-3-road-blend` (10-04) | E438 waves 8–9: midpoint turn-in (G100 T-junction), railing + wall (G101 cyan rail), Sky Reach switchback entries (G102), one cell from the air + 15 m of road asphalt into each entry (G103), the 20 HUD accents + reserved road cyan (G104), crossing storyboard (G105), shard select (G106 carousel), minimap at the road (G107) |
| `menu/` | `round-11-whats-new` (10-07) | SF60 / G201: where the daily "WHAT'S NEW · WHAT TO TRY" playtest card sits on the main menu (A card over the title art, recommended · B strip above the doors · C chip + sheet) |

The rest of this file is the prompt log for `pine-hollow/round-1-target-look` and the first two HUD rounds.

## Pine Hollow target look

Concept / target-look mockups for the Wildshard singleplayer chunk playtest: what the demo should look like when it hits the PS5-quality bar in README.md. They are *not* engine output; they are generated images meant to read as screenshots of the finished game running in Chrome.

## How they were generated

Generated with the `codex` CLI (codex-cli 0.154.0, model `gpt-6-astra`) using its built-in `image_gen` tool (feature flag `image_generation`, stable/enabled; the system `imagegen` skill at `~/.codex/skills/.system/imagegen`). Each image was one headless run of:

```bash
codex exec -s workspace-write --skip-git-repo-check -C <repo> \
  -i <reference-1.png> -i <reference-2.png> \
  --output-last-message <log> "<IMAGE PROMPT>

TASK FOR CODEX: Generate exactly ONE image with the built-in image_gen tool using the image prompt above ... 16:9 landscape ... copy the newest PNG from ~/.codex/generated_images to art/pine-hollow/round-1-target-look/mockup-NN-<slug>.png ... one generation only."
```

Reference images were attached with `-i` (the current in-engine progress screenshots and a frame of `sources/progress.mp4` for the HUD / typography style). Output is 1672x941 (16:9). Prompts below are the exact IMAGE PROMPT text passed to codex; the shared STYLE and HUD blocks are repeated in each prompt, so they are shown once and then referenced.

### Shared STYLE block

> STYLE (applies to the whole image): An actual in-game screenshot from a AAA PS5 first-person game, captured from a Chrome browser playtest build (the browser chrome itself is NOT visible, only the 16:9 game viewport). Photoreal Unreal Engine 5 / Nanite / Lumen-class fidelity, on par with Skyrim Special Edition, Conan Exiles and Crimson Desert on PS5. Boreal Scots pine and Norway spruce forest with photoscanned needle foliage, flaking orange-brown bark, mossy roots, ferns and needle litter on the forest floor, worn dirt trail with pebbles and exposed roots. Late-afternoon golden-hour sun, warm low-angle light, volumetric god rays through the canopy, long soft shadows, physically based materials, subtle film grain, slight vignette, filmic colour grading with olive greens and amber highlights, faint lens flare. High in the sky, partially veiled by thin haze, an enormous ringed gas giant (like Saturn, cream and tan bands, thin bright ring seen at a tilt) hangs above the treeline. 16:9 landscape, first-person perspective, eye height about 1.7 m. No watermark, no signature, no caption, no text anywhere except the HUD text explicitly listed. Not a painting, not concept art, not illustration: a crisp real-time render screenshot.

### Shared HUD block (mockups 01-05)

> HUD (minimal, diegetic-feeling, small, sharp UI drawn over the game): all panels are dark semi-transparent glass with a 1 px cyan (#8fe3ff) accent line, condensed uppercase Rajdhani-style display type in white/cyan, tiny letter-spaced grey labels. Top-left: a small glass tag panel reading exactly "PROJECT WILDSHARD" on line one and "CHUNK PLAYTEST · pine-hollow" on line two, with a tiny amber dot and the small label "LOCAL BUILD · UNUPLOADED" below it. Top-centre: a slim horizontal compass strip with tick marks and small cardinal letters "N  NE  E", the current heading marked with a cyan notch. Bottom-left: a small "VITALS" bar reading "100 / 100" with a thin cyan fill bar. Bottom-right: a small glass panel labelled "BOLTS" with the large number "29" and the small suffix "/ 30", above a thin cyan segmented ammo bar. Keep the HUD small and unobtrusive (each panel at most about 12 percent of the frame width). Render all HUD text crisply and verbatim.

## Files

### `art/pine-hollow/round-1-target-look/mockup-01-golden-trail.png` (1672x941)

Trail through dense pines at golden hour, god rays, crossbow viewmodel, minimal HUD.

References attached: `progress/012-weapon-hud-play.png`, `sources/progress.mp4 frame @25s (intro HUD)`

Prompt = SCENE below + shared STYLE block + shared HUD block.

> SCENE: Walking along a worn dirt trail winding through a dense old-growth Scots pine and Norway spruce forest at golden hour. Massive trunks either side, the trail curves left and dips into a hollow where low sun pours between the trunks as thick volumetric god rays, backlighting drifting pollen and dust motes. Ferns, bilberry shrubs and fallen needles line the trail; a mossy fallen log lies off to the right. The ringed gas giant is visible through a gap in the canopy above the trail. In the lower-right of the frame the player's first-person crossbow viewmodel: a hand-built wooden crossbow with a dark steel prod, twisted hemp string, a loaded bolt with grey fletching, held in weathered leather-gloved hands, lit by the same warm sun, rendered with crisp PBR detail and slight depth-of-field softening at the nearest edge. Small dot crosshair dead centre.

### `art/pine-hollow/round-1-target-look/mockup-02-cabin-clearing.png` (1672x940)

Log cabin clearing: stone chimney and smoke, woodpile, fire pit, porch lantern, deer at the tree line.

References attached: `progress/012-weapon-hud-play.png`, `sources/progress.mp4 frame @25s (intro HUD)`

Prompt = SCENE below + shared STYLE block + shared HUD block.

> SCENE: The player steps out of the treeline into a sunlit forest clearing with a hand-built log cabin at its centre, 25 m away, slightly to the left of frame. The cabin: dovetailed round pine logs weathered silver-grey, a steep shingled roof green with moss, a fieldstone chimney with a thin ribbon of pale wood smoke drifting into the golden light, a small porch with a glowing brass oil lantern hanging from the post, a rough-hewn door, a single glass window catching the sun. Beside the cabin a neatly stacked woodpile under a lean-to and a chopping block with an axe. In the foreground right, a ring of blackened stones around a fire pit with faint embers and a cast-iron pot on a tripod. At the far tree line, two red deer (a doe and a young stag) graze in tall grass, half in shadow. Golden-hour god rays rake across the clearing; the ringed planet hangs above the pines behind the cabin. Lower-right: the player's first-person crossbow viewmodel held low at rest, wooden stock, steel prod, leather-gloved hands. Small dot crosshair centre.

### `art/pine-hollow/round-1-target-look/mockup-03-boar-ads.png` (1672x941)

Aiming down the crossbow at a wild boar 15 m away in ferns, shallow DoF, hit-marker crosshair.

References attached: `progress/013-weapon-ads.png`, `sources/progress.mp4 frame @25s (intro HUD)`

Prompt = SCENE below + shared STYLE block + shared HUD block.

> SCENE: Aiming down the sights of a hand-built wooden crossbow at a wild boar 15 m away standing broadside in a bed of sunlit ferns between pine trunks. The crossbow dominates the lower half of the frame in first-person, centred: dark steel prod, twisted hemp string drawn back, a loaded bolt with grey fletching running down the centreline toward the target, iron rear peep sight and a small front bead, leather-gloved hands gripping the stock; the rear of the weapon is softly out of focus while the front bead and the boar are sharp (shallow depth of field, ADS). The boar: coarse dark-brown bristled hide with a lighter dorsal ridge, small tusks, snout down rooting in the ferns, backlit by golden-hour rim light, dust and pollen drifting in the god rays. Hit-marker style crosshair: four short thin white ticks around a centre gap with a cyan (#8fe3ff) tint, just over the boar's shoulder. A tiny label under the crosshair reads exactly "BOAR · 15 M". The frame edges have a subtle ADS vignette. Only the ringed planet's edge shows through the canopy, top-left.

### `art/pine-hollow/round-1-target-look/mockup-04-chunk-edge-gate.png` (1672x941)

Chunk edge: dirt road ending at a translucent cyan gate with beacon posts, glowing rim line, void/clouds and the ringed planet.

References attached: `progress/003-south-gate-beacons.png`, `progress/012-weapon-hud-play.png`

Prompt = SCENE below + shared STYLE block + shared HUD block.

> SCENE: The edge of the world. A dirt road runs straight ahead across sparse pine forest and ends abruptly at the rim of a floating 500 m square chunk of terrain. At the road's end stands a large translucent cyan gate: a thin rectangular frame of glowing #8fe3ff light about 6 m wide and 4 m tall with a faintly rippling glass-like pane, flanked by two slim dark metal beacon posts topped with bright cyan lights that cast soft cyan glow on the dirt. From the gate, a thin glowing cyan edge line runs left and right along the very rim of the chunk, tracing the cliff edge into the distance. Beyond the rim: nothing but a vast sky of layered cumulus clouds far below, the terrain cut off cleanly showing a cross-section of soil and roots and rock. The enormous ringed gas giant fills the upper-right sky, huge and detailed, with its ring casting a shadow band across its surface. Golden-hour sun from the left, long shadows of the beacon posts, a few tall pines either side of the road. Lower-right: the player's first-person crossbow viewmodel held at rest. Small dot crosshair centre. Also add a small centred glass label near the top under the compass reading exactly "CHUNK EDGE · SOUTH GATE".

### `art/pine-hollow/round-1-target-look/mockup-05-pond-stag.png` (1672x941)

Still forest pond reflecting the pines and the ringed planet, mist, a stag drinking.

References attached: `progress/005-planet-over-the-trail.png`, `progress/012-weapon-hud-play.png`

Prompt = SCENE below + shared STYLE block + shared HUD block.

> SCENE: A perfectly still forest pond in a hollow among tall Scots pines, seen from the trail at its shore. The mirror-like water reflects the dark pine trunks, the golden sky and the enormous ringed gas giant almost perfectly, with a few lily pads and reeds at the edge breaking the reflection. Low mist hangs over the water's surface, glowing where the last golden-hour sun rays cut through the trees. On the far bank, 20 m away, a red deer stag with full antlers stands at the water's edge, head lowered, drinking, its reflection doubled in the water, rim-lit by the sun. Mossy boulders, ferns and a half-submerged fallen log in the foreground; small insects catching the light. The ringed planet is large in the sky above the far treeline and again in the reflection. Lower-right: the player's first-person crossbow viewmodel held low at rest, out of focus. Small dot crosshair centre.

### `art/pine-hollow/round-1-target-look/mockup-06-title-screen.png` (1672x941)

Intro / title screen: PROJECT WILDSHARD wordmark, subtitle, CHUNK PLAYTEST glass panel with build metadata, ENTER THE CHUNK button, blurred forest.

References attached: `sources/progress.mp4 frame @25s (intro HUD)`, `progress/012-weapon-hud-play.png`

Prompt = SCENE below + shared STYLE block (STYLE block with the HUD-text exception reworded to "UI text" and the first-person line reworded to "the blurred background is a first-person forest view"; no HUD block).

> SCENE: The intro / title screen of the game, shown over a heavily blurred, dreamy golden-hour pine-forest background (bokeh, god rays, the ringed planet as a soft glow top-right) with a subtle dark gradient. Layout, exact text, rendered crisply and verbatim: top-left, large bold condensed uppercase wordmark "PROJECT WILDSHARD" ("PROJECT" in white, "WILDSHARD" in pale cyan #8fe3ff), under it a smaller grey subtitle line "A world that does not exist yet, arriving one chunk at a time." and a tiny cyan-dot label "PHASE 1 — GAMEPLAY CONTRACT". Centre-left: a dark semi-transparent glass panel with a 1 px cyan accent edge, titled "CHUNK PLAYTEST · pine-hollow" with small monospaced metadata rows: "CHUNK    chunk://local/pine-hollow", "GRID     (+3, -2)", "SIZE     500 m x 500 m", "BUILD    local · unuploaded", "SEED     0x7A3F19C2". Bottom-centre: a wide glass button bar with a small lock/enter icon and the text "ENTER THE CHUNK" in white letter-spaced uppercase, with a small grey line "Press any key" under it and a cyan outlined chip on the right reading "READY". Bottom-left tiny grey footer "AN IN-PROGRESS PRIVATE PROJECT"; top-right a tiny glass chip "SOUND ON" with a small bars icon. Typography: Rajdhani-style condensed uppercase display type, generous letter-spacing, crisp anti-aliased UI. This is a UI screenshot of a real game menu, clean and legible.

## HUD reimagined (`art/hud/round-1-directions/hud-*.png`, 2026-09-17)

Five HUD directions generated the same way (five parallel `codex exec` runs, references: the user's
current phone screenshot of the HUD + mockup-01/03), prompts in the session log. Subject is the HUD,
the world is backdrop. A/B/C are portrait phone (1024×1536), D/E landscape (1536×1024).

| file | direction | the idea |
|---|---|---|
| `hud-A-diegetic.png` | Diegetic hunter | no boxes: hairline compass, health as a corner arc, ammo as bolt silhouettes, glyph buttons down the right edge |
| `hud-B-console.png` | Staging console | the cyan-glass identity pushed: radial compass, hex ammo ring, FIRE + satellites, corner brackets |
| `hud-C-clean.png` | Console clean | Skyrim/Conan: bottom compass strip with cabin/animal icons, thin bars, floating stick, icon-only rail |
| `hud-D-minimal.png` | Cinematic minimal | heading number only, health as a hurt vignette, ammo dial on the crossbow stock, controls invisible until touched |
| `hud-E-dashboard.png` | Survival dashboard | one slim bottom strip: vitals · stamina · compass · range · bolts; faint control rings above it |

Gotcha: parallel runs must not all "copy the newest PNG from ~/.codex/generated_images" — they race
and copy each other's file. Map outputs by the generation folder id in each run's log instead.

### HUD overlays on the real frame (`art/hud/round-2-overlays/hud-F…J.png`, 2026-09-17)

Second round after the user's correction: the world, crossbow, crosshair and the bottom MOVE / LOOK
control bar are FIXED; only the four action buttons and the vitals / compass / bolts readouts change.
Base = an in-engine phone-tier screenshot at the trail pose with the HUD hidden (`?tier=phone&perf=0&touch=1
&x=0&z=-200&yaw=3.1416`, viewport 390×844 @3×), given to codex as the edit target with the invariants
repeated. F icon rail · G refined row · H split cluster (thumb-reachable) · I rings · J staging console.
Parallel-run rule: each run copies the path its own image_gen result reported, never "the newest file".

### Touch HUD thumb-reach audit (`art/hud/round-8-thumb-audit/`, 2026-09-22, E37)

Live captures, not codex images: the deployed sword HUD with each control's live rect drawn in. Orange = left (move) thumb,
green = right (look) thumb. The rings are about 130 CSS px of thumb travel around each thumb's resting spot, and a red box
is outside that ring. `A-portrait-thumb-reach.jpg` is 390×844. `B-landscape-broken.jpg` is 844×390, where the minimap
hides JUMP / DODGE / HOVER (this led to the E38 rotate-to-portrait gate). Analysis: docs/plans/HUD-REFINEMENTS.md → "E37 thumb-flow audit".

### Touch HUD layout board (`art/hud/round-9-layout-board/`, 2026-09-22, E37)

codex edits of the live 390×844 sword frame (`before-live.jpg`), one run each. `board.jpg` puts BEFORE next to A, B and C.
**A** keeps the bar: ATTACK takes the LOOK pad's place ("HOLD = HEAVY"), DODGE and JUMP sit beside it, and SWAP / HOVER
are chips on the centre seam. VITALS moves under PAUSE. **B** drops the bar: a floating stick with a sprint lock, and a
CoD Mobile arc of ATTACK / DODGE / JUMP. SWAP / HOVER sit at the bottom centre. **C** is B's layout with the crossbow:
FIRE and AIM on the right, a small left FIRE copy above the stick, and a BOLTS readout beside VITALS. None was re-rolled.
Plan rows: docs/plans/HUD-REFINEMENTS.md R12–R18.

### Separate LOOK / ATTACK zones (`art/hud/round-10-look-zone/`, 2026-09-23, E37 → E42)

After the A/B/C board, Jake: "look and attack [must] be different touch zones — doubling them up was causing a lot of
problems". The whole right half still looks, and a LOOK rest pad sits in the bar's bottom-right. **D** puts ATTACK above
the pad, **E** puts ATTACK inboard in the bar beside the pad, and **F** makes LOOK a joystick ring. `board.jpg` = BEFORE + D/E/F.
**Jake picked E** (E42). D and F were copied out of `~/.codex/generated_images/<session>/` after codex hung on reconnects.

### Compact quest tracker (`art/quest/round-1-compact/`, 2026-09-23, E49)

codex edits of Jake's iPhone screenshot (`before-iphone.jpg`). Every variant shrinks the minimap to 80 %, drops the heading readout
and replaces the 4-row quest block. **G:** one chip, "GLYPH SHARDS 0/3 | SEA CAVE 230 M ▸". **H:** the quest on the minimap
ring (objective diamond + "230 M" at its bearing, a "SHARDS 0/3" tab under the ring, a dim "SEA CAVE" line). **I:** a CoD-style
waypoint in the world ("SEA CAVE 230 M") plus a "SHARDS 0/3" pill. `board.jpg` = BEFORE + G/H/I. None re-rolled; G garbled
the untouched ATTACK sub-label.

### Lock-on HUD (`art/combat/round-1-lockon/`, 2026-09-23, E50)

codex edits of one live 390×844 capture of the crab tidepool north of the wreck (`before-live.jpg`; `ref-clean.jpg` is the
same frame with the lunge brackets and HP tag hidden, the edit source), with E46's 45 / 55 bar split injected from the
working tree. HUD-only edits: the world is kept as captured. Plan: `docs/plans/LOCK-ON.md` (draft).
**Board 1 (`board-1-button.jpg`, LOCK button, "available" state):** **J** a LOCK disc on the right-thumb arc left of DODGE,
**K** a LOCK chip on top of the LOOK pad, **L** no button (a "TAP TO LOCK" ring on the enemy), **M** a LOCK | HOVER split pill.
**Board 2 (`board-2-locked.jpg`, the locked view):** **N** Zelda ▼ + corner brackets + "REEF CRAB" tag, edge chevron "4 M",
SWITCH pad, ORBIT stick; **O** ring reticle, fixed top banner, hollow diamonds on the other crabs, FLICK pad; **P** a ground
ring, "REEF CRAB · 3 M" under the crosshair, bare chevron, vignette; **Q** a dot reticle that turns amber on a wind-up, a
bottom banner. **Board 3 (`board-3-storyboards.jpg`, N's language, captured at 3 poses):** **R1→R2** flick left on the pad,
the lock jumps to the next crab; **S1→S2** hold MOVE left, circle the crab. Re-rolled: J and K (the first J put LOCK
inside the bar and shoved DODGE along; the first K garbled the quest title into "WRETCHED ISLE"), L (dropped the quest title), O (LOCK
inside the bar), R1 / R2 / S1 / S2 (LOCK and DODGE drifted into the bar; the storyboards now carry no LOCK disc).

### Hut model turntable midway mockup (`art/build-world/round-6-midway/`, 2026-09-23, E55)

`07-model-turntable.png` is one edit of the live iPhone Explore World model viewer capture. It preserves the hut, camera,
controls, active states and UI labels while adding a dark studio backdrop, polished turntable and refined glass panels.
`art/build-world/round-3-viewer-portrait/p03-model-turntable.jpg` was a finish reference only. One generation; no re-roll.

### Painted 360° horizon (`art/driftwood-isle/round-9-horizon/`, 2026-09-23, E52 X4)

Six in-game captures looking out to sea (headings 0, 60 … 300°, horizon on the middle row) were each edited by codex
into far sea stacks, far islands and a horizon cloud bank (`segment-day-*`), then re-lit as a moonlit night with the same
silhouettes (`segment-night-*`). They were stitched into a seamless 4096 × 512 cylindrical strip and keyed off the sky;
it ships as `public/assets/horizon/driftwood-isle-{day,night}.webp`. `sheet-before-after.jpg` shows the 9 spawn-cove
cameras before and after. The first day round (stacks ~3° high, too small at phone width) was dropped. Nothing else was
re-rolled.

### Hero-prop references + comparison board (`art/driftwood-isle/round-8-assets/`, 2026-09-23, asset-agent)

`ref-<prop>.jpg` holds 12 codex image_gen references, the inputs for local image-to-3D (TRELLIS.2 on MPS,
`scripts/img2mesh/README.md`). Each shows one prop in 3/4 view on white, in the faceted Driftwood style. The props:
- palm-a, palm-b, palm-c, piling, sailboat, hut, wreck and shrine, one each;
- boulders and driftwood, each a sheet of separate pieces;
- clutter and coco, each a sheet that `split_sheet.py` cuts into single crops.

`board.jpg` has one row per prop and four columns: the concept-art crop, the reference, the new asset
(`public/assets/models/driftwood-hero/`, an Eevee still under the same light), and the current procedural model
(a Model Explorer capture of the live build). `hunyuan-vs-trellis.jpg` shows the palm and the hut from each model.
Nothing was re-rolled.

### Dodge feel storyboards (`art/combat/round-2-dodge/`, 2026-09-23, E60)

codex edits of one live 390×844 capture on the Driftwood pier (`ref-live.jpg`, `?touch&tier=phone&skipintro&nolock&weapon=sword`, the stick held right);
`before-live.jpg` is today's dodge mid-dash (a ×0.1 slow-mo capture). Each variant is 4 frames of a dodge to the right: anticipation 0–40 ms,
burst 60 ms, peak 150 ms, recovery 350 ms. The DODGE disc's cooldown sweep (E59) is shown, not designed. Plan: `project/archive/2026-09-29-dodge-feel.md` (archived).
- `board-T-lean-smear.jpg` **T1–T4**: the camera rolls into the dodge, a horizontal smear on the outer thirds, the sword flung left and whipping back (recommended).
- `board-U-afterimage.jpg` **U1–U4**: a cyan rim flash, 3 cyan ghosts of the sword left behind, shard flakes, a fringe, a corner glow.
- `board-V-roll-dip.jpg` **V1–V4**: a crouch-height dive and rise, a +10° FOV punch, dust + splinters, a vignette, the sword tucked flat.
- `board-0-overview.jpg`: BEFORE + the peak frame of T / U / V.
Re-rolled: V2 once (steel blade), V4 three times (squashed HUD).

### HOVER button position (`art/hud/round-11-hover-position/`, 2026-09-23, E80)

Jake: "I don't like the hover position". These are codex edits of his iPhone screenshot (`before-iphone.jpg`), where the
HOVER pill floats over the bottom bar, left of V DODGE. Every variant takes the pill out of that spot and puts one HOVER
control somewhere else. **A** `A-top-row-pill.jpg`: a third pill in the top row, after "30 fps". **B** `B-disc-above-jump.jpg`:
a round disc above JUMP in the right-thumb cluster. **C** `C-bar-tab-above-move.jpg`: a folder tab on the bottom bar's top
edge, above MOVE. **D** `D-under-objective.jpg`: a small tab under the GLYPH SHARDS / SEA CAVE strip. **E**
`E-disc-left-edge.jpg`: a round disc on the left edge, above MOVE, for the left thumb. `board.jpg` = BEFORE + A–E.
Re-rolled: B twice (the first take shrank and moved the whole HUD; the second lifted JUMP ~120 px) and D once (it came
back 2:3 and squashed the frame).

### Pine Hollow remaster boards B1–B4 (`art/pine-hollow/round-1..4-*/`, 2026-09-24, PH-0.6)

Jake's four pre-build decision boards for `project/archive/2026-09-25-pine-hollow-remaster.md` §2. All are photoreal codex image_gen edits of real
captures from the worktree dev server (:5176): a top-down god-camera shot (`round-1-map/capture-today-top-down.jpg`, north up
per the HUD compass) and an iPhone 16 Pro portrait frame with the real touch HUD (`round-4-journal-ui/capture-iphone16pro-hollow-cabin.jpg`).
- `round-1-map/board.jpg` **B1 Map D layout**: **A** `A-ridge-north.jpg` ridge along the north, old-growth west, hamlet SE;
  **B** `B-ridge-east.jpg` ridge along the east, old-growth north, hamlet SW; **C** `C-ridge-northwest.jpg` ridge + den NW round
  the Ridge cabin, old-growth east, hamlet S; **D** `D-southeast-old-growth.jpg` ridge north, old-growth deep SE, hamlet SW.
  Re-rolled: A, B and D once (the first takes put the hunting lodge outside the hamlet; B also labelled the wrong crags THE RIDGE).
- `round-2-antler-king/board.jpg` **B2 the Antler King** (night boss-fight frames, from the Nalati concept
  `boss-6-alt-antler-king.png`): **A** `A-bark-warden.jpg` bark-plated, bone skull, 3 lanterns, amber ribcage; **B**
  `B-moss-king.jpg` dripping moss, 6 lanterns, cyan ribcage; **C** `C-rootbound.jpg` gaunt root skeleton, 1 great lantern,
  foxfire-green ribcage; **D** `D-lantern-bearer.jpg` boulder-heavy, ~12 lanterns, ember-red ribcage. None re-rolled.
- `round-3-thralls-ranger/board-thralls.jpg` **B3 thralls**: **A** `thrall-A-overgrown.jpg` moss + ferns, cyan glass eyes;
  **B** `thrall-B-root-stitched.jpg` roots sewn through the hide, amber chest glow; **C** `thrall-C-hollow-husks.jpg`
  birch-bark shells, milky eyes. Re-rolled: C once (the first take had canine-looking eye-glints in the fog; no wolves, PH-U9).
- `round-3-thralls-ranger/board-ranger.jpg` **B3 the ranger** (in the Hollow cabin, dialogue panel): **A**
  `ranger-A-old-warden.jpg` an old man, campaign hat; **B** `ranger-B-last-of-the-wardens.jpg` a woman in her forties,
  oilskin, lever-action; **C** `ranger-C-hermit-ranger.jpg` an androgynous hermit in a moss-green cloak. None re-rolled.
- `round-4-journal-ui/board.jpg` **B4 hunter's journal + trophy wall** (phone portrait; top row the journal, bottom row the
  wall of the same letter): **A** `A-journal-open-book.jpg` + `A-wall-lodge-shields.jpg`; **B** `B-journal-half-sheet.jpg` +
  `B-wall-plaque-cards.jpg`; **C** `C-journal-elite-3d-plate.jpg` + `C-wall-chalk-outlines.jpg`. Re-rolled: B wall once
  (the first take had moose / ram skulls, a scoped rifle and a dog).

### Pine Hollow day / night (`art/pine-hollow/round-5-day-night/`, 2026-09-24, PH-L2 / L3)

`board.jpg` **"Pine Hollow day / night — keep this?"**: in-engine iPhone 16 Pro captures (390×844 @3, phone tier, a clean
export of `7b1430b`), top row the Hollow cabin anchor's FP front (`round-0-baseline/cameras.json`: −20, −50, yaw −2.783),
bottom row the ranger's porch and fire pit (0, −42, yaw 2.1). **A** the new clock (`src/world/PineDayNight.ts`) at dawn
(`?tod=dawn`), day, golden hour and night (moonlit, the lanterns and fire lit); **B** the old fixed HDRI sunset
(`?tod=sunset-fixed`). No codex edits.

### Pine Hollow hunter's-journal sketches (`art/pine-hollow/round-6-journal-sketches/`, 2026-09-24, PH-C5 / C4)

codex image_gen, one run per image with the pencil plate of `round-4-journal-ui/A-journal-open-book.jpg` as the style
reference (no reference for the chalk). **Beasts + elites** (16, square, the animal alone on blank paper): `red-deer`,
`white-deer`, `piebald`, `boar`, `black-boar`, `scarback`, `elk`, `pale-elk`, `black-bear`, `brown-bear`, `grizzled-sow`,
`ironhide`, `ghost-stag`, `blackpaw`, `imperial-bull`, `antler-king` (the Bark Warden, board B2 A). **Places** (18, 3:2
vignettes, the POIs of layout v2): `place-<poi id>`. **Chalk** (5, white on black, the trophy wall's outlines):
`chalk-stag`, `chalk-elk`, `chalk-boar`, `chalk-bear`, `chalk-king`. Re-rolled: `pale-elk` (came back cut out on black)
and `chalk-king` (filled grey, not an outline). `scripts/journal-art.py` ships them to `public/assets/pine-hollow/journal/`.

### Pine Hollow water (`art/pine-hollow/round-7-water/`, 2026-09-24, PH-L9)

Live captures, not mockups (phone tier, iPhone 16 Pro, HUD hidden, `tod=day|night&clock=1e6`). `board.jpg`: "which pond?"
— A the new pond (the clock's sky + the skyline probe, one draw), B the planar before (`?pond=planar`), at the pond's W
shore day / night and the N shore's shallows. `water-day-night.jpg`: the new water at the pond shore, the waterfall's
base, the beaver dam and the creek at the E road, day and night.

### Pine Hollow painted horizon (`art/pine-hollow/round-10-horizon/`, 2026-09-24, PH-L5)

The photoreal far country beyond the slab, day + night, in place of the 17 Sep ridge rings and the white cloud sea.
`capture-h<t>.jpg`: the clock's empty sky from the fire lookout's deck (eye 59.2 m, heading t: dir = (cos t, 0, sin t),
level, vfov 72°, `tod=day`). `segment-day-h<t>.jpg`: codex edits into far boreal country (forested ridges in aerial
perspective, the snow-capped range N / NW, lakes, valley mist), painted as a CHAIN: h120 (the hero range) first, then
h060 / h180 continuing it, then h000 / h240, then h300 closing the ring (each given its neighbours' overlap strip,
`scripts/horizon-matte/overlap.py`, and the strip pasted back after). Re-rolled: the first independent round of all six
(their overlaps disagreed: a mountain range cut by a vertical seam), h060 / h120 once for bolder peaks (~3° → ~10°), h060
three times as a chain (twice it redrew the strip it was told to keep). `segment-night-h<t>.jpg`: codex's moonlit edit of each
day segment; phase correlation against the day edges: h000 / h060 0–2 px, h120–h300 a uniform 32 px (codex shifted the
frame), corrected, then 0–1 px (h240's hazy skyline 7 px at a weak peak). `strip-day.jpg` / `strip-night.jpg`: the
6144 × 704 cylinder (−30° … +14°) at half size; `strip-day-keyed-over-checker.jpg`: the skyline key (key.py `mode:
skyline`). `board.jpg`: "Pine Hollow horizon — which?", A painted vs B `?horizon=rings`, phone tiles at the lookout deck
N / S / W and the Hollow's floor N, golden hour + night. `walk-around.jpg`: 12 frames turning 360° round the deck (top
6 in game, bottom 6 the painting alone): no seam.
### Nalati HUD on main's touch HUD (`art/hud/round-12-nalati-merge/`, 2026-09-24, N16)

The Nalati merge's HUD round (spec: `docs/design/nalati/merge/review-experience.md` §1.4, with the user's wave-4
decisions: HOVER on foot only, DISMOUNT a small right-edge tab, bow = hold FIRE to draw / AIM a zoom latch, LOCK with the
sabre and spear, no text on the minimap, chapter 1 quest chip "TULPAR"). codex edits of the merged build's live 390×844
captures (`progress/nalati-merge/review/nalati-foot.jpg`, `nalati-mounted.jpg`; `driftwood-main.jpg` passed as the HUD-style
reference). Each variant has two frames: `<L>-foot.jpg` (crouched in the grass, the bow half drawn, storm coming) and
`<L>-saddle.jpg` (galloping on Tulpar with the sabre, the elite AQBARS THE PALE spotted).
- **A** "edge tabs": HORSE / DISMOUNT plus the three weapon tabs stacked on the right edge. STEED row under VITALS. Storm
  chip under the quest chip. A sun glyph on the minimap rim.
- **B** "bar-edge folder tabs": HOVER, a segmented BOW / sabre / spear tab and HORSE / DISMOUNT grow out of the bar's top
  edge. STEED is an amber line on the MOVE edge. Quest + storm are one two-line chip. The clock is "DAY" in the fps pill.
- **C** "one arc and a weapon card": AIM / CROUCH / DODGE / JUMP on one arc over FIRE (LOCK / GALLOP in the saddle). A
  BOW / SABRE card with dots sits on the divider. The storm is "0:45" on the quest chip. The clock is a sun + "DAY 1" beside the minimap.
- **D** "status left": left column VITALS / STEED / ARROWS / sky row (day + storm) / stealth "HIDDEN", weapon tabs on the
  left edge, HORSE / DISMOUNT on the right edge, a bare crosshair.

`board.jpg` has four columns (A–D) and two rows (on foot · bow / saddle · sabre). Re-rolled: B-foot once (the first take
came back 793×1983 and stretched the frame), A-saddle once (the MOVE label dropped under the stick), C-saddle once (the
weapon card's dots lit the first slot, not the sabre's, and the bar lost its see-through look).

### Local Qwen-Image-2.1 vs codex (`art/local-image/round-1-qwen21-vs-codex/`, 2026-09-24, E100)

Not codex images. Ten existing codex mockups were remade on this Mac with **Qwen-Image-2.1** (7B, diffusers on MPS bf16,
84–132 s each), from the same input frames and the same verbatim prompts. Each JPEG is codex (left) vs local (right),
one take per image. Qwen keeps the layout and large UI text, but garbles small text, greys Driftwood's toon palette and
re-composes the camera when given several references. Codex holds the frame closer. Qwen's licence is research-only,
so nothing it made may ship. Verdicts per image are in the round's `README.md`.

### Branded RESUMING screen (`art/resume/round-1-branded/`, 2026-09-24, E99)

Live captures of the app-switch resume screen in the game at iPhone 16 Pro size, not codex images. The screen is taken
through the real hide → show path. `board.jpg` sets the three looks side by side: **A** title art (the shard's title
screen with the wordmark), **B** glass card over the blurred paused game, **C** a navy plate with the shard mark.
`a-title.jpg`, `b-glass.jpg` and `c-plate.jpg` are the single frames. Jake picked **A**. `picked-a-per-shard.jpg` and
`picked-a-three-shards.jpg` show A on Driftwood Isle, Pine Hollow and Nalati Grasslands.

### Pier pennant shadow (`art/shadows/round-2-flag-video/`, 2026-09-25, E147)

Live phone-tier captures of the pier pennant's shadow on the deck, not codex images. `zoom-now-vs-continuous.jpg` and
`change-heatmap-now-vs-continuous.jpg` show the 0.25° stepped sun against a sun moved every frame (the flicker returns).
`poses-wide-close.jpg` are the two video poses. `c-near-cascade-board.jpg` compares the near-shadow sharpness options
(A now · B 5×5 blur · C 3 cascades 7/22 m · D 5/18 m); Jake picked A + B + C, and C shipped. `before-after-zoom.jpg` is
a frame of the before / after video. The videos themselves are not committed (the uplink).

### Far ground wears the cover (`art/foliage/round-1-ground-wears-cover/`, 2026-09-25, E156)

`board-p3.jpg` (in the ferns, the shrine knoll) and `board-p2.jpg` (the hut plateau) put four versions side by side:
SHIPPED · A1 tint only · A2 mottled + flecks · A3 A2 + slope clumps. They are procedural recolours of live phone captures;
Qwen-Image couldn't tint the ground in 3 seeds × 6 jobs (`qwen-attempts-A1.jpg`). The build is A1 plus C (the tint and
the slope reach, E156). Jake: "Mockups don't tell me anything" — the pick was made in game.

### Reasons to wander (`art/quest/round-3-wander/`, 2026-09-29, E309)

Three boards for DRIFTWOOD-TOP10 row 9b, made from codex edits of live iPhone portrait captures. `board-1-gulls.jpg` asks how
gulls lead you to unfound places: A a flock over the place, B gulls fly past you, C a perched gull takes off, D none.
`board-2-map.jpg` asks how the map shows found and unfound places: A ring "?" pins + "PLACES 4 / 11", B fog, C "???"
rings, D today. `board-3-sea-glass.jpg` asks where the sea glass count goes: A the map tag, B the inventory, C today's
pickup toast, D all three. Recommended: A, A, A. The folder's README lists every frame.

### What is a model (`art/models-audit/round-1-census/`, 2026-09-29, E306)

`models-census-sheet.jpg`: live phone-tier captures (390×844 @3×, build `412d443`), no image model. Top row: the four
shards' Model Explorer catalogs today (54 cards). Middle: four real models (Hut, Coconut palm, Scots pine, Guardian
lion). Bottom: four whole places on a turntable, the "blur" (Kurgan field, Snow lotus, Spring camp, Wreck cove). The
audit is `docs/audits/models-and-model-explorer.md`; the draft plan `project/archive/2026-09-30-model-architecture.md`.

### Model spin clips (`art/models-audit/round-3-spin-clips/`, 2026-09-29, E315 / MODEL-ARCHITECTURE M9)

The first two clips from `scripts/model-spin.mjs`: 10 s portrait turntables shot in the game's real Model Explorer at
phone tier (402×874 @3×, canvas 804×1748, build `412d443`), the explorer's own overlay laid on, H.264 ~4.5 Mb/s.
`driftwood-hut.mp4` (5.1 MB): the Hut, one full turn. `nine-dragon-first5.mp4` (5.7 MB): Nine Dragon's first five
catalog cards, 2 s and one turn each: Umbrella walker, Mahjong sitter, Guardian lion, Fei Zhua dragon hook, Training
dummy.

### Loot loop, the in-world moments (`art/loot/round-1-loop/`, 2026-09-29, E314)

Four boards for DRIFTWOOD-LOOT L1–L4, codex edits of live iPhone 16 Pro portrait captures. `board-1-coins.jpg`: how coins
come out of a kill (A burst + magnet with a "coin 23" HUD chip, B on the ground, C a number only, D a pouch for big kills).
`board-2-shop-world.jpg`: Wendell's shop in the world (A a counter, B the hut wall, C a beach stall, D today).
`board-3-charm.jpg`: the sea glass charm (A beads on the sword hilt, B a HUD pendant, C a door wind chime, plus A's night
glow at 15 / 15). `board-4-trophies.jpg`: where trophies go (A plaques, B a tagged shelf, C the hat worn). Recommended:
A, A, A, A. The folder's README lists every frame.

### The first three minutes (`art/onboarding/round-1-first-minutes/`, 2026-09-29, E308)

Three boards for DRIFTWOOD-TOP10 row 5, live iPhone 16 Pro portrait captures (HTML hint overlays over the live HUD; the
pier sign is a Qwen-Image edit). `board-1-hint-look.jpg`: how first-time control hints look, MOVE at the spawn and
ATTACK at the practice crab (A on the control, B a banner, C a ghost thumb, D in the world). `board-2-practice-target.jpg`:
what you practise on at the pier's foot (A a crab, B the E289 dummy, C Wendell spars, D nothing). `board-3-start-length.jpg`:
where you spawn, with walk times to Wendell (A today 49 s, B half way down the pier 38 s, C the pier's foot 30 s, D
Wendell meets you, 19 s). Recommended: A, A, B. The folder's README lists every frame.

### Model Explorer, M0 (`art/models-audit/round-2-m0/`, 2026-09-29, E306)

`m0-before-after.jpg`: live phone-tier captures (390×844 @3×) of clean exports before (22f7da91) and after the model
contract (src/models/). Each shard's catalog before / after (every card now says how it's made, its copies and how
they are drawn), the shore boulder's card (the first model on `place()`), and Nine Dragon's VIEW IN WORLD (before: the
origin under the square; after: a real lion). Plan: `project/archive/2026-09-30-model-architecture.md`.

### Driftwood models, M1 (`art/models-audit/round-4-m1-driftwood/`, 2026-09-29, E315)

`m1-before-after.jpg`: live phone-tier captures (390×844 @3×) of clean exports before M1 and after it. Top: Driftwood's
Model Explorer catalog before (19 cards: the pier and a jetty apart, the palm and bush specimens registered by hand, the
Blender spawn cove with no card at all). Middle: the catalog after, all 42 cards (the pier ×4, the hut, the shrine, the
sailboat, the coconut palm ×204, the hibiscus bush ×170, the small rock ×400, the cove's 16 prototype families — grass
tuft ×4,996, cove fern ×1,779 … —, the coral clump, seaweed bed, reef starfish, reef fish, the fence post, signpost and
plank step). Bottom: turntables. `m1-driftwood-spin.mp4`: a 12 s spin of five of them (coconut palm, pier, Ring
shrine, cove palm, coral clump) in the real explorer. Plan: `project/archive/2026-09-30-model-architecture.md` row M1.

### Nalati models + sets, M3 (`art/models-audit/round-6-m3-nalati/`, 2026-09-29, E315)

`m3-nalati-before-after.jpg`: live phone-tier captures (390×844 @3×) of clean exports before (280c442f) and after the M3
tree. Top: Nalati's Model Explorer catalog before (17 cards, whole places: the Kurgan field, Balbals, Kokpar field, Snow
lotus, Glacier …) and the Kurgan field on its turntable. Middle: the catalog after, every card (the kerb stone ×332, the
fieldstone, the kurgan entrance, the balbal, Eagle Rock, the Wind Cairn, the crag ledge, the leopard's cave, the
watchtower, the stone step ×54, the kokpar post / goal / rider, the standing saddled horse, the herd horse, the snow
lotus; the camps stay whole cards this pass). Bottom: six turntables. `nalati-m3-five.mp4`: a 10 s spin of five of them
(balbal, kurgan entrance, Kunes bridge, watchtower, Wind Cairn) in the real explorer. Plan: `project/archive/2026-09-30-model-architecture.md` row M3.

### Pine Hollow models, M2 (`art/models-audit/round-5-m2-pine-hollow/`, 2026-09-30, E315)

`m2-pine-hollow-before-after.jpg`: live phone-tier captures (390×844 @3×) of clean exports before (be264e7f) and after
M2 (451a0903). Top: Pine Hollow's Model Explorer catalog before (13 cards: three live cabins, the pond, one hand-made
Scots pine for the whole forest, the boulder / stump / log specimens) and that pine on its turntable. Middle: the catalog
after, all 42 cards (the log cabin ×3 and the Mill hamlet's five buildings with their crates, barrels, buckets, hatchets,
fire pit and lanterns; the fire lookout, zipline landing, zip cable and creek footbridge; the eight TRELLIS props; the
ridge crag ×60, crag boulder ×52, scree ×30; the mossy boulder ×380, stump, fallen log; the forest tree ×918 with its 14
species; fern ×6,000 and the forest floor's other five kinds; the token shelf and the hollow log). Bottom: six
turntables. `pine-m2-five.mp4`: a 10 s spin of five of them (forest tree, fire lookout, log cabin, ridge crag, standing
stone) in the real explorer. Plan: `project/archive/2026-09-30-model-architecture.md` row M2.

### Creatures, people and gear, M5 (`art/models-audit/round-8-m5-creatures/`, 2026-09-30, E315)

`m5-<shard>.jpg`, one per shard: live phone-tier captures (402×874 @3×) of clean exports before (7364cce1) and after M5.
Top: the Model Explorer's Creatures tab before (only the species alive when Explore opened), then Creatures, the new
People tab and the new Gear tab after (the shard's whole species list: bosses and flocks before they come; the crowd,
camp people, NPCs; every weapon its kit holds, shared ones marked SHARED). Bottom: turntables (Driftwood: the Drowned
Captain, Wendell, the wooden sword, the AR-15; Pine Hollow: the Antler King dressed, Ranger Hale, the lever-action, the
skinning knife; Nalati: Jel Ata, the Golden King, the camp people, the bow; Nine Dragon: the fp arms, the umbrella walker).
`m5-pine-hollow-five.mp4`: a 10 s spin of the Antler King, the bear, Ranger Hale, the lever-action and the crossbow in the
real explorer. Plan: `project/archive/2026-09-30-model-architecture.md` row M5.

### Driftwood first-person remaster, round 1 (`art/driftwood-fp/round-1-remaster/`, 2026-09-30, E334)

`board-1-today-vs-nine-dragon.jpg`: live iPhone-portrait captures of Driftwood's wooden / iron sword viewmodel (idle,
mid-swing), its swimming hands, and Nine Dragon's rigged arms (idle, mid-swing). `board-2-sword-and-hands.jpg`: four
codex edits of the live idle frame: A castaway (recommended), B sailor, C adventurer, D the Nine Dragon rig re-coloured,
plus A with the iron sword. `board-3-swimming-hands.jpg`: A breaststroke (recommended), B front crawl, C dog-paddle. The
README holds the Nine Dragon vs Driftwood viewmodel comparison and the build route: reuse the fp-rig skeleton and clips
with Driftwood meshes, and put the swim clips on the same rig.

### Models, second pass: Driftwood, Nine Dragon, Pine Hollow (`art/models-audit/round-10-second-pass/`, 2026-09-30, E315)

Phone-tier Model Explorer captures of clean exports before / after each shard's second pass (MODEL-ARCHITECTURE M1, M2,
M4). `driftwood-board.jpg` (42 → 67 cards: the lookout, the Wreck cove's models, the rope bridge, the zipline, the drift
logs, the interactables) and `driftwood-spin.mp4`; `nine-dragon-board.jpg` (39 → 57: the banyan, the stalls, the sign
family, the laundry, the facade shell's pieces, the stone planter) and `nine-dragon-spin.mp4`;
`nine-dragon-banyan-studio.jpg` (the banyan's specimen before / after the studio's city air went: grey fog → green
crown); `pine-hollow-board.jpg` (the forest and its floor drawn by `place()`, the cabin props' own colliders, the 19 place
Sets). Plan: `project/archive/2026-09-30-model-architecture.md`.

### Nalati models, second pass (`art/models-audit/round-10-second-pass/`, 2026-09-30, E315)

`nalati-board.jpg`: phone-tier captures (390×844 @3×) of clean exports before (41 cards: the camps as whole-place cards)
and after the Nalati second pass (87 cards: the yurt, the camp props, the fence and signpost, the dressing's scatter and
props, the escarpment's and the snow ring's rock, the glacier snout), five turntables (yurt, hitching rail, kazan, crag
rock, ovoo cairn) and the Sets explorer (17 sets: every named place). `nalati-spin.mp4`: an 8 s spin of the same five
models in the real explorer. Plan: `project/archive/2026-09-30-model-architecture.md` rows M3, M12.

### Pine Hollow crags, A / B (`art/pine-hollow/round-24-e322-crags/`, 2026-09-30, E322 F-L2)

`board.jpg`: pause ▸ Settings ▸ Debug ▸ Look ▸ Crags, A today | B new crags (the face skin without the stretch, paler
granite, fused and fractured cliff modules, a hero crag on the crest E of the lookout), iPhone portrait, close up at the
pass, the lookout's east catwalk, the Ridge from the trail; the GPU ms and the bytes in the footer and the README.

### Loot, the other three shards' Bag (`art/loot/round-3-other-shards/`, 2026-09-30, E314)

This covers the last row of DRIFTWOOD-LOOT: the shared five-tab Bag rolled out to the other three shards. The frames
are codex edits of live iPhone 16 Pro portrait Bag captures, two frames per variant.
- `board-1-pine-hollow.jpg`: A leanest (JOURNAL renamed FINDS, and the pack trimmed to Mott's 7 kinds), B Driftwood's
  full pattern, C the middle (A plus FINISHES on GEAR and trade lines on the pack).
- `board-2-nalati.jpg`: A MAP · GEAR · FEATS with no pack, B the full five, C no pack with FINDS showing the elites.
- `board-3-nine-dragon.jpg`: A MAP · GEAR (jian and grapple), B the full five, C with three traversal feats.
- `board-4-order.jpg`: the recommended order and what each shard takes.

Recommended: Pine C, Nalati A, Nine Dragon A, in that order. The folder's README holds the per-shard audit (the slop
and the bugs).
- `pine-hollow/round-25-e322-king-rig/` — E322 F-M1: the Antler King's own upright rig (Debug ▸ Antler King rig A/B): the codex ref, the Hunyuan hull, the rig gate's freeze, `board.jpg` (A/B idle · charge · rearing strike, by day).

### VIEW IN WORLD's eye, before / after (`art/models-audit/round-12-view-in-world/`, 2026-09-30, E342)

`e342-before-after.jpg`: Nine Dragon, iPhone portrait (402 × 874, phone tier), real builds: the World Explorer frame each
card's VIEW IN WORLD lands on, and what a tap at its centre selects: the earth-god shrine, the paifang, a roll shutter
and the noodle stall. Before (HEAD 24c8e415), the camera stood in the stack, a metre from a wall or a pipe (6 / 20 taps
picked their own model). After, the eye is the old framing where it is clear, else the first clear one round the copy,
checked on landing with a tap's own pick (19 / 20). `scripts/explore-view-taps.mjs` measures all four shards.

### Nine Dragon specimens, brightened and refitted (`art/models-audit/round-13-nd-specimens/`, 2026-09-30, E315)

Jake's pick after the Explorer review: Nine Dragon's dark or small Model Explorer specimens, brightened and refitted in the
Explorer only. `nd-specimens-before-after.jpg`: the four he named (the Kowloon stele, the lotus-bud finial, the roll
shutter, the sign), each one's first turntable frame, iPhone portrait, before (416416c6) / after. The turntable now lights
Nine Dragon's specimens like a studio (look/specimenLight.ts: a raised ambient, the shade wash lifted, the top light keyed
from the side the turntable opens on, the washes dry), and a flat piece drawn from one side (the shutter, the sign, the
laundry line) opens facing its face on a smaller disc, fitted over its sway (the shutter showed its blank back, the sign
stood on a disc wider than it). `framing-nine-dragon-before.jpg` / `framing-nine-dragon-after.jpg`: every Nine Dragon
model's first frame (57), the same two builds.

### Migration leftovers E348 / E344 (`art/models-audit/round-14-leftovers/`, 2026-09-30)

Evidence, not picks (real builds, iPhone 16 Pro portrait, phone tier). `e348-new-cards.jpg` (E348, `e1c6bf49`): the nine
Model Explorer cards the M5 leftovers became, each a separate build by the builder its live system draws with — the
hoverboard and the swimming hands (shared), the training dummy (its arena lineup now placements of the model, × 3), and
Nalati's butterfly, raptor, reins and arrow and Pine Hollow's crossbow bolt and longbow arrow. `e344-cove-colliders.jpg`
(E344, `3ce5a3ab`): Driftwood's Blender cove in the collider debug view before (the 200 island.json boxes on the P2
bridge, orange) / after (on their models: crag plates cyan, cove palms green, broad-frond palms yellow), the same camera,
and the navmesh over the same view (a byte-identical bake).

### Migration leftovers E346 / E345 (`art/models-audit/round-14-leftovers/`, 2026-09-30)

Evidence, not picks (real builds, iPhone portrait 402 × 874, phone tier). `e346-nine-dragon-posts.jpg` (E346, `8842312f`): the Model
Explorer cards of the models E346 put on the contract — the Well's balustrade (one 64.6 m run, which owns what was
`nds-edges`: its stone box and the invisible parapets over it), the crossings' lotus-capped balustrade post (× 146) and
stone lamp post (× 28), and the paifang (× 4, every gate's posts now its own colliders) — and VIEW IN WORLD on a lamp post
and on the balustrade. `e345-view-in-world-taps.jpg` (E345, `79c7232f`): VIEW IN WORLD's landing on the three models whose centre tap
missed (Pine Hollow's stone fire pit and flint & steel, Nine Dragon's scooter), before (ba78a6e6) / after, what the tap
selected, and each shard's score (`scripts/explore-view-taps.mjs`).

### Migration leftover E347 (`art/models-audit/round-14-leftovers/`, 2026-09-30)

Evidence, not a pick (real builds, iPhone portrait, phone tier). `e347-homestead-before-after.jpg` (E347, `f0b24872`):
Pine Hollow's homestead and the mill hamlet before (src/world/Cabin.ts merging across buildings) / after (`place()`'s
weld: one draw per shared material across the buildings, the detail and far parts dropped by distance per copy, the
props instanced across buildings); identical census, colliders and Model Explorer sheets, GPU within ±0.06 ms a pose.
