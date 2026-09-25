# Nalati camp — 9-angle mockup loop, round 1 (2026-09-23)

The user's method: one small area, 9 fixed cameras in the real game (4 first-person + 5 free-camera from above),
one codex remaster per capture as the target, two 3×3 contact sheets; the build agents then loop the engine until
each capture matches its mockup.

- **In-game sheet:** `sheet-ingame-3x3.jpg` · **Target sheet:** `sheet-mockup-3x3.jpg`
- Per angle: `capture-<n>-<id>.jpg` (engine) and `mockup-<n>-<id>.jpg` (codex target).
- Camera poses in machine form: `poses.json` (for the look-director's harness).
- Engine state: a **clean export of HEAD `9308588`** served on a private vite (:5189), so nobody's uncommitted WIP is
  in it (the shared :5188 tree did not boot at capture time). All 9 shots come from **one page load at the phone tier**
  (`tier=phone`): the FP shots at 390×844 @1.5 with the touch HUD, then the same page resized to 1600×900 @1 with the
  HUD hidden for the free-camera shots.

## The area and anchor P

The spring nomad camp in the Kunes valley: CAMP yard centre (95, 205), ground y ≈ −8; six yurts in a ring of r ≈ 13.5
round the yard, opening east; hitching rail (78, 208) running N–S with two saddled horses on its road side
(x ≈ 76); eagle perch (86, 206.5); corral (122, 214) r 9; the Kunes ≈ 45 m south (z ≈ 160), the bridge at x 0;
the escarpment + spruce gullies beyond the river; the slab's north edge at z 250 (45 m behind the camp).

**Anchor P = (68, 204.3)** on the camp spur track (`CAMP_SPUR`, `src/chunks/nalati-grasslands.ts`), ≈ 10 m east of the
rail where the track enters the yard. FP-front looks along the track into the camp (heading 234°, WSW), the
master-mockup idea (track leading in, yurts ahead, spruce / escarpment / peaks beyond). The sun (def start hour 16.22,
WSW) is in the upper FP-front frame.

Coordinates: engine metres, **+z north, +x WEST** (−x east). `yaw` 0 faces −z (south), +π/2 faces east; `pitch` in
radians (+ up). Camera rotation = `(pitch, yaw, 0, 'YXZ')`.

## The 9 cameras

URL (all nine, one load): `http://127.0.0.1:5188/?chunk=nalati-grasslands&nolock=1&skipintro=1&weather=clear&clock=0&perf=0&tier=phone&touch&x=68&z=204.3&yaw=-0.95&pitch=-0.1`
(`clock=0` holds the def's own start hour 16.22 = golden afternoon; `weather=clear`).

| n | id | kind | viewport | camera position (x, y, z) | yaw | pitch | heading | vertical fov | look target |
|---|---|---|---|---|---|---|---|---|---|
| 1 | fp-front | FP | 390×844 @1.5 | (68, −6.17, 204.3) eye | −0.95 | −0.10 | 234° W | 93.8° (bow Hor+) | along the track into the yard |
| 2 | fp-left | FP | 390×844 @1.5 | same | 0.6208 | −0.10 | 144° S | 93.8° | the river + escarpment |
| 3 | fp-right | FP | 390×844 @1.5 | same | −2.5208 | −0.10 | 324° N | 93.8° | rail horse, yard, north meadow |
| 4 | fp-back | FP | 390×844 @1.5 | same | 2.1916 | −0.10 | 054° E | 93.8° | back up the track |
| 5 | top | free | 1600×900 @1 | (90, 62, 205) = 70 m up | −0.95 | −1.5703 | image-up = 234° | 72° | straight down on (90, −8, 205) |
| 6 | diag-front | free | 1600×900 @1 | (57.46, 32, 228.27) | −0.95 | −0.7854 | 234° | 72° | (90, −8, 205) |
| 7 | diag-left | free | 1600×900 @1 | (113.27, 32, 237.54) | 0.6208 | −0.7854 | 144° | 72° | (90, −8, 205) |
| 8 | diag-right | free | 1600×900 @1 | (66.73, 32, 172.46) | −2.5208 | −0.7854 | 324° | 72° | (90, −8, 205) |
| 9 | diag-back | free | 1600×900 @1 | (122.54, 32, 181.73) | 2.1916 | −0.7854 | 054° | 72° | (90, −8, 205) |

The four diagonals orbit the target T = (90, −8, 205) at 40 m up / 40 m out, 45° down, looking the FP front / left /
right / back way. Measured at capture (phone tier): 97–112 draw calls, 1.31–1.77 M triangles.

### How to re-shoot identical frames (no game source needed)

- FP: `__world.player.spawn(x, z, yaw); __world.player.pitch = pitch;` then settle ~7 s.
- Free camera: keep the player spawned at P (streaming stays centred on the camp) and register one last updater. It
  runs after `player.update` and before the composer, so the frame renders from the free camera. The camera-parented
  viewmodels are hidden while a pose is set and restored after:

```js
window.__cam9 = { pose: null, saved: null };
__world.game.onUpdate(() => {
  const s = window.__cam9, p = s.pose, cam = __world.game.camera;
  if (!p) { if (s.saved) { cam.children.forEach((c, i) => { c.visible = s.saved[i]; }); s.saved = null; } return; }
  if (!s.saved) s.saved = cam.children.map((c) => c.visible);
  cam.position.set(p.x, p.y, p.z); cam.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
  for (const c of cam.children) c.visible = false;
});
window.__weather.clock.paused = true;
// then: __cam9.pose = { x: 90, y: 62, z: 205, yaw: -0.95, pitch: -1.5703 } … and hide the HUD:
// document.head.insertAdjacentHTML('beforeend', '<style>#hud,#hud *{display:none!important}</style>')
```

## Gap list per angle (engine → mockup)

**1 FP front**
- Track: the pale flat "crazy-paving" stone plates read as a patio. Target: sun-baked dirt with two ruts, pebbles, a grassy crown and soft edges into the grass (PA dirt texture, L2).
- Grass: short sparse tufts on flat green. Target: knee-high dense blades + lupin / buttercup / edelweiss drifts right up to the track edge (L3).
- Sky: the sun is a white blowout that washes out the top half. Target: a warm golden glow, a graded sky, backlit cumulus with bright rims (L1).
- Horizon: small blue cones. Target: a massive jagged snow range across the whole back, over a spruce belt with depth (PA backdrop, L2).
- River: a flat bright-cyan ribbon floating across the middle distance. Target: turquoise braided channels, sparkle, gravel bars (L2).
- Props (pots, barrel, rug stack) are flat colour. Target: painted clay, wood staves and woven rug patterns (L4 / L6).

**2 FP left**
- River: the same flat cyan band, with no banks, gravel or foam. Target: a braided river, wet stones, whitewater on the riffles (L2).
- Escarpment slope: flat green with a handful of cones. Target: spruce-covered spurs with rock outcrops and depth haze, and snow peaks over the top (L2, PA backdrop).
- A translucent grey pyramid by the river bank (a rock or tent fading wrong?). It should be an opaque mossy boulder (L4 check).
- Near field: bare green ground plus flat stone plates. Target: a flowered meadow, shrubs and boulders along the river path (L3 / L4).
- Fence and bridge wood are untextured. Target: weathered grey poles with painted grain (L6 / PA).

**3 FP right**
- Horse: a dark silhouette with no mane or tail motion and a flat saddle. Target: a flowing mane and tail, an ornamented saddle blanket, rim-lit coat (L5).
- Yard: a few floating logs and crates on plain green. Target: a trodden earth yard with firewood, a trough, churns and saddles on a rack (L4 / L6).
- North horizon: an empty flat line with thin low hills. Target: a far valley and ranges in aerial haze (PA backdrop, L1 haze).
- Stove smoke is a column of dotted round puffs. Target: a soft, wind-bent, fading plume (L6 / L1).
- The sky is flat saturated blue with small cloud blobs. Target: sculpted cumulus with warm tops and blue-violet undersides (L1).

**4 FP back**
- Slope: a flat, even green rise. Target: grass texture, rocks, lupin drifts and a worn fence line along the ridge (L3 / L4).
- The boundary markers (thin cyan pole and line in the sky) are kept faint in the target. They are fine as they are.
- Horizon: nothing beyond the ridge. Target: distant ranges and the Avral hills in haze (PA backdrop).
- The yellow flower band is a flat stripe. Target: individual flower heads in drifts mixed with lupin and daisies (L3).
- Track: same as FP front (dirt, not plates).

**5 TOP**
- Ground from 70 m is one flat green plus cloud shadows. Target: a painted meadow with ochre/green variation, lupin and yellow flower patches, and grass texture visible from altitude (PA meadow texture, L2).
- Slab edge: a glass-like translucent panel that reflects the sky. Target: a rocky grassy lip of the floating shard falling away to a golden cloud sea (L2 / L1).
- Yard: no worn ground. Target: a trodden earth ring and paths between the yurts, with hitched horses and clutter visible from above (L6 / L2).
- River gravel bars are flat lavender. Target: textured pebble bars with dry and wet bands and foam lines (L2 / PA).
- Spruce: a few black cones with hard shadows. Target: more trees in clumps, painted needle mass (L2).

**6 DIAG front**
- The horizon ring seen from 40 m up is a dark green wall with a cyan corner post. Target: the shard edge, the cloud sea, then hazy ranges and the planet (L2 horizon/backdrop, L1).
- The translucent veil panel on the right edge. Same fix as TOP.
- Meadow is flat and textureless. Target: grass, flowers and scattered rocks everywhere (L3 / PA).
- The far-bank spruce band is a dark comb. Target: a layered forest with lit crowns (L2).
- The road verge fences are thin lines. Target: readable weathered fences (L6).

**7 DIAG left**
- Meadow: flat green. Target: flowered grass texture from altitude (PA / L3).
- The far slope is flat green with one black spruce block. Target: grassy spurs with spruce streaks and rock (L2).
- Tall spruces are black sheets that look like paper cut-outs from above. Target: volumetric painted spruce (L2).
- Corral: fine as it is. Target adds a trodden floor inside it (L6).
- Bridge + track: okay. Target adds dirt ruts and a stone ford bank (L2 / PA).

**8 DIAG right**
- The horizon ring is a wall of green streaks, with the veil reflecting clouds. Target: the shard lip, the cloud sea and ranges (L2 / L1).
- The river in the foreground is flat. Target: whitewater and a wet cobble bank (L2).
- Meadow and slope are flat. Target: grass texture and flower drifts (L3 / PA).
- Spruce clumps are black (see 7).
- Horses at the rail are tiny dark specks. Target: readable horses and the rail (L5 / L6).

**9 DIAG back**
- The horizon wall, veil and corner post (see 6 / 8).
- River gravel is flat lavender. Target: pebble texture and dry vegetation on the bars (L2 / PA).
- Meadow is flat green. Target: flowers and grass (L3 / PA).
- Yurt tops look plain from above. Target: crown ring, roof ribs and felt folds visible (L6).
- Track and fence: okay. Target adds ruts and wear (L2).

## TOP-10 gaps, ranked by visual impact

| # | gap | owner |
|---|---|---|
| 1 | **Grass carpet**: knee-high dense blades with lupin / buttercup / edelweiss drifts everywhere off the track and the yard (all 9 angles are flat green today) | L3 |
| 2 | **Painted ground textures**: a meadow albedo with ochre/green variation and flower patches that holds up from 40–70 m; the dirt track with ruts instead of pale flat stone plates | PA (+ L2 adoption) |
| 3 | **Sky and light grade**: no white sun blowout; a golden graded sky, warm key / blue-violet shade, strong aerial haze on distance | L1 |
| 4 | **The snow range**: a massive jagged painted range filling the horizon behind the escarpment (FP front / left, diag front) | PA backdrop + L2 |
| 5 | **The Kunes**: braided turquoise channels with foam and sparkle, textured gravel bars, wet banks; not a flat cyan ribbon in the FP views | L2 |
| 6 | **The shard edge and horizon from above**: the translucent veil panel and the green-streak horizon walls. Paint a grassy rock lip, a golden cloud sea below and the far ranges (seen from any elevated spot: Eagle Rock, the rim, the diagonals) | L2 (+ L1 haze) |
| 7 | **Yurts**: lattice base, felt folds, ropes, 2 ornament bands, crown ring + stove pipe; painted felt texture; soft wind-bent smoke instead of dotted puffs | L6 (+ PA felt) |
| 8 | **Camp yard dressing**: a trodden earth yard, rugs on lines, firewood stacks, a tripod cauldron, saddles, churns; painted-textured props | L4 / L6 |
| 9 | **Spruce**: volumetric painted spruce (no black paper cones from above), a denser layered forest on the far bank and slope | L2 (+ PA bark/needles) |
| 10 | **Horses and near detail**: flowing mane and tail, ornamented saddle blanket, rim light; mossy boulders and shrubs along the river | L5 / L4 |

## Mockup notes

- All 9 mockups were generated in one parallel codex batch (`gpt-6-sol`, refs = the capture +
  `round-1/1-art-style/style-B-painterly.jpg`, `round-1/5-concept-art/concept-1-yurt-camp.jpg`,
  `round-2/2-creatures/taming-3-bonded.jpg`).
- **Re-rolled once (parallel batch of 5): 2, 3, 4, 8, 9.** Round one had added the gas giant (and in 9 a low sun) in
  views that face away from both: FP-left SSE, FP-right NW, FP-back NE, diag-right NW, diag-back ENE. In the game the
  planet and the sun sit in the WSW–SW, so the nine targets contradicted each other. Round one's FP-left also invented
  yurts and an eagle perch across the river. The re-roll prompts add a SKY RULE (no planet / moon / sun, the light
  direction) and a "no new structures" line.
- Kept from round one: 1, 5, 6, 7. They keep the camera and landmarks; 1 and 6 show the planet where the engine has it.
- Leftover liberties in the targets (judge the look, not these): 1 puts a short rail with horses in front of the left
  yurt; 2 still has two tiny yurts far off by the bridge; 3 adds an eagle on a post and saddles/rugs in the yard, and
  a river valley on the NW horizon (the engine's horizon there is the valley opening west, so this one is plausible).
- The god-view targets treat the shard edge as a rocky lip over a cloud sea. That is a design proposal (the floating
  slab); the engine's veil / horizon ring is not built for elevated views today.
