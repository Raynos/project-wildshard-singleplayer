# Driftwood Isle: round 4, remaster mockup loop (spawn cove)

Round 1 of the mockup loop for `docs/plans/DRIFTWOOD-REMASTER.md`. We took one small area from 9 angles in the
real game (`capture-*`). Codex image_gen then remastered each capture into a target frame (`mockup-*`), using
`art/driftwood-fp-spawn.png`, `art/driftwood-spawn-B-faceted.png` and `art/hero-driftwood-isle-landscape.png`
as style anchors. The gap lists below say what the game has to gain to match those targets.

- `sheet-ingame-3x3.jpg`: the 9 in-game captures. `sheet-mockup-3x3.jpg`: the 9 targets, in the same cell order.
  Row 1: FP front / left / right. Row 2: FP back / TOP / DIAG front. Row 3: DIAG left / right / back.
- Captured 2026-09-23 on the local dev server (HEAD `fdc2db8` + the shared working tree), time of day frozen at
  midday (`tod=0.4167`, the sun 62° up in the south).
- No mockup was re-rolled. #1 FP FRONT came back from image_gen at 2:3 with the capture stretched sideways
  (the minimap had become an oval). It was resized back to the capture's 390:844 aspect, and it now lines up
  with the capture almost pixel for pixel. #2 and #3 are native 2:3 recompositions of the same frame (the HUD
  keeps its shapes). #4 came back at the phone aspect.

## The area and the anchor P

**The spawn cove** is where the south pier's path lands on the crescent beach. From here the sand path and its
rope fences run NW to the plank stair (`Trailside` steps `(-30,-140)→(-30,-106)`), which climbs the hut plateau
(`PLATEAU` centre `(-24,-62)`, hut `(-22,-64)`).

**P = (x 0, z −154), ground y 0.93.** This is the first dry sand straight north of the pier, just above the
water line (sea level `OCEAN.level` = 0.8; the terrain crosses it at z ≈ −158 on x = 0).

The pier itself does not reach the beach. Its deck runs z −250 → −190 (`PIER`), so it **ends ~33 m offshore**.
The path (`PATHS[0]` from `(0,-188)`), its two rope fences (`Trailside` from `(-2,-184)`) and the landing
signpost (`(5,-184)`) all start in 0.9 m of water. All 9 frames show this, and the mockups keep it because
the brief said to keep every structure where it is. It is a layout call for the model/level owner. See the note
after the TOP-10.

Compass: the HUD reads **+x as W and −x as E** (+z = N). The labels below follow the HUD. Beware that the
chunk def's comments call +x "east" (Wreck Cove at x ≈ +149).

## Re-shooting identical frames

Every shot uses the `mockloop` agent-browser session and
`http://localhost:5173/?chunk=driftwood-isle&nolock=1&skipintro=1&tod=0.4167&clock=1000000`.
`clock=1000000` makes a day last ~11 days, so the light does not move between shots. Wait for `window.__world`
before shooting. Always `agent-browser --session mockloop close` at the end.

**First-person (1–4):** viewport **390×844**, add `&tier=phone&touch`, then
`__world.player.spawn(0, -154, YAW); __world.player.pitch = -0.06`. The URL form `&x=0&z=-154&yaw=YAW&pitch=-0.06`
gives the same frame. The eye lands at **(0, 2.608, −154)**. Vertical fov is **93.81°** (the game's portrait
fov; ~52° horizontal). Yaw 0 looks −z. Wait ~3.5 s after placing, then screenshot.

**God mode (5–9):** viewport **1600×900**, add `&explore=world`. The Explore camera has a vertical fov of
**72°**. The `&cam=x,y,z,yaw,pitch` deep link does **not** work: `Explore.open` places the camera, then
`setMode('world')` sees `prev === 'hub'` and moves it back to HOME (`src/explore/Explore.ts:232`). Instead,
paste this helper with `eval`. It freezes FreeCam's per-frame `setFromEuler` and hides the Explore chrome:

```js
window.__setcam = (px, py, pz, lx, ly, lz, upz) => {
  const c = window.__world.game.camera;
  if (!c.quaternion.__patched) { c.quaternion.setFromEuler = function () { return this; }; c.quaternion.__patched = true; }
  c.position.set(px, py, pz);
  if (upz !== undefined) c.up.set(0, 0, upz); else c.up.set(0, 1, 0);
  c.lookAt(lx, ly, lz); c.up.set(0, 1, 0);
  const x = document.querySelector('.ws-x'); if (x) x.style.display = 'none';
};
```

| # | Shot | Camera position | Look at / heading | FOV (vertical) | Viewport |
|---|---|---|---|---|---|
| 1 | FP FRONT | (0, 2.61, −154) | yaw **2.62** (HUD 030° N: NNW, toward the stair), pitch −0.06; dir (−0.497, −0.060, 0.865) | 93.8° | 390×844 phone HUD |
| 2 | FP LEFT | same | yaw **4.7124** (HUD 270° W, looks +x along the beach) | 93.8° | 390×844 |
| 3 | FP RIGHT | same | yaw **1.5708** (HUD 090° E, looks −x along the beach) | 93.8° | 390×844 |
| 4 | FP BACK | same | yaw **0** (HUD 180° S, down the path to the pier end and the sea) | 93.8° | 390×844 |
| 5 | TOP | (−10, 60, −162) | straight down at (−10, 0, −162.001), `upz = 1` so north is up and W (+x) is left | 72° | 1600×900, no HUD |
| 6 | DIAG FRONT | (0, 34, −212) | (−8, 1, −162), ~33° down, looking N | 72° | 1600×900 |
| 7 | DIAG LEFT | (40, 36, −154) (the W side) | P (0, 0.93, −154), ~41° down, looking E | 72° | 1600×900 |
| 8 | DIAG RIGHT | (−40, 36, −154) (the E side) | P, ~41° down, looking W | 72° | 1600×900 |
| 9 | DIAG BACK | (0, 36, −114) | P, ~41° down, looking S over the beach to the pier | 72° | 1600×900 |

Shot 6 sits 23 m further south than the brief's "35 m up over P", so that the pier end, the beach and the
stair all fit in one frame.

## Gap lists (what the mockup has that the game lacks)

Tracks: **L** look (light, grade, sky, terrain shading), **W** water, **M** models, **M4** ground cover.

**1 FP FRONT**
- Ground cover (M4): the open sand has a shell, pebble, starfish or grass tuft every ~1–2 m, a bleached
  driftwood log every ~8 m, and a dense fern + hibiscus + yellow-flower fringe along the whole sand→grass edge.
  In the game the sand is bare and has ~4 tufts.
- Crag (L): crisp faceted grey rock with a hard grass line and bushes on the ledges. The game has a soft
  green-on-lavender blend, a grey-green haze band and a pale diagonal light-streak artifact across the crag face.
- Palms (M): 2× fronds per crown, coconut clusters, and 3–4 more palms along the crag foot.
- Sand (L): warm golden sand with facet micro-relief. The game's sand is flat grey-beige.
- Sky (L): more saturated blue, bigger faceted cumulus behind the crag, 2 gulls.

**2 FP LEFT**
- Water (W): saturated turquoise shallows → deep blue with visible wave facets and glints. The game has pale
  mint water with no depth read.
- Foam (W): a crisp white 2–3-line swash along the curving shore. The game has a single soft white fringe.
- Ground cover (M4): a driftwood log + beach-grass clumps + shells/starfish/pebbles in the foreground
  (~1 per m²), and yellow/red flowers under the right-edge palms.
- Palms (M): the right-edge palms get full crowns and hang into frame.
- Sea stacks (M): taller faceted spires with green tops (the game's are low grey humps).

**3 FP RIGHT**
- Palms (M): a dense palm grove on the left, 2× as many trunks with fuller crowns, including a foreground palm
  that frames the shot.
- Posts (M): rope-fence posts become thick weathered pilings, each wrapped with rope.
- Foam (W): foam rings around every post and the boulder at the waterline, and crisp lace at the shore.
- Ground cover (M4): ferns + red hibiscus under the palms, shells, pebbles and a driftwood log on the sand.
- Water colour (W): vivid turquoise shallows with a deep-blue band before the sea stacks.

**4 FP BACK**
- Exposure (L): looking toward the midday sun, the near sand and lagoon **blow out to flat white**, and the pier
  end reads as a silhouette. The mockup keeps warm sand, a readable foam edge and clear turquoise water.
- Water (W): clear shallows over sand grading to deep blue at the horizon, and the posts stand in foam rings.
- Ground cover (M4): beach grass, flowers and shells frame the foreground on both sides.
- Pier (M): the pier end gets chunkier posts, rope and a flag, and reads clearly at 35 m.
- Sky (L): large faceted cumulus and gulls. The game's sky is paler and hazier toward the sun.

**5 TOP**
- Foam (W): the game's 3–8 m white sawtooth sheet becomes a thin (0.3–1 m) **double lace line** that follows
  the shore, plus a swash tint band on the wet sand.
- Water (W): faceted triangulated turquoise with sparkles. The game has a milky mint plane with a yellow
  caustic net, and a **hard white specular blob** beside the pier.
- Sand (L): even warm sand. The game has large dark muddy cloud-shadow blotches over the whole beach.
- Ground cover (M4): driftwood logs, starfish, shells and grass tufts scattered every ~2 m; ferns and hibiscus
  clumps between the palms at the top.
- Posts (M): the fence posts read as a rope line with posts, where the game has faint dots.

**6 DIAG FRONT**
- Vegetation density (M4 + M): the grass plateau and the back beach are carpeted with bushes, ferns, flowers and
  ~2× the palms. The game has sparse palms on flat bare green.
- Water (W): saturated turquoise lagoon, lacy broken foam across the shallows and a crisp shore line (the game
  has a pale mint sheet and a sawtooth foam band).
- Sand (L): warm sand without the dark cloud-shadow smears. Driftwood logs and rocks sit along the dune line.
- Distance (L): a clear, saturated horizon and headland. The game washes to grey-blue haze past ~150 m.
- Crag (L/M): faceted cliff faces with vegetation on top and on the ledges.

**7 DIAG LEFT**
- Deep-water seam (W): the game has a **hard straight-edged dark-blue wedge** across the top. The mockup has a
  smooth turquoise→cobalt depth gradient with whitecaps and glints.
- Foam (W): a thin broken swash line along the whole curving beach, not a wide white fringe.
- Ground cover (M4): hibiscus, ferns and bushes fill the grass and the back beach, and shells and logs sit on
  the sand.
- Palms (M): denser grove along the back beach, fuller crowns.
- Crag (L): crisp faceted rock with a vegetated rim.

**8 DIAG RIGHT**
- Deep-water seam (W): the same hard dark wedge at the top left becomes a soft depth gradient.
- Water (W): faceted turquoise with visible sand and rocks under the shallows, and foam rings on the three
  lagoon boulders.
- Ground cover (M4): the grass right of the beach is dense with ferns, flowers and bushes. The stair foot is
  framed by plants.
- Posts/rope (M): the fence reads as posts plus a sagging rope.
- Sand (L): no cloud-shadow blotches; warm tone.

**9 DIAG BACK**
- Ground cover (M4): the foreground dune (the stair foot) is a carpet of grass tufts, ferns, hibiscus and
  pebbles. The game has bare sand with 3 bushes.
- Water/seam (W): the game's hard straight turquoise/dark-blue band becomes a soft gradient with glinting whitecaps.
- Foam (W): a crisp lace swash along the whole beach, not the sawtooth sheet.
- Palms (M): full crowns, curved segmented trunks, coconuts.
- Driftwood (M4): 3–4 bleached logs along the dune line.

## TOP-10 gaps, merged and ranked by visual impact

1. **Shallows colour + facets (W):** replace the milky mint plane and its yellow caustic net with saturated
   turquoise water. It should show visible triangle wave facets and sun glints, and fade to deep cobalt with
   depth. Every one of the 9 frames shows this gap.
2. **Beach ground cover (M4):** shells, starfish and pebbles every ~1–2 m. A bleached driftwood log every ~8–10 m
   along the dune line. Beach-grass tufts on the dune crest. This is the single largest area of the frames (all 9).
3. **Foam (W):** replace the 3–8 m white sawtooth sheet with 2–3 thin (0.3–1 m) broken lace lines along the
   shore and a wet-sand swash band. Add foam rings around every post, boulder and pier piling (frames 2–9).
4. **Vegetation fringe (M4):** dense ferns, red hibiscus, yellow flowers and bushes along the sand→grass edge,
   under every palm and over the plateau. There should be no bare green plane (frames 1, 3, 6–9).
5. **Deep-water seam (W):** replace the hard straight-edged dark-blue wedge/band with a smooth depth gradient
   plus whitecaps (frames 7, 8, 9, and the far sea in 6).
6. **Sand tone + cloud shadows (L):** make the sand warm and golden with facet micro-relief. Remove the big
   dark muddy cloud-shadow blotches on the beach (smaller or fainter `cloudShadow` on sand) (frames 1, 5–9).
7. **Palms (M):** 2× fronds per crown, coconut clusters, segmented curved trunks, and ~2× palm density along
   the back beach and the crag foot (frames 1, 3, 6–9).
8. **Into-the-sun blowout (L):** at midday, looking south, the sand and lagoon clip to flat white (frame 4), and
   the top-down view has a hard specular blob (frame 5). Clamp the water specular and the sand's
   highlight/bloom so both stay readable.
9. **Crag + haze (L):** crisp faceted cliff faces with a hard grass line and plants on the ledges. Remove the
   grey-green haze band and the pale light-streak artifact on the crag (frame 1). Keep the distance clear and
   saturated instead of hazing to grey-blue past ~150 m (frame 6).
10. **Posts, pier and sea stacks (M):** thick weathered pilings wrapped in rope, a sagging rope between the
    fence posts, and a chunkier pier end. The sea stacks become tall faceted spires with green tops. Add a few
    gulls (frames 3, 4, 7, 8).

**Not a look gap, but it shows in all 9 frames:** the pier ends ~33 m short of the beach. Its path, both rope
fences and the landing signpost start in the water. Either extend the pier deck to z ≈ −160 or move the path,
fence and sign starts onto the sand (level/model owner's call).
