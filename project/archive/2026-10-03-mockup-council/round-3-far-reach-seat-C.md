# Round 3, seat C, Sky Reach only (red team: the demanding art director)

Surface: `art/mockup-council/round-3/README.md`, the five `far-reach-*.jpg` sheets, the full-res capture
`progress/far-reach/20261002-2333-b69c79d1/` (every `mock-*`, the hero views, both aerials, `clip.mp4` sampled at 1/3/5/7/9 s),
round 2's `progress/far-reach/20261002-2249-1b278da3/` cropped side by side with it, the five mockups at full resolution
(ledger 3), and at `b69c79d16`: `art/far-reach/progress/cameras.json`, `plugin.ts` `stage()`, `species/stormRoc.ts`
`stageStalk`, `scripts/shard-progress.mjs` (the pose and floor check). Regions are fractions of the game frame (x left→right,
y top→bottom, HUD included).

Round 3 is the biggest step so far, and most of it is real: the bridge deck now has painted, graded planks and hangs in a
sag on thin hemp hand ropes; the hero sky isles are textured models with strata and hanging roots; the sun sits behind the
mill's hub; the crown storm is a dark vortex with an eye and branching bolts; the Roc flies under the bar; the keeper waves at
9 m. But no frame passes a two-second look. The meadow is still a saturated yellow-green lawn, the fan is one face-on
half-disc in every view, the arena is smooth slabs on thin grass in front of a blank haze, and the light is clean daylight,
not the mockups' gold backlit haze.

## Measured colour (R,G,B mean; mockup / round 3 / round 2)

Sky patch x 0.18–0.82, y 0.17–0.33. Ground patch x 0.03–0.38, y 0.68–0.82.

| View | Sky patch | Ground patch |
|---|---|---|
| A | 198,154,124 / 208,178,154 / 205,178,153 | 81,67,39 / **104,91,16** / 113,103,19 |
| B | 200,167,152 / 200,172,151 / 200,173,149 | 88,74,47 / **95,86,17** / 114,104,22 |
| C | 203,163,141 / **170,154,150** / 162,145,134 | 97,80,43 / 100,79,46 (a boulder, not grass) / 111,100,31 |
| D | 133,104,99 / 157,127,126 / 154,122,107 | 86,71,42 / **109,96,27** / 133,121,65 |
| proposal B | 207,191,182 / 170,144,110 / 187,155,119 | 74,67,37 / 191,162,156 (sky: no ground in frame) / 104,96,11 |

The grass is darker than round 2 but its blue channel (16–27) is still far under the mockups' (39–47): it reads lime, not
olive-gold. C's sky is still the coolest and greyest of the five. A's sky is paler and less orange than the mockup's.

## Scores

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | 7.0 | 1. **The meadow (x 0–0.75, y 0.66–0.86).** The mockup's foreground is backlit gold grass, varied in height, with three lichen boulders at the lower left and clustered daisies. The game's is an even lime sward of upright blades with dots of white and yellow scattered evenly, no rocks, and a glowing lantern at the left post (x 0–0.05, y 0.66–0.72) the mockup does not have. 2. **The isles and the light (x 0–1, y 0.08–0.5).** The sun now sits at the mill's hub (good), but the mockup hangs a cluster of big rooted isles low over the mill (y 0.27–0.40) and drowns the mill, pines and isle bellies in gold haze, rim-lit. The game's two textured isles hang at the top edge (one under the minimap, one cut at the right edge), crisp, with open sky behind the mill; the mill's white stone, the house behind it and the pines read evenly lit and saturated green. 3. **Under the bridge and the fan (x 0.15–0.8, y 0.5–0.66; x 0.5–1, y 0.6–0.85).** Under the deck the windmill isle's flat sage-green band with brown root strips stands where the mockup shows lit cliff over cloud. The deck's near end is a thick slab with a dark gap under it, floating over the grass. The fan is a face-on half-disc with its pivot and the hand behind GUST; the mockup's fan is tilted with a gloved fist gripping its base, clear of the buttons. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | 6.5 | 1. **Behind the keeper (x 0.3–1, y 0.25–0.6).** The mockup sets a small dark-timber post-mill far off on a narrow rock spur, with a low stair bridge and open cumulus over it. The game has a large near white stone tower mill with a house, a flat translucent cyan sheet beside it (the waterfall, x 0.73–0.8, y 0.3–0.42, reading as a glass pane), and the two big bridge-head posts at the crosshair. Two textured isles fill the top third (x 0.3–1, y 0.12–0.27) where the mockup has open sky. 2. **The keeper's stand (x 0.3–0.42, y 0.48–0.62).** The mockup's is a carved wooden lectern on a crate with an open, readable book and a lantern hung from it. The game's is a red-brown board on a single pole with the lantern on the ground; no book reads. The keeper waves now and stands at 9 m (both right), but his scarf is bright red where the mockup's is rust-tan, and he has no warm side light. 3. **The meadow (y 0.6–0.86).** The mockup's grass is low, gold and full of rocks and daisies; the game's is tall lime blades with scattered dots and no rocks. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | 5.0 | 1. **The fan and hand, the mockup's subject (x 0.45–1, y 0.55–0.8).** The mockup sweeps the fan diagonally across the centre from a pivot at the lower right: riveted iron guard plates with engraved corners and a sheen, a worn creased leaf, a fingerless leather glove gripping it in full view, a long red tassel, a white sleeve. The game shows its idle hold: the same face-on half-disc as every other view, slim brown sticks, flat brown guards with a diamond cut-out and no metal, the fist and pivot behind GUST, the tassel a short stub. (This is the honest frame since the `fan-gust` freeze was removed; it is also what the score must be.) 2. **The foreground (x 0.1–0.95, y 0.7–0.86).** A big smooth boulder fills the bottom of the frame: a blurry mottled green-grey top with straight faceted edges, the nearest and lowest-detail surface on screen. The mockup's foreground is gold meadow with flowers and one rough rock at the lower left. 3. **The bridge head and sky (x 0–0.7, y 0.2–0.65).** The near post is now the mockup's size and the deck runs away beside it (both better), but the mockup's weathered stone span over the bridge is still missing (open since round 1), and its big dark-timber mill fills the middle. The game's mill is small and far right of centre. The upper sky is lavender-grey (measured), with two isles where the mockup has warm gold cumulus, and the cloud sea at the left (x 0–0.2, y 0.55–0.6) reads as a flat water plane with a horizon line. |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-stalk`) | 6.0 | 1. **The arena (x 0–1, y 0.5–0.86).** The mockup has four rough, lichen-blotched stones with big carved concentric runes, a near carved dais with a compass rose (y 0.6–0.66), and lush gold grass with rocks and flowers to the bottom edge. The game's five stones are smooth rectangular slabs with small glowing cyan glyphs; the dais is a plain grey disc, far and half hidden (y 0.6–0.62); the ground is sparse upright blades over pale bare soil, and the fan covers the lower right third. 2. **Past the stones (x 0–1, y 0.43–0.6).** The mockup looks between the stones onto cloud sea, floating isles and pines. The game shows flat warm haze, with a thin cumulus edge only at the right. 3. **The Roc and the sun (x 0.2–0.8, y 0.3–0.5).** The storm above is now the mockup's (dark vortex, eye at the top, branching bolt at the left): the round's best gain. But the mockup's Roc banks at us in three-quarter view, wings spanning the frame (x 0–0.95), talons forward; the game's is half that size in a symmetric frontal glide. The sun sits right under it at the centre in a large soft halo (x 0.35–0.65, y 0.38–0.5); the mockup's is a small disc low at the left horizon (x 0.25, y 0.48). |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | 5.5 | 1. **The camera (whole frame).** The mockup stands on a high grassy knoll on the bridge's axis: the lip fills the lower-left third and the bridge falls straight away down the centre to the windmill isle. The game stands at Sunrest's rim right of the bridge head, so the bridge enters obliquely from the left edge (x 0–0.6, y 0.42–0.62), and the lower half is open air and cloud sea with no ground at all. The drop and the sag now read (the round's gain). 2. **The windmill isle (x 0.15–1, y 0.17–0.6).** The mockup's is a small, narrow rock spur with moss and roots, the mill alone on top, five isles around it at many depths and a sky-manta with a glowing trail. The game's is a wide flat-topped disc that fills the frame's width: a white stone mill, a house, a cyan glass pane, a row of uniform pines, and a vertical sage-green band with brown root strips around the rim. One isle shows (cut at the top left), and there is no manta. 3. **The fan (x 0.5–1, y 0.56–0.8).** The mockup's fan is tilted in a bare hand with wind curls round it; the game's is the same face-on idle half-disc, floating over the void, its pivot behind GUST. |

**Seat score, Sky Reach: (7.0 + 6.5 + 5.0 + 6.0 + 5.5) / 5 = 6.0** (round 2, this seat: 5.6).

## The builder's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| Rope bridges sag, thin hemp hand ropes, painted deck wood | **verified** | A, C, proposal B: grain and per-plank tone; dark thin ropes in a curve. The near end in A is a thick slab floating over a dark gap. |
| Textured hero sky isles | **verified**, placed badly | A, B, C: strata, roots, waterfalls. They hang at the top edge or under the minimap, not low behind the mill (A). The gameplay isles' rims are still the flat sage band. |
| Low sun just behind the mill, less fill, more rim | **partly** | A: the sun is at the hub. The mill's stone and the pines still read evenly lit; there is no gold haze or rim on the posts. |
| Olive-gold tufted meadow, grass round the boulders | **partly** | Darker than round 2 and in tufts, but still lime (blue 16–27 against 39–47). No boulders appear in A or B. |
| Fan's real idle hold, lower right, glove visible | **verified as stated** | The same hold in every mock and hero view and in play. The glove is a dark patch under GUST; the pivot and fist stay hidden. |
| Darker storm | **verified** | D: dark vortex with the eye at the top and branching bolts. |
| Cumulus bank round the crown | **barely** | D: a thin cumulus edge right of the stones; the rest of the horizon is flat haze. |

## No-shortcut audit (ledger 5)

| # | Severity | What | Evidence | Fix |
|---|---|---|---|---|
| X1 | should-fix | **The proposal-B re-aim leaves the meadow out of the frame.** | cameras.json at `b69c79d16`: (4.0, −14.6) yaw 9 pitch −13, right of the bridge head and off its axis. The mockup's lower-left third is the grassy lip of the knoll. The game frame has no ground below y 0.62, and the meadow is the surface every seat has marked down. It moves toward the mockup's drop, so it is not a plain dodge, but it is off the mockup's camera. | Stand on the bridge's axis at the highest grass of the rim (the mockup's camera), pitched down so the lip fills the lower left and the bridge runs straight away. If the rim has no knoll there, say so in the round notes. |
| ok | — | **`roc-stalk`** | `stageStalk` (`stormRoc.ts:47`) puts the Roc in phase 1 on its stalk line with `calm: false`; settle 0.3 s, then it flies on. The bolt is a real strike timed to the frame. A real moving play frame. | — |
| ok | — | **`quest-crown`, the `fan-gust` ruling** | The quest ends at the raise; the Roc is a separate fight. mock-C stages nothing, and its fan is the idle hold. | — |
| ok | — | **Painted only at infinity; no narrowing** | The hero isles are meshes (the clip orbit shows them in depth); the storm and the cloud sea are sky. The proposal-B pose passed `shard-progress`'s floor check (no page errors), so a player can stand there. h1–h4 and the clip show no regression. | — |

## Findings, ranked by score gained

1. **The meadow's colour and dressing** (A, B, D, and C's foreground; y 0.6–0.86). It is the largest area in four frames
   and the first thing that says "not the mockup". Fix: grade the grass to the mockups' olive-gold (their ground measures
   about 81–97 / 67–80 / 39–47), with lighter gold tips toward the sun and shorter, varied heights. Cluster the daisies
   instead of scattering single dots. Put the rough lichen boulders where the mockups have them (A: three at the lower left;
   B: several in the meadow). Give the crown the spawn's full sward, with no bare pale soil (D).
2. **The fan's hold and finish** (all five; x 0.45–1, y 0.55–0.86). One face-on half-disc in every view, pivot and fist
   behind GUST. Every mockup tilts the fan with the hand gripping its base in plain view (C: a diagonal sweep from the lower
   right). Fix: roll the idle hold so the leaf leans left and the pivot and gloved fist sit clear of GUST/DODGE; make the
   guards riveted iron plates with engraved corners and a metallic sheen; wear the leaf's edge; lengthen the tassel. Keep it
   the idle pose so it is what a player sees. A lower, tilted hold also stops the fan covering D's arena.
3. **The crown arena** (D; y 0.43–0.86). Fix: rough the stones' silhouettes (irregular tops, lichen) and carve big unlit
   runes in place of the small glowing glyphs; carve the dais's compass rose and stand nearer it (the mockup's dais spans
   y 0.6–0.66); let the cloud sea, isles and pines show between the stones where the frame is blank haze. Tame the sun's
   halo at this view, so the bright mass under the Roc is gone.
4. **Gold backlit atmosphere** (A, B, C, proposal B; whole frame). The sun is in the right place now; the air is not. Fix:
   denser warm aerial haze toward the sun, so the mill, pines and isles step back in gold; let camera-facing sides fall
   into warm shade with a gold rim on the mill, the posts and the pines. Warm C's upper sky, which is still lavender-grey.
5. **The isles over the spawn** (A, B, C; y 0.08–0.4). The new textured isles hang at the top edge and under the minimap.
   Fix: move the hero cluster lower, behind and over the mill (mockup A's y 0.27–0.40), so B and C get open cumulus above.
6. **The gameplay isles' rims** (A, B, proposal B; x 0.15–1, y 0.45–0.62). Under the bridge and round the windmill isle,
   a flat sage-green band with brown root strips. Fix: give the walkable isles' rims the hero isles' rock (strata, turf
   spilling over the lip, hanging moss), and read the translucent cyan waterfall sheet beside the mill as water (foam,
   streaks) instead of a flat pane.
7. **C's foreground and stone span** (C; x 0–0.95, y 0.45–0.86). Fix: move the camera off the smooth boulder (or replace
   it with a rough rock at the lower left, where the mockup has one), and build the stone span over the bridge head that
   the mockup shows, as real geometry with a collider.
8. **The Roc's capture** (D; x 0–1, y 0.25–0.5). Take the frame later on the same real stalk, when it is nearer and
   banking (talons forward, three-quarter view), so it spans the frame as the mockup's does.
9. **B's set dressing** (B; x 0.3–0.8, y 0.25–0.62). A carved lectern with an open book and the lantern hung from it; a
   rust-tan scarf. Proposal B's camera per X1.

SCORE sky-reach: 6.0
