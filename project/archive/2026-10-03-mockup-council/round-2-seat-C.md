# Round 2, seat C (Claude, red team: the demanding art director)

Surface: `art/mockup-council/round-2/README.md` and its five `sunscar-dunes-*.jpg` sheets; the full-res frames in
`progress/sunscar-dunes/20261002-2243-cb48ab8f/` (every `mock-*`, the hero views, `clip.mp4` sampled at 0.4 fps), against
round 1's `progress/sunscar-dunes/20261002-2149-7ec2c737/` and the five ledger mockups at full resolution. Each pair was
scaled to one width and cropped region by region (sky, crest and tower, middle ground, foreground and viewmodel). Source
checks at `cb48ab8f`: `look/render.ts`, `look/sky.ts`, `look/dusk.ts`, `plugin.ts` (`stage`, `duskOf`),
`world/places.ts`, `world/fireFx.ts`, `art/sunscar-dunes/progress/cameras.json`. Regions are fractions of the portrait
frame (x left → right, y top → bottom).

What landed since round 1, verified: the navy foreground slab is gone; the pale band under the tower is gone; the near
scrub, crates and black specks at spawn are gone; the tower is a dark steel lattice with an antenna; a far range sits on
the horizon; the waymark burns in a dark dusk with a warm pool; the wagon is seen from the back with its lantern, crates,
sacks, a barrel, a tent and a curling wisp; the dusk deepens with the quest. These are real gains, but this seat scores
the picture, not the progress.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **4.5** | 1. **Light and dune form (x 0–1, y 0.38–0.75).** The mockup is contre-jour: the sun sits behind the tower dune, so the tower's crest is a dark mass on the glow and a huge cool shadow face sweeps across the middle saddle, with lit, grain-textured sand only at the bottom left. The game's spawn dune is one evenly lit orange dome facing the camera; the shading split shows only on its right flank. Seven small rag-on-post trail markers dot the slope (x 0.2–0.6, y 0.55–0.75); the mockup's sand is unbroken. 2. **Sky (y 0.05–0.45).** The mockup's sky is orange to the zenith's edge, with grey-brown cloud banks lit from below and a dune ray soaring above the tower. The game's is a saturated navy and violet field ruled with thin horizontal pink streaks over a hard orange band; no clouds, no ray. The far range (x 0.6–1, y 0.47) is a flat lavender cut-out with no aerial gradient. 3. **Hand and whip (x 0.55–1, y 0.55–0.85).** The mockup's crisp herringbone plait with specular, in a dark cool-brown glove with creases, coiled low. The game's whip is tall upright loops in a mottled, snakeskin-like texture that reads as noise, ending in a ball knob, and a mushy, uniformly mottled fist. The tower's lantern is lit in the mockup and unlit in the game (a step-1 state; see finding 9). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.0** | 1. **Dune form (y 0.42–0.85).** The mockup has three overlapping knife-edge crests receding to the tower, each splitting a warm lit face from a deep violet-brown shadow face, and ripples to the bottom edge with lit crests and black troughs (grazing light). The game has one rounded dome that fills the middle, lit nearly flat, with faint tone-on-tone ripples and no grain; trail markers again at x 0.55–0.75. 2. **Sky (y 0.08–0.42).** The mockup is mostly orange with burnt-orange and pink cloud banks, blue only at the very top. The game is mostly violet and navy, with ruled streaks; the colour hierarchy is inverted. 3. **Subject and hand (x 0.1–0.35, y 0.6–0.78; x 0.55–1, y 0.55–0.85).** Sefa and her "SEFA 8 M" chip stand in the lower left where the mockup is empty sand, and the whip and fist are as in dusk-fire. Sefa is the quest's real first step, so this difference stays; the rest is fixable. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **5.5** | 1. **The tent and the camp (x 0.82–1, y 0.46–0.56; x 0.6–1, y 0.45–0.52).** The game's tent is a pure black wedge with no shading, the worst read in the shard: it is two thin near-black boxes, `TENT_CANVAS = 0x2c2220` (`world/places.ts:41, 121–125`), with no end panel, so it reads as a hole in the frame. The mockup's tent is a shaded dark-canvas silhouette with a horse or camel beside it; the game has no animal. 2. **Framing and light (x 0–1, y 0.3–0.6).** The mockup's wagon stands on the horizon line with the afterglow behind it and dark dusk-brown sand around it. The game's wagon sits against a big lit orange dune, and the sand is lit a daytime orange under a starry night sky; light and sky disagree. 3. **Wagon finish (x 0.42–0.58, y 0.43–0.55).** The mockup's canvas is torn, sagging cloth over visible hoops, on a planked, spoked, warm-wood wagon lit by a bright lantern. The game's canvas is faceted with tatters floating off the top right, its lantern a small yellow rectangle, and the crates and barrel plain untextured boxes and a cylinder. The "READ THE LOGBOOK" prompt is not shown at 21 m. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.0** | 1. **The fire (x 0.3–0.55, y 0.28–0.47).** The mockup's fire has many ragged orange tongues over a visible pile of burning logs, a thick grey smoke plume billowing to the upper left and a long stream of orange embers. The game's flame is two smooth soft-edged billboards with a pale yellow core, like a gas flame, over a dark X of logs; its embers are a sparse column of round dots, and there is **no visible plume**: the smoke quad is 1.05 m wide (`fireFx.ts:197`, `15 × 0.07`) and dark brown against a dark navy sky. 2. **Upper-left clutter and the missing next waymark (x 0–0.35, y 0.27–0.42; x 0.8–0.95, y 0.43–0.5).** The re-aim swaps the mockup's lit next waymark ("WAYMARK 64 M") on the right horizon for the tower's legs at the upper left, cut by the "SIGNAL TOWER 76 M" chip and the toast stack. The horizon is one dead-straight diagonal across the frame. 3. **Brazier and hand (x 0.4–0.5, y 0.47–0.6; x 0.55–1, y 0.55–0.85).** The mockup's brazier is soot-dark weathered iron on rough fieldstone; the game's is a clean, evenly self-lit copper-brown with a crisp new brick plinth. The whip and glove read translucent: a glowing orange rim around a dark interior (see D). Mood, palette, pool and toasts are the closest match in the shard. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **4.5** | 1. **Hand and whip (x 0.55–1, y 0.5–0.85).** The mockup's glove is solid worn leather, lit from the front: highlights on the knuckles and stitching, dark creases, and a tight plaited whip with a braided handle and knot. The game's fist and whip look like an X-ray: a bright jagged orange rim (stair-stepped edges) around a dark, translucent-looking interior, ending in a ball knob. 2. **Dune form and ground (x 0–1, y 0.5–0.85).** The mockup is long, low, horizontal ridge bands receding in values to a flat horizon. The game is two big rounded domes with a lit rim, and the near ground is near-black with a concentric moiré "fingerprint" from the ripple pattern. 3. **Sky and FX (y 0.2–0.6).** The mockup's blue hour is a soft pink-violet afterglow with stars and no orange. The game keeps a saturated orange band and pink streaks. The two far lit waymarks throw their embers as long glittering arcs like comets (x 0.05–0.12 and 0.75–0.98, y 0.47–0.58), and hard-edged black shapes hang over the dune at x 0.15–0.25, y 0.53 (also in `clip.mp4` near each waymark). The tower is mid-right (x 0.68) under its chip, not at the mockup's right edge (x 0.86). |

**Seat score, Signal Dunes: (4.5 + 5.0 + 5.5 + 6.0 + 4.5) / 5 = 5.1**

## Findings, ranked by score gained

1. **Light the spawn the way the mockups are lit: against the glow, not from behind the player** (dusk-fire, A, D;
   y 0.38–0.85). Evidence: the key is `KEY.dir (-0.93, 0.2, 0.3)` (`look/render.ts:17`), behind-left of the spawn
   view, per a style-bible rule ("never in the player's face", render.ts:9–11). Meanwhile the sky's afterglow is in
   front, `SUN_GLOW (-0.3, -0.07, -0.95)` (`look/sky.ts:7`). So the dune faces toward the camera are lit while the
   bright sky says they should be backlit. In the mockups the camera-facing faces fall into cool shade, the crests carry
   lit rims, and the ripples catch grazing light. Fix: put the key low on the glow's side (front-left of the spawn view)
   so the shadow faces turn toward the camera, as dusk-fire and A show, and keep the shade floor so it never goes black.
   The ledger's mockups outrank an older style-bible note. If the builder thinks "never in the player's face" must
   stand, that goes to Jake as a pick, not a silent keep. **Do this with the dune form:** the spawn view still shows one
   rounded dome where A has three overlapping knife-edge crests and dusk-fire a near saddle under the tower dune.
   Sharpen the crest lines and break the spawn dome into those crests in the terrain (re-bake), not by moving the
   camera.
2. **Make the viewmodel solid leather, not an X-ray** (all five, worst in C and D; x 0.55–1, y 0.5–0.85). The dusk rim
   (`lastLightAll` on the whip model, `plugin.ts:79`) plus the self-fill makes the rim brighter than the body at the
   blue hour, and the rim's edge is stair-stepped. Fix: cap the rim below the body's diffuse on the viewmodel; light the
   fist from the front so the knuckles and stitching carry the highlights and the creases stay dark (D). Give the whip a
   readable plait (strand normals and specular, not a mottled albedo), a braided handle with a knot in place of the ball
   knob, and lower, tighter coils (A, D). Check the rim pass for the aliasing. This one change lifts all five frames.
3. **Paint the sky the mockups paint** (dusk-fire, A, D; y 0.05–0.6). Fix: replace the ruled streaks with a few broad
   cloud banks lit from below (orange and pink in A; grey-brown in dusk-fire), keep the orange up into the middle of the
   sky in A and dusk-fire, and mute the navy zenith toward slate violet. At the blue hour (D) fade the orange band into
   a pink-violet afterglow. Give the far range an aerial gradient (paler and bluer at its foot) and remove the white
   strips under it (clip). All of this is at infinity, so it is allowed.
4. **The waymark fire: a plume you can see, flames that lick, embers that stay embers** (C, D). Fix: the smoke as a
   wide billowing plume, lighter grey-brown and lit by the fire from below so it reads against a violet sky (C's
   plume is several bowls wide at the top). Ragged orange tongues around visible burning logs in place of the pale
   gas-flame core. Embers that fade or shrink with distance, so a lit waymark 100 m off is a glow, not a comet streak
   (D). Weather the brazier to soot-dark iron and the plinth to rough fieldstone.
5. **Fix the black tent, then frame the wagon on the horizon** (B). Fix: the tent in a shaded, textured dark canvas
   with an end panel (`world/places.ts:121–125`), and the pack animal at its side that the mockup shows. Then fix the
   wagon's backdrop: in the mockup it stands against the afterglow on the horizon, not against a lit dune face. Correct
   it in the layout (the dune behind the caravan, or the caravan on its rise), and darken the sand at the logbook step's
   dusk (`duskOf` 0.15) so the ground isn't daylight orange under stars. Texture the crates and barrel; close the
   floating canvas tatters; brighten the lantern.
6. **Mock-C: the next waymark, not the tower** (C; x 0.8–0.95, y 0.43–0.5). The README says the re-aim was made because
   "the next waymark is behind a dune, so the tower is in view instead". That swaps a mockup subject for one it doesn't
   have and fills the upper left with tower, chip and toasts. Fix: in the layout, give at least one waymark a sightline
   to the next one (good wayfinding too), and aim mock-C there.
7. **D's ground and forms** (D; y 0.5–0.85). Fix: fade the ripple normal out with distance (or by mip) so the near-black
   sand has no moiré; shape the dune field toward the tower from the east crest as long, low, transverse ridges, as
   the mockup shows, rather than two domes. Identify the black shapes over the dune near the waymarks (x 0.15–0.25,
   y 0.53; clip): creatures or smoke cards gone black at dusk. Give them the dusk rim or hide them.
8. **The trail markers on the spawn crest** (nit; dusk-fire, A; x 0.2–0.75, y 0.55–0.75). Every mockup shows unbroken
   sand there. Keep the trails, but start the posts past the crest, out of the first view, the way the cairns already
   keep "the spawn view clear" (`world/dressing.ts:258`).
9. **The dusk-fire mockup's lit tower lamp and ray** (nit). The mockup's lantern burns at step 1 and a dune ray glides
   over the tower. If the tower has a beacon lamp before the signal fire, light it; the ray's home is the spawn crests
   (`species/duneRay.ts`), so a capture timed to its glide can catch it in frame. Don't freeze or paste it.

## No-shortcut check (ledger 5)

- **Staged state: reachable.** `stage()` (`plugin.ts:48–60`) now runs the player's own path: Sefa's flag, the logbook
  interact, the well's pull and jar, then oil and light per waymark. `logbook` (B) and `waymarks-lit` (C, D) are states
  play reaches. The dusk **snaps** to the staged step (`setDusk(…, true)`), while play eases there at 0.02 per second
  (`look/dusk.ts`). D's blue hour (`duskOf` 0.86) is reached about 20 s after the third waymark is lit, so the look
  exists in play; it is not a staging-only look.
- **Views:** `mock-C-waymark` is a re-aim that drops a mockup subject (finding 6). It isn't a dodge of a weak area, but
  it doesn't match the mockup's camera better either, which is what ledger 5 asks of a re-aim. `mock-D-hands` moved off
  the spawn to the east crest: that matches the mockup better (empty layered dunes, the tower small at the right) and is
  allowed. `mock-dusk-fire` yaw −10 brings the tower to x 0.31 against the mockup's 0.38: allowed. `mock-B-logbook`
  settles 11 s to fade the toasts; the mockup has none, so that's fine.
- **Painted stand-ins:** none in the playable area. The wagon, props, tent, braziers, tower and dunes are geometry. The
  firelight pool is a ground-draped quad and the brazier glow a material term (`fireFx.ts`, `meshes.ts:49`). They are
  light effects on every waymark (`duneHd('brazier-hd')` per waymark, `places.ts:294`), not dressing for one view. The
  far range and sky are at infinity.
- **Device and HUD:** 390×844 phone and touch, stored at 780 wide (ledger 5), baseline HUD in every frame, 0 page
  errors. No breach found.

SCORE signal-dunes: 5.1
