# Mockup council — round 5, Signal Dunes, seat A

Lens: game art director comparing the game frames with the frozen mockups. Only Signal Dunes is scored.

Read COUNCIL.md, ledger.md, brief.md, scores.md, all three round-1 seats, all three round-2 Signal Dunes seats,
and all three round-3/4 Signal Dunes seats. Reviewed the Signal Dunes section of the round-5 README, the five supplied
comparison sheets, the five original mockups and matching game JPEGs at their stored resolution, first-frame, all four
hero views, both aerials, and the orbit clip sampled once per second. Source checks use captured commit
`56c23085f67d1da77cda8362c9fe165fbd089ce1`, not the newer working tree. Evidence:
`progress/sunscar-dunes/20261003-0057-56c23085/`; recorded camera blob `d78968c7b3a011f4e320415406300cfe3f899fbb`.
Regions below are fractions of the portrait picture, x left to right and y top to bottom, excluding sheet titles.

**Signal Dunes scores 6.1/10, below 8.** The setting and principal structures are recognizable. Differences in terrain
composition, cloud structure, flame detail and weapon presentation remain obvious without searching. The shade floor,
late sky and wagon illumination are better supported by this capture, but scores judge the supplied pictures, not effort
or progress. The README's low-coil and fixed-thumb claims are not established by the rendered result.

## Signal Dunes (`sunscar-dunes`)

| Mockup → game view | Score | Biggest difference 1 | Biggest difference 2 | Biggest difference 3 |
|---|---:|---|---|---|
| `A-spawn-dusk-light.jpg` → `mock-A-spawn` | 6.0 | **Landscape, x 0–1 / y 0.35–0.70:** the target's diagonal foreground ridge overlaps a separate dark tower dune and successive crests. The game has one dominant rounded mound and a broad swale; the narrow golden diagonal crest, intervening shade and layered depth are absent. Sefa occupies the lower left where the mockup has uninterrupted sand; retain her normal quest role. | **Sky, x 0–1 / y 0.18–0.39:** irregular burnt-orange clouds with shaded interiors become pale cream slashes and long horizontal streaks against purple. The distant ranges are crisp lavender cut-outs rather than several hazy receding layers. | **Foreground, y 0.58–0.85:** the mockup's large low coils and grazing-lit irregular sand become a smaller upright oval beside an exposed fist, with regular ripple bands. Grain exists, but the target's fine relief and lit/shaded ridge structure do not. |
| `B-quest-logbook.jpg` → `mock-B-logbook` | 6.5 | **Wagon, x 0.28–0.61 / y 0.40–0.52:** the opening is now warm and the hoops are more readable, but the target's planked tailboard, ragged sagging cloth, spokes and luminous lantern become broad smooth panels and a small rectangular lamp. Warmth alone does not supply the target's material detail. | **Camp and plume, x 0.1–1 / y 0.18–0.53:** cargo remains dark blocks/lumps; the horse is end-on rather than side-on; the tent is a large flat panel at the right edge; smoke is a narrow pale ribbon rather than a widening turbulent plume. | **Lower half and sky:** the ground remains brighter and more regularly patterned than the target, and the upright small coil leaves much more empty sand. The sky is less blue and has a weaker starfield; normal tracker/pin placement also differs. No capture-only READ prompt or HUD restyle is justified. |
| `C-waymark-fire.jpg` → `mock-C-waymark` | 6.5 | **Fire, x 0.27–0.48 / y 0.30–0.50:** the logs no longer project through the bowl, but form a conspicuous triangular stack under a few smooth pale-yellow tongues. The mockup has broken orange combustion, bright irregular core, glowing logs, billowing smoke and a sweeping stream of ember streaks. The game's smoke is a soft vertical column and its sparks remain sparse dots. | **Brazier/light, x 0.20–0.50 / y 0.46–0.65:** a warm copper bowl, twisted shaft and clean regular brick courses replace soot-dark iron and rough fieldstone. The beige pool spreads broadly across the sand instead of concentrating saturated orange light around the base. | **Composition/foreground:** the bowl is left of the target position and stands against a high diagonal dune shoulder rather than sky above a low horizon. The next waymark is visible at right but largely hidden by terrain; a marker is clipped at left. The small upright coil differs from the mockup's large low coils. |
| `D-hands-whip.jpg` → `mock-D-hands` | 6.0 | **Landscape, x 0–1 / y 0.45–0.84:** long nearly horizontal dark ridge bands, thin lit rims and smooth near sand become rounded diagonal dunes covered in dense whorled ripples. The tower stands on a hump and its marker crosses the upper structure, rather than showing the full silhouette on a quiet horizon. | **Hero hand/coil, x 0.55–1 / y 0.60–0.84:** dark leather and cuff read, but crossing plaits, stitched panels and knuckle creases are much softer than the target. The game loop is narrower and farther inward. Its brighter patches do not resolve the target's strand-by-strand sheen. The lead's common low-coil ruling is accepted, but that hold is not delivered either. | **Sky/horizon, y 0.10–0.50:** the zenith is now blue-violet, yet the mid-sky is darker and less graduated than the mockup. A thin hot orange band and pale range replace the broader soft peach-pink afterglow; stars are finer and fainter. |
| `C-dusk-signal-fire.jpg` → `mock-dusk-fire` | 5.5 | **Focal subject, x 0.15–0.60 / y 0.17–0.43:** the tower crowns a real dune, but its fire is unlit and the large ray above it is absent. The tall empty upper cage differs from the target's occupied platform/bracing. The supplied initial quest state does not depict the target's burning-tower/ray conjunction. | **Landscape, x 0–1 / y 0.36–0.85:** the shade is readable rather than black, but the distinct near saddle and lit left shoulder remain missing. A rounded mound above a smooth depression and striped right shoulder replace the target's overlapping masses and textured grazing highlights. Sefa is clipped at left. | **Sky/weapon:** grey-brown cloud banks in an amber atmosphere become pale angular clouds across a violet sky with ruled streaks. The target's low diagonal plaited loop becomes the small upright double loop; the old mockup's weapon HUD differs from the required baseline controls. |

**Seat score: (6.0 + 6.5 + 6.5 + 6.0 + 5.5) / 5 = 6.1.**

## Rec. 709 measurements

Brightness is `Y = 0.2126 R + 0.7152 G + 0.0722 B` on the decoded JPEG's 0–255 RGB values, as the brief specifies.
These are displayed-image luminance comparisons, not linear-light radiometry. Original mockups were resized to
780×1688, matching the stored game frames. No maximum-channel or red-channel threshold is used.

The ground mean uses the earlier seats' box `(40,1050)–(540,1300)`. Tonal spread is p95 minus p5 over
`(50,880)–(390,1350)`, clear of the weapon; for A only, the same `(80,900)–(245,1170)` rectangle is excluded from
both pictures to avoid Sefa. Masks/boxes differ from the builder's unspecified ground-band selection, so these test
the direction and remaining gap, not exact reproduction of its spread numbers. Broad boxes measure scene structure,
not one sand material.

| View | Ground RGB mean, mockup / game | Ground Y mean, mockup / game | Lower-left p5–p95 Y, mockup / game | Spread, mockup / game / round 4 |
|---|---|---|---|---|
| A | 92.4,52.9,36.4 / 110.9,63.3,37.6 | 60.1 / 71.6 | 18.4–110.1 / 46.5–94.7 | 91.7 / 48.1 / 37.2 |
| B | 59.2,31.9,26.2 / 71.6,42.9,36.1 | 37.3 / 48.5 | 16.1–51.9 / 32.8–84.5 | 35.8 / 51.7 / 51.4 |
| C | 63.0,31.2,22.7 / 77.6,42.2,29.0 | 37.4 / 48.8 | 23.5–104.5 / 8.9–113.0 | 81.0 / 104.1 / 108.7 |
| D | 58.1,34.8,31.3 / 56.9,30.5,30.1 | 39.5 / 36.1 | 10.8–63.7 / 26.9–49.5 | 52.9 / 22.6 / 19.6 |
| dusk-fire | 106.7,62.0,36.4 / 114.5,64.5,37.0 | 69.7 / 73.2 | 42.2–105.6 / 46.5–91.6 | 63.5 / 45.1 / 35.7 |

Additional subject checks:

- **Dusk-fire shade face:** mockup `(234,650)–(468,692)`, game `(218,743)–(312,878)`, selected on their respective
  camera-facing tower-dune faces. Mockup Y **32.3**, SD **9.7**; game Y **29.4**, SD **1.7**; round-4 game Y **4.6**,
  SD **1.8**. The black slab is repaired in value. The shaded surface still lacks the target's internal variation.
- **D glove:** common box `(620,1110)–(740,1210)`. Mockup RGB **47.3,27.7,24.2**, Y **31.6**, SD **19.8**;
  game RGB **49.2,22.3,23.0**, Y **28.1**, SD **7.7**. Round 4 Y **14.3**. The leather is less oxblood and near the
  target's mean value, but still much flatter within this corresponding hand/cuff region. Maximum Y in this box is
  **171.1 / 45.0**; that is a regional highlight comparison, not a maximum pixel anywhere in the frame.
- **D sky:** legacy sky box `(40,300)–(540,600)` gives mockup/game Y **50.0 / 37.7**, RGB
  **49.0,46.2,90.6 / 37.8,34.1,73.1**. A clean zenith box `(40,180)–(440,250)`, avoiding the FPS/quest chips, gives
  RGB **21.0,25.4,63.1 / 27.5,30.2,74.6**, Y **27.2 / 32.8**. A close zenith sample does not establish a match of
  the entire sky gradient. The older 400×150 zenith box reaches into the game's tracker and should not be treated as
  isolated sky.

## README claims verified

| Signal Dunes claim | Verdict against the capture |
|---|---|
| Shade faces cool violet-brown, no longer black | **Supported in value/hue, incomplete in surface structure.** The shade-face measurement above confirms the floor repair. Its SD remains far below the target; it still reads as a broad smooth mass. |
| Brighter lit crests; increased A/dusk-fire spread | **Direction supported.** Lower-left p95 rises from about 79 to 95 in A and 77 to 92 in dusk-fire. Both still fall below their targets, and A lacks the target's spatial placement of bright and shaded ridges. The builder's exact 62/79 and 34/62 cannot be independently reproduced without its ROI/mask definition. |
| D ground and zenith near the quoted RGB targets; late skies blue-violet | **Ground mean and hue supported; full match incomplete.** D ground is close. Mid-sky remains dimmer, afterglow too orange, and ground spread less than half the target. The clean zenith measurement also shows why patch choice matters. |
| Logs back inside the bowl | **Supported.** C and unlit h3 no longer show the projecting horizontal red bars. The new triangular stack is contained but still unlike a naturally piled burning log bed. |
| Flame orange with a small core | **Not established visually.** The shader colour/core weights changed, but C still reads as smooth pale tongues. Final compositing and silhouette must be judged, not intended shader constants. |
| Glove neutral dark brown with sheen | **Partly supported.** Less saturated red, darker than the sand, cuff and some sheen visible. Stitched relief, crossing braid and highlight distribution remain substantially weaker than the target. |
| Thumb patch fixed | **Not established by the render.** A conspicuous ivory patch remains where the coil enters the fist in B and h2 (x about 0.65–0.72, y about 0.67–0.68). The source clamps the map, but inspect the texture/material/specular contributions before claiming the visible defect is gone. Its exact cause is not established by the JPEG. |
| Idle hold is the big low coil four mockups show | **Not delivered.** A/B/C/dusk-fire still show a narrow upright oval at the right and an exposed fist. Their target coils occupy much more of the lower centre. `HD_GLOVE` changed, but the rendered silhouette remains wrong. The lead's ruling is accepted; no separate D-specific transform is requested. |
| Sunset clouds irregular banks with dark cores | **Source changed, target finish not delivered.** The game still presents cream slashes, weak internal volume and horizontal lines. A needs orange-red textured banks; dusk-fire needs restrained grey-brown banks. |
| Tent dark canvas | **Colour supported; form/scale incomplete.** B's tent is darker but remains a large flat panel near the frame edge, rather than the smaller shaded structure beside the side-on animal. |
| Far-sand stepped strip fixed | **The long extension is repaired, not the whole ground join.** Comparing the two aerial-overviews, the round-4 vertical dark bar no longer extends all the way toward the far range. A short stepped dark remnant survives near x 0.40–0.49 / y 0.22–0.30, crossing an obvious horizontal terrain/shading boundary near y 0.26. Do not mark the entire seam resolved. |
| Wagon lit by its own lantern | **Supported, finish partial.** `buildWorld()` registers the lamp in the fourth firelight slot and `loadHd()` applies the term to `wagon-hd`. B/h2 show a warmer opening and cloth. Cargo remains dark, the lamp has little glow, and broad panels still lack the target's readable boards, tears and spokes. |
| No mock camera or staging-code change | **Supported with the stated distinction.** Camera blob unchanged. `stage()` unchanged; `duskOf()` changed Sefa's normal target from 0.25 to 0.38, so B's staged look changed with ordinary play as intended. Actual `camAt` is now recorded; round 4 lacks that field, preventing a measured height-to-height comparison. |
| NEUTRAL rejected; AgX retained | **AgX retention supported by source.** This surface does not contain the NEUTRAL trial, so its reported colour failure is not independently verified. AgX itself is not a shortcut; the displayed highlight/colour result remains the criterion. |

## Ranked findings and concrete fixes

These continue the earlier seats' findings and check the round-4 fixes. Art findings are `should-fix` against the frozen
targets. They request only subjects and finish already present in the mockups.

| Rank / ID | Mockups and frame region | Concrete fix |
|---|---|---|
| 1 / R5-A-SD1 (continues R4-A-SD1) | A/dusk-fire landscape, y 0.35–0.85; D ridge bands | Preserve the repaired shade floor and tower dune. Build A's distinct near diagonal ridge and the intervening saddle in real terrain; give dusk-fire the sweeping shaded saddle with its lit left shoulder. Shape the east field into D's long transverse bands and smoother swale, keeping the tower's full silhouette clear. Compare silhouettes and lit/shaded regions from the fixed cameras before another mean-colour adjustment. Keep routes/collision/navmesh consistent and verify normal walking. |
| 2 / R5-A-SD2 (continues R4-A-SD2) | A/dusk-fire sky, y 0.18–0.40; D mid-sky/horizon | Replace pale slashes and ruled sunset lines with irregular cloud banks carrying dark interior structure and warm undersides. Match A's orange-red banks and dusk-fire's smaller grey-brown banks through the normal dusk progression. Preserve the improved late hue, but make D's mid-sky and peach-pink afterglow follow its full target gradient. Soften/recede the far range layers. |
| 3 / R5-A-SD3 (continues R4-A-SD4) | All foreground weapons; A/B/C/dusk-fire y 0.58–0.85 | Deliver the lead's actual large low coil as the ordinary sustained hold: broader toward lower centre, fist nearer the bottom-right edge. D shares it under the ruling. Rebuild or rebake the plait as crossing strands with dark recesses and narrow strand highlights; make glove panel seams/knuckle creases readable at phone frame size. Trace and remove the surviving ivory thumb-area patch. Inspect the final render; transform/map constants alone do not demonstrate completion. No per-shot transforms or frozen attacks. |
| 4 / R5-A-SD4 (continues R4-A-SD3) | B wagon/cargo, x 0.1–1 / y 0.40–0.53; smoke above | Keep the lantern warmth but separate cloth, hoops, tailboard boards and wheel spokes instead of evenly warming smooth panels. Give the lamp visible glow and let its normal light reach nearby cargo so boards and sacks read. Present the existing horse side-on in the real layout; reduce/integrate the tent to the target's background scale. Make cookfire smoke widen and break into downwind lobes. |
| 5 / R5-A-SD5 (continues R4-A-SD5) | C flame/plume, bowl/base and ground pool | Keep logs inside the bowl, but form a charred pile rather than the triangular stack. Produce ragged orange tongues around a smaller bright core, broken wind-leaning smoke and varied short warm ember streaks. Weather bowl/shaft toward soot-dark iron and the plinth toward irregular fieldstone. Concentrate orange light near the base with textured radial falloff. Preserve the actual effects and baseline completion notices. |
| 6 / R5-A-SD6 (continues R4-A-SD6) | dusk-fire tower/fire/ray, x 0.15–0.60 / y 0.17–0.43 | Supply the target's illuminated tower through a real gameplay milestone, including quest/dusk/summon side effects. If the target flame is intended as an earlier beacon, establish that distinction as real gameplay rather than lighting only the screenshot. Capture the moving ray on a genuine normal route at the target scale; adjust its real route if required. Check platform/cage proportions. The current unstaged initial frame cannot earn those absent subjects' similarity points. |
| 7 / R5-A-SD7 (continues R4-A-SD7) | aerial-overview, x 0.40–0.49 / y 0.22–0.30 and boundary y about 0.26 | Finish the shadow-map/ground-skirt join repair. The stretched far extension is gone, but a stepped remnant and horizontal boundary remain. Trace sampling and terrain continuity on both sides; verify from the aerial and normal ground viewpoints. Do not hide it through a camera move. |
| 8 / R5-A-P1 (continues R4-A-P1) | Capture/ledger evidence | Retain `camAt`, and attach served-build identity/deployment status, measured frame-time and total loading/Explorer memory evidence. Identify the parity report for the code-equivalent revision. A 30 fps HUD, encoded clip and zero page errors do not establish all ledger limits. This is a verification gap, not a measured budget failure. |

## Ledger §5: no-shortcut and reachable-state audit

- **Views:** the round-4 and round-5 recorded camera blobs are identical. No re-aim is hidden in this round's camera
  file. `camAt` records actual position, direction and FOV for every shot; scored frames use FOV 72. Round 4 did not
  record actual cameras, so terrain-driven changes cannot be compared numerically across those captures. No deliberate
  dodge is evidenced. The hero views expose the same cloud, weapon, wagon and brazier finish.
- **Real geometry:** source and wider views show mesh terrain, tower, wagon, cargo, horse, tent, braziers and weapon.
  No overlay or painted card replaces a walkable object. Sky/ranges are distant backdrop; flame/smoke/glow are effects
  on real structures. Baked terrain self-shadow is derived from the height field; its seam is a rendering defect.
- **B `logbook`: reachable by source inspection.** `stage()` sets SCOUT_FLAG, the only state effect of Sefa's first
  dialogue, leaving the logbook unread. The tracker names the logbook. Its new dusk target 0.38 is ordinary play state,
  reached by the same 0.02-per-second easing or on save load. B settles eleven seconds after snapping the staged state.
  The player can hold that milestone. The camera is outside the real 2.4 m interaction radius; do not fake the distant
  READ prompt shown by the mockup.
- **C/D `waymarks-lit`: reachable by source inspection.** `stage()` invokes the real logbook handler, well pull and
  jar interaction, then each brazier's oil interaction and light action. Those handlers supply the read label, raised
  bucket, removed jar, visible oil, fire/glow, labels and flags. C settles three seconds, beyond the 1.2-second bucket
  lift; D settles eleven. All three waymarks give ordinary dusk target 0.86. The quest accepts the braziers in any
  order, so the photographed one can be lit last. Metadata lists B/C/D correctly. This is handler/reachability
  verification, not a new physical-iPhone playthrough or telemetry assertion of every side effect.
- **Held pose/effects:** the viewmodel is normal idle, with a single `HD_GLOVE` transform. There is no staged attack
  freeze or dropped C flame/smoke/embers/pool. The incorrect coil pose is an art miss, not evidence of a shortcut.
  The recorder calms creatures; before meeting Sefa the ray is already held to its home glide by ordinary quest code,
  and remains animated. The clip/context cannot establish unchanged active combat by themselves.
- **Dusk-fire:** unstaged and reachable as the initial Sefa objective, but unlit tower/no ray do not depict the
  mockup's focal state. It is scored as supplied, not treated as a captured illuminated-tower milestone.
- **Phone/baseline HUD:** recorder requests 390×844 @3, phone tier and touch, exporting 780×1688 JPEGs. Scored frames
  restore normal HUD/viewmodel after aerials. No special look or HUD suppression was found. Keep baseline UI despite
  the old mockups' different vitals/ammo/tracker layouts.
- **No narrowing/budgets/shipping:** the inspected shard diff retains quest/combat and applies the look/material
  changes normally, not only in capture. Commit `56c23085` reports parity green at `0d4101be`; that intervening commit
  only adds progress assets, and `src/` plus the recorder are code-identical between those revisions. This is useful
  code-equivalent parity evidence, although the report/results are not attached to this round's README. The recorder
  still accepts caller-supplied SHA without comparing served-build identity. Exact shipping status, frame-time
  distributions and total loading/Explorer process-memory evidence are absent from this surface. No limit violation
  or normal-play regression is demonstrated by those omissions.

No confirmed screenshot shortcut warrants voiding the numerical comparison. The listed staged milestones are supported
as ordinary play states. Verification gaps remain, and the images themselves are clearly below the 8/10 bar.

SCORE signal-dunes: 6.1
