# AAA target mockups

Concept / target-look mockups for the Wildshard singleplayer chunk playtest: what the demo should look like when it hits the PS5-quality bar in README.md. They are *not* engine output; they are generated images meant to read as screenshots of the finished game running in Chrome.

## How they were generated

Generated with the `codex` CLI (codex-cli 0.154.0, model `gpt-6-astra`) using its built-in `image_gen` tool (feature flag `image_generation`, stable/enabled; the system `imagegen` skill at `~/.codex/skills/.system/imagegen`). Each image was one headless run of:

```bash
codex exec -s workspace-write --skip-git-repo-check -C <repo> \
  -i <reference-1.png> -i <reference-2.png> \
  --output-last-message <log> "<IMAGE PROMPT>

TASK FOR CODEX: Generate exactly ONE image with the built-in image_gen tool using the image prompt above ... 16:9 landscape ... copy the newest PNG from ~/.codex/generated_images to art/mockup-NN-<slug>.png ... one generation only."
```

Reference images were attached with `-i` (the current in-engine progress screenshots and a frame of `sources/progress.mp4` for the HUD / typography style). Output is 1672x941 (16:9). Prompts below are the exact IMAGE PROMPT text passed to codex; the shared STYLE and HUD blocks are repeated in each prompt, so they are shown once and then referenced.

### Shared STYLE block

> STYLE (applies to the whole image): An actual in-game screenshot from a AAA PS5 first-person game, captured from a Chrome browser playtest build (the browser chrome itself is NOT visible, only the 16:9 game viewport). Photoreal Unreal Engine 5 / Nanite / Lumen-class fidelity, on par with Skyrim Special Edition, Conan Exiles and Crimson Desert on PS5. Boreal Scots pine and Norway spruce forest with photoscanned needle foliage, flaking orange-brown bark, mossy roots, ferns and needle litter on the forest floor, worn dirt trail with pebbles and exposed roots. Late-afternoon golden-hour sun, warm low-angle light, volumetric god rays through the canopy, long soft shadows, physically based materials, subtle film grain, slight vignette, filmic colour grading with olive greens and amber highlights, faint lens flare. High in the sky, partially veiled by thin haze, an enormous ringed gas giant (like Saturn, cream and tan bands, thin bright ring seen at a tilt) hangs above the treeline. 16:9 landscape, first-person perspective, eye height about 1.7 m. No watermark, no signature, no caption, no text anywhere except the HUD text explicitly listed. Not a painting, not concept art, not illustration: a crisp real-time render screenshot.

### Shared HUD block (mockups 01-05)

> HUD (minimal, diegetic-feeling, small, sharp UI drawn over the game): all panels are dark semi-transparent glass with a 1 px cyan (#8fe3ff) accent line, condensed uppercase Rajdhani-style display type in white/cyan, tiny letter-spaced grey labels. Top-left: a small glass tag panel reading exactly "PROJECT WILDSHARD" on line one and "CHUNK PLAYTEST · pine-hollow" on line two, with a tiny amber dot and the small label "LOCAL BUILD · UNUPLOADED" below it. Top-centre: a slim horizontal compass strip with tick marks and small cardinal letters "N  NE  E", the current heading marked with a cyan notch. Bottom-left: a small "VITALS" bar reading "100 / 100" with a thin cyan fill bar. Bottom-right: a small glass panel labelled "BOLTS" with the large number "29" and the small suffix "/ 30", above a thin cyan segmented ammo bar. Keep the HUD small and unobtrusive (each panel at most about 12 percent of the frame width). Render all HUD text crisply and verbatim.

## Files

### `art/mockup-01-golden-trail.png` (1672x941)

Trail through dense pines at golden hour, god rays, crossbow viewmodel, minimal HUD.

References attached: `progress/012-weapon-hud-play.png`, `sources/progress.mp4 frame @25s (intro HUD)`

Prompt = SCENE below + shared STYLE block + shared HUD block.

> SCENE: Walking along a worn dirt trail winding through a dense old-growth Scots pine and Norway spruce forest at golden hour. Massive trunks either side, the trail curves left and dips into a hollow where low sun pours between the trunks as thick volumetric god rays, backlighting drifting pollen and dust motes. Ferns, bilberry shrubs and fallen needles line the trail; a mossy fallen log lies off to the right. The ringed gas giant is visible through a gap in the canopy above the trail. In the lower-right of the frame the player's first-person crossbow viewmodel: a hand-built wooden crossbow with a dark steel prod, twisted hemp string, a loaded bolt with grey fletching, held in weathered leather-gloved hands, lit by the same warm sun, rendered with crisp PBR detail and slight depth-of-field softening at the nearest edge. Small dot crosshair dead centre.

### `art/mockup-02-cabin-clearing.png` (1672x940)

Log cabin clearing: stone chimney and smoke, woodpile, fire pit, porch lantern, deer at the tree line.

References attached: `progress/012-weapon-hud-play.png`, `sources/progress.mp4 frame @25s (intro HUD)`

Prompt = SCENE below + shared STYLE block + shared HUD block.

> SCENE: The player steps out of the treeline into a sunlit forest clearing with a hand-built log cabin at its centre, 25 m away, slightly to the left of frame. The cabin: dovetailed round pine logs weathered silver-grey, a steep shingled roof green with moss, a fieldstone chimney with a thin ribbon of pale wood smoke drifting into the golden light, a small porch with a glowing brass oil lantern hanging from the post, a rough-hewn door, a single glass window catching the sun. Beside the cabin a neatly stacked woodpile under a lean-to and a chopping block with an axe. In the foreground right, a ring of blackened stones around a fire pit with faint embers and a cast-iron pot on a tripod. At the far tree line, two red deer (a doe and a young stag) graze in tall grass, half in shadow. Golden-hour god rays rake across the clearing; the ringed planet hangs above the pines behind the cabin. Lower-right: the player's first-person crossbow viewmodel held low at rest, wooden stock, steel prod, leather-gloved hands. Small dot crosshair centre.

### `art/mockup-03-boar-ads.png` (1672x941)

Aiming down the crossbow at a wild boar 15 m away in ferns, shallow DoF, hit-marker crosshair.

References attached: `progress/013-weapon-ads.png`, `sources/progress.mp4 frame @25s (intro HUD)`

Prompt = SCENE below + shared STYLE block + shared HUD block.

> SCENE: Aiming down the sights of a hand-built wooden crossbow at a wild boar 15 m away standing broadside in a bed of sunlit ferns between pine trunks. The crossbow dominates the lower half of the frame in first-person, centred: dark steel prod, twisted hemp string drawn back, a loaded bolt with grey fletching running down the centreline toward the target, iron rear peep sight and a small front bead, leather-gloved hands gripping the stock; the rear of the weapon is softly out of focus while the front bead and the boar are sharp (shallow depth of field, ADS). The boar: coarse dark-brown bristled hide with a lighter dorsal ridge, small tusks, snout down rooting in the ferns, backlit by golden-hour rim light, dust and pollen drifting in the god rays. Hit-marker style crosshair: four short thin white ticks around a centre gap with a cyan (#8fe3ff) tint, just over the boar's shoulder. A tiny label under the crosshair reads exactly "BOAR · 15 M". The frame edges have a subtle ADS vignette. Only the ringed planet's edge shows through the canopy, top-left.

### `art/mockup-04-chunk-edge-gate.png` (1672x941)

Chunk edge: dirt road ending at a translucent cyan gate with beacon posts, glowing rim line, void/clouds and the ringed planet.

References attached: `progress/003-south-gate-beacons.png`, `progress/012-weapon-hud-play.png`

Prompt = SCENE below + shared STYLE block + shared HUD block.

> SCENE: The edge of the world. A dirt road runs straight ahead across sparse pine forest and ends abruptly at the rim of a floating 500 m square chunk of terrain. At the road's end stands a large translucent cyan gate: a thin rectangular frame of glowing #8fe3ff light about 6 m wide and 4 m tall with a faintly rippling glass-like pane, flanked by two slim dark metal beacon posts topped with bright cyan lights that cast soft cyan glow on the dirt. From the gate, a thin glowing cyan edge line runs left and right along the very rim of the chunk, tracing the cliff edge into the distance. Beyond the rim: nothing but a vast sky of layered cumulus clouds far below, the terrain cut off cleanly showing a cross-section of soil and roots and rock. The enormous ringed gas giant fills the upper-right sky, huge and detailed, with its ring casting a shadow band across its surface. Golden-hour sun from the left, long shadows of the beacon posts, a few tall pines either side of the road. Lower-right: the player's first-person crossbow viewmodel held at rest. Small dot crosshair centre. Also add a small centred glass label near the top under the compass reading exactly "CHUNK EDGE · SOUTH GATE".

### `art/mockup-05-pond-stag.png` (1672x941)

Still forest pond reflecting the pines and the ringed planet, mist, a stag drinking.

References attached: `progress/005-planet-over-the-trail.png`, `progress/012-weapon-hud-play.png`

Prompt = SCENE below + shared STYLE block + shared HUD block.

> SCENE: A perfectly still forest pond in a hollow among tall Scots pines, seen from the trail at its shore. The mirror-like water reflects the dark pine trunks, the golden sky and the enormous ringed gas giant almost perfectly, with a few lily pads and reeds at the edge breaking the reflection. Low mist hangs over the water's surface, glowing where the last golden-hour sun rays cut through the trees. On the far bank, 20 m away, a red deer stag with full antlers stands at the water's edge, head lowered, drinking, its reflection doubled in the water, rim-lit by the sun. Mossy boulders, ferns and a half-submerged fallen log in the foreground; small insects catching the light. The ringed planet is large in the sky above the far treeline and again in the reflection. Lower-right: the player's first-person crossbow viewmodel held low at rest, out of focus. Small dot crosshair centre.

### `art/mockup-06-title-screen.png` (1672x941)

Intro / title screen: PROJECT WILDSHARD wordmark, subtitle, CHUNK PLAYTEST glass panel with build metadata, ENTER THE CHUNK button, blurred forest.

References attached: `sources/progress.mp4 frame @25s (intro HUD)`, `progress/012-weapon-hud-play.png`

Prompt = SCENE below + shared STYLE block (STYLE block with the HUD-text exception reworded to "UI text" and the first-person line reworded to "the blurred background is a first-person forest view"; no HUD block).

> SCENE: The intro / title screen of the game, shown over a heavily blurred, dreamy golden-hour pine-forest background (bokeh, god rays, the ringed planet as a soft glow top-right) with a subtle dark gradient. Layout, exact text, rendered crisply and verbatim: top-left, large bold condensed uppercase wordmark "PROJECT WILDSHARD" ("PROJECT" in white, "WILDSHARD" in pale cyan #8fe3ff), under it a smaller grey subtitle line "A world that does not exist yet, arriving one chunk at a time." and a tiny cyan-dot label "PHASE 1 — GAMEPLAY CONTRACT". Centre-left: a dark semi-transparent glass panel with a 1 px cyan accent edge, titled "CHUNK PLAYTEST · pine-hollow" with small monospaced metadata rows: "CHUNK    chunk://local/pine-hollow", "GRID     (+3, -2)", "SIZE     500 m x 500 m", "BUILD    local · unuploaded", "SEED     0x7A3F19C2". Bottom-centre: a wide glass button bar with a small lock/enter icon and the text "ENTER THE CHUNK" in white letter-spaced uppercase, with a small grey line "Press any key" under it and a cyan outlined chip on the right reading "READY". Bottom-left tiny grey footer "AN IN-PROGRESS PRIVATE PROJECT"; top-right a tiny glass chip "SOUND ON" with a small bars icon. Typography: Rajdhani-style condensed uppercase display type, generous letter-spacing, crisp anti-aliased UI. This is a UI screenshot of a real game menu, clean and legible.

## HUD reimagined (`art/hud-*.png`, 2026-09-17)

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

### HUD overlays on the real frame (`art/hud-F…J.png`, 2026-09-17)

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
