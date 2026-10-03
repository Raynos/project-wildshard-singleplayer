# Round 2, seat C (red team: an AAA art and game director who just played all six on an iPhone)

**Lens.** Are the round-1 fixes real or cosmetic, and what still makes the two new shards read below the other four?
Styles are not re-argued (ledger 3), and no new content is asked for (ledger 4).

**Paths.** `SD2` = `progress/sunscar-dunes/20261002-0136-14a26e19/`, `SD1` = `progress/sunscar-dunes/20261002-0041-eaeb401f/`,
`SR2` = `progress/far-reach/20261002-0136-14a26e19/`, `SR1` = `progress/far-reach/20261002-0051-4c39a774/` (round 1's judged
Sky Reach capture), `REF/<slug>` = `progress/<slug>/20261002-0011-0d59505c/`. Sheets: `art/shard-polish-council/round-<n>/compare-*.jpg`.
Commits after the 14a26e19 capture (`04189b76`, the kindling in the brazier bowls) are **unverified**: nothing captured shows them.

**My measurements** (evidence only, never a pass bar; ledger 7). World band y 320–1290, x 80–500 of the 780 px frame; CIE L*;
hue spread = 10–90 % circular spread over pixels with HSV saturation > 60/255.

| Frame | SD1 L* sd · hue | SD2 L* sd · hue | SR1 L* sd · hue | SR2 L* sd · hue |
|---|---|---|---|---|
| first-frame | 18.3 · 35° | 19.6 · 98° | 18.1 · 32° | 17.5 · 41° |
| h2 | 16.8 · 29° | 17.0 · 29° | 13.0 · 56° | 15.3 · 76° |
| h3 | 7.9 · 22° | **9.6 · 19°** | 12.4 · 37° | 13.0 · 49° |
| h4 | 19.1 · 101° | 22.6 · 35° (p5 L* **0.5**) | 16.5 · 52° | 14.1 · 39° |

For reference, Driftwood's five frames span 134–181° and Nalati's 37–244°. Signal Dunes h3 is still the flattest frame of
the 30. Its h4 is now the darkest one: the subject is a black bowl. The caravan box in h2 (x 260–500, y 590–820) moved a
mean of 5.6/255 between SD1 and SD2. That is lighting noise, not a material pass.

**The red-team read in four lines.**
1. **Sky Reach's fixes are real.** The keeper waves in the first frame under "TALK TO THE KEEPER | KEEPER 8 M". There is
   one sun, the grass reads as grass, the glove has fingers and a bracer, the islands have notched rims and the minimap
   draws them. Its first frame and h1 now stand next to Driftwood's. The rest is spot work: h4's boss bar with no boss, the
   glass ramp that reads as a pane, a plain mill at point-blank range and the sleeve.
2. **Signal Dunes' fixes are mostly re-aims.** The cameras moved onto the subjects, but the subjects were not finished. h3
   is a black bowl on a stick on a blank slope, ringed by flat chips. h4 is a black bowl over black rails. The h2 caravan is
   the same dark hoop shell as in round 1. The whip is lighter, but it is still the biggest and least readable viewmodel of
   the six (`art/sunscar-dunes/round-14-council-r1/whip-arena.jpg`, bottom row).
3. **Still one hue, and dark.** Signal Dunes' cool half shows only on dune shade from above (the clip, the aerials) and in
   the first frame. Every hero view is orange-brown on orange-brown at a mean L* of 34–40. The other four's mean L* is 53–71.
4. **What it would take.** For Signal Dunes, light and material the four subjects the cameras now point at. For Sky Reach,
   three spot fixes.

## (1) Per register row

| ID | Shard | Round-2 status | Evidence frame | Note |
|---|---|---|---|---|
| R1A-1 | sky-reach | partly | `SR2/aerial-overview.jpg`, `SR2/aerial-spawn.jpg` vs `SR1/aerial-overview.jpg` | The rims are notched and boulders sit on the lip; the keels are faceted rock. The layout is still a straight cross (hub → mill → roost in one vertical line; left and right spans horizontal), and the hub's underside is a soft fogged bowl with no spires or roots. |
| R1A-2 | signal-dunes | partly | `SD2/first-frame.jpg` vs `SD1/first-frame.jpg`; `whip-arena.jpg` | The glove is a step lighter, has a rim, and the coil is a pale braid under the fist. It is still a faceted lump about 260×450 px in the lower right, with the handle sticking up like a stick. Next to the Nine Dragon gauntlet and the Pine crossbow on the same board, it is clearly the least finished viewmodel. |
| R1A-3 | signal-dunes | verified | `art/sunscar-dunes/round-14-council-r1/cards.jpg` (landscape, practice), `boss-3-phase.mp4` at 22 s | A generated manta body with a pale belly and a rim. It no longer appears in any hero frame (h1 is now pixel-identical to the first frame). |
| R1A-4 | signal-dunes | verified | `SD2/first-frame.jpg`, `SD2/h1-spawn-crest.jpg` | No VITALS, so the player is untouched. |
| R1A-5 | signal-dunes | **not fixed** | `SD2/h2-caravan.jpg` vs `SD1/h2-caravan.jpg` | The same dark hoop frame with no canvas, the same p5 L* ≈ 1, and the same composition. The README says "the generated wagon, lighter wood", but the capture does not show it. The target (`round-14-council-r1/board-before-after-target.jpg`, H2 row) has a lit canvas cover. |
| R1A-6 | sky-reach | partly | `SR2/h2-windmill.jpg`; `art/far-reach/round-15-loop-5/roc-fight-phases.jpg` | The ribs are bronze and the glove and bracer are good. The leaf is still a flat panel without pleats. The sleeve is a plain cream tube with three strap rings, and the Roc clip (no HUD) shows it filling the lower right. |
| R1A-7 | sky-reach | partly | `SR2/h3-grove-high-step.jpg` (passes), `SR2/h4-crown.jpg` | h3's meadow reads as tall tapered grass. h4's foreground is still an even carpet of short pointed chips. |
| R1A-8 | sky-reach | verified | `src/shards/far-reach/thumbs/far-reach-portrait.jpg` | Re-cut from the current build (keeper, bridge, mill, painted sky). |
| R1A-9 | sky-reach | verified | `SR2/first-frame.jpg` | "TALK TO THE KEEPER \| KEEPER 8 M", with the keeper whole, waving, clear of the HOVER tab. |
| R1B-1 | sky-reach | verified | `SR2/first-frame.jpg`, `SR2/h3-…`, `SR2/aerial-overview.jpg` | One sun in every frame. |
| R1B-2 | sky-reach | verified | `SR2/h2-windmill.jpg` | The mill is the subject. See R1C-11 for the range. |
| R1B-3 | sky-reach | verified | `SR2/first-frame.jpg` | As R1A-9. |
| R1B-4 | sky-reach | partly | `SR2/h3-grove-high-step.jpg` | The beige near plane is gone. The updraft streaks still cross the crosshair as white crack lines (x 330–450, y 700–900), drawn over the glass ramp, so the ramp reads as a cracked window. |
| R1B-5 | sky-reach | partly | `SR2/h4-crown.jpg` vs `SR1/h4-crown.jpg` | The ring now reads: three stones, a kerb and bunting. The "Storm Roc" bar and LOCK are still up with no Roc in frame, which is the half of the fix that was not done. |
| R1B-6 | sky-reach | verified | `SR2/h2-windmill.jpg`, `SR2/h3-…` | The minimap draws island discs, spans and the quest diamond. |
| R1B-7 | sky-reach | verified | `SR2/aerial-overview.jpg`, `SR2/clip.mp4` | The bare 3-D cones are gone, and the hub's path strips are crisp. |
| R1B-8 | sky-reach | partly | `SR2/h2-windmill.jpg` (x 520–700, y 1290–1688); `roc-fight-phases.mp4` 5–6 s | The fingers are shaped. The forearm is still the plain pale cylinder. |
| R1B-9 | sky-reach | verified | `art/far-reach/round-15-loop-5/cards.jpg` | |
| R1B-10 | sky-reach | verified | `art/far-reach/round-15-loop-5/roc-fight-phases.mp4` | Phases I–III at the current look. See the battery-7 note. |
| R1B-11 | sky-reach | verified | `compare-h1.jpg` (round 2) | SWING has a fan icon and GUST a wind icon. |
| R1B-12 | signal-dunes | verified (aim) | `SD2/h3-waymark.jpg`, `SD2/h4-tower-deck.jpg` | Both views now have a subject. Its finish is R1C-1 and R1C-2. |
| R1B-13 | signal-dunes | verified | `SD2/first-frame.jpg` | |
| R1B-14 | signal-dunes | partly | `SD2/aerial-overview.jpg`, `SD2/clip.mp4` | The tower now sits in the centre of the overview. The sky above the band is still a flat orange gradient in both aerials and the whole clip, with no cloud deck low. The caravan and well still can't be picked out. |
| R1B-15 | signal-dunes | verified | as R1A-3 | |
| R1B-16 | signal-dunes | verified (coverage) | `art/sunscar-dunes/round-14-council-r1/whip-arena.jpg` | The board exists at HEAD. What it shows is R1A-2. |
| R1B-17 | signal-dunes | verified | `boss-3-phase.mp4` at 10, 17.6 and 22 s | The storm fog applies. The Matriarch is a pale ghost inside it (17.6 s) and reads fully when grounded (22 s). |
| R1B-18 | signal-dunes | verified | `SD2/first-frame.jpg`, `SD2/h4-tower-deck.jpg` sky | No flake stars. |
| R1B-19 | signal-dunes | verified | `SD2/h2-caravan.jpg` | The fps pill is 30, not red. |
| R1B-20 | both | partly | `docs/plans/SKY-REACH.md` rows C1–P5 | Signal Dunes' rows match the build. Sky Reach's C1–C7 and P1–P5 all still read `open`, although its State line says loops 4–5, the cards and the Roc clip landed. C4 still says "to the windmill island … raise the bridge to the storm crown". |
| R1C-1 | signal-dunes | partly | `SD2/h3-waymark.jpg`, `SD2/h4-tower-deck.jpg`; comparisons `REF/driftwood-isle/h3-lookout.jpg`, `REF/pine-hollow/h3-lookout.jpg` | The composition is fixed. h3's subject is an unlit near-black bowl on a pole, and the "cairn and scree" are six flat chips that float on the slope. The lower 60 % of the frame is still blank sand (L* sd 9.6, the flattest of 30). The kindling teepee (`04189b76`) is uncaptured. |
| R1C-2 | signal-dunes | partly | creatures: `boss-3-phase.mp4` 22 s (pass); props: `SD2/h2-caravan.jpg`, `SD2/h4-tower-deck.jpg` | The rim and the pale belly landed on the ray and the Matriarch. The props did not get them. The caravan, the deck brazier, its post and the rail are black (h4 p5 L* 0.5, the darkest frame of the 30). The bible bans black silhouettes. |
| R1C-3 | signal-dunes | partly | `SD2/first-frame.jpg` (hue 98°), `SD2/clip.mp4` (violet shade on every crest); `SD2/h2`–`h4` (19–35°) | The warm/cool crest split is real from above and in the first frame. The hero views at eye level are still one orange. |
| R1C-4 | signal-dunes | partly | `SD2/first-frame.jpg` | The pose is better: the handle angles toward the crosshair and the coil sits under the fist. The facets still read as a decimated scan, and the glove sits at the same value as the sand. |
| R1C-5 | signal-dunes | **regressed** | `SD2/aerial-overview.jpg` y 140–420 vs `SD1/aerial-overview.jpg` (contrast crop in the seat's scratchpad) | The new dune skirt toward the buttes renders as **saw-tooth stair-step bands**, rows of jagged light/dark teeth, which reads as a terrain or shadow bug. The far band's top is still one straight lavender ridge, and no trail reads from above. The crest split itself passes. |
| R1C-6 | signal-dunes | verified | `src/shards/sunscar-dunes/thumbs/sunscar-dunes-portrait.jpg` | The lit waymark, the shard's one fire. Of the six cards it is the sparsest (a torch on bare sand), but it has a clear subject. |
| R1C-7 | signal-dunes | verified | `SD2/first-frame.jpg` | "LIGHT THE SIGNAL FIRE \| SEFA 8 M"; the world pin sits just above her head. |
| R1C-8 | sky-reach | verified | `SR2/first-frame.jpg` | |
| R1C-9 | sky-reach | partly | as R1A-1 | The rims and keels are better. The grid and cross layout and the even deck heights are unchanged in the overview. |
| R1C-10 | sky-reach | partly | `SR2/first-frame.jpg`, `SR2/h1-sunrest.jpg`, `SR2/h3-…` | The bible's cyan, framed, half-transparent glass landed and the stripes are gone. In all three views the steep ramp up to the roost reads end-on as an upright glass pane, with the updraft cracks over it (R1B-4). |
| R1C-11 | sky-reach | partly | `SR2/h2-windmill.jpg`, `SR2/h4-crown.jpg`; comparisons `REF/driftwood-isle/h2-hut.jpg`, `REF/driftwood-isle/h4-shrine.jpg` | h3 no longer occludes. h2 swung from no mill to a mill at about 8 m that crops the sails and shows a smooth untextured cream cone with two black holes, not "from across its meadow". h4: the Roc is still absent while its bar shows. |
| R1C-12 | sky-reach | partly | `SR2/clip.mp4` at 7 and 9.5 s | The 3-D cones are gone. The matte's castle islands with waterfalls are still more detailed than any playable isle. |
| R1C-13 | sky-reach | partly | `compare-first-frame.jpg` (round 2) | Blue zenith, green grass and cyan glass: the two NEW columns no longer look like siblings. Measured spread is 35–76°, still below the bible's own target on four of five frames. |
| R1C-14 | sky-reach | verified | `SR2/first-frame.jpg` | A glove with fingers on the guard, a bracer and bronze ribs; the grip sits above GUST. The sleeve is R1B-8. |
| R1C-15 | sky-reach | partly | `SR2/first-frame.jpg` (passes), `SR2/h4-crown.jpg` | The root-to-tip ramp landed. h4's band is still the chip carpet (R1A-7). |
| R1C-16 | sky-reach | verified | as R1A-8 | |
| R1C-17 | sky-reach | verified | `SR2/h2-windmill.jpg` | Lattice frames with cloth. |
| R1C-18 | both | verified | `docs/design/LOOK-LOOP.md:310`; `art/sunscar-dunes/round-14-council-r1/README.md` gap list | |

**Counts.** Signal Dunes (19 rows): 11 verified · 6 partly · 1 not fixed (R1A-5) · 1 regressed (R1C-5).
Sky Reach (26 rows): 14 verified · 12 partly · 0 not fixed. Both (2 rows): 1 verified · 1 partly (R1B-20).

## (2) New findings

None meets the round-2 rule (a new finding outside the diff counts only if it is must-fix). Signal Dunes' worst new
artefact, the dune-skirt saw-tooth, is the R1C-5 regression above. Two observations go to the lead as should-fix, so they
are **not counted**:

| ID | Shard | Severity | Location | Evidence | Concrete fix |
|---|---|---|---|---|---|
| R2C-1 | sky-reach | should-fix (not counted) | From above (battery 5); the loop-5 cumulus over the cloud sea (`ae9db7f8`) | `SR2/aerial-overview.jpg`: a straight horizontal edge across the whole cloud sea at y ≈ 590, a pale quad under the hub (x 0–240, y 1350–1400) and a diagonal edge at the right (x 590–780, y 1110–1150). None of them is in `SR1/aerial-overview.jpg`. Not counted because the references also show hard edges from above: Driftwood's water-plane line in `REF/driftwood-isle/aerial-spawn.jpg`, Nalati's cut terrain edge in `REF/nalati-grasslands/aerial-overview.jpg`. | Feather the cumulus layer's quad edges to zero alpha, or depth-fade them where they cross the cloud-sea plane. |
| R2C-2 | sky-reach | should-fix (not counted) | Battery 7; the Storm Roc stoop (`combat/stormRoc.ts`) | `art/far-reach/round-15-loop-5/roc-fight-phases.mp4` 5.3–6.2 s: the dive passes over the camera, and for about 0.6 s the Roc's untextured faceted belly fills about 70 % of the frame. Nalati's boss frames (`progress/nalati-B13-04-phase1-sunburst-phone.jpg`) keep the boss whole. | End the stoop's path short of the camera so the whole bird stays in frame at the closest point. Or give the underside the feather material the top has, since the dive is the fight's signature shot. |

## (3) Battery

### Signal Dunes
1. **Title deck:** pass (R1C-6). It is the sparsest card of the six, with a clear subject.
2. **First frame:** pass on subject (Sefa, the tower, the goal chip, no damage). The whip mass (R1A-2, R1C-4) and the single
   hue (R1C-3) keep it a step under the others.
3. **First minute:** pass (R1A-4, R1B-13, R1C-7 verified). The goal is named, the pin is on Sefa and the minimap draws the route.
4. **Four hero views:** **below**. R1A-5 (the caravan is unchanged), R1C-1 and R1C-2 (h3 and h4 subjects are black, unlit
   objects; h3 is the flattest of 30 frames and h4 the darkest), R1C-3. In the round-2 `compare-h2/h3/h4.jpg`, every
   reference column has a lit, built subject in the centre third.
5. **From above:** R1C-5 (regressed: the saw-tooth skirt and the straight lavender ridge) and R1B-14 (the flat orange sky).
6. **Hands and weapon:** R1A-2 and R1C-4 (partly). The arena board shows the moves land, and the model is still below the
   gauntlets and the crossbow.
7. **Fight and boss:** pass. A generated ray and Matriarch with a rim; the storm fog works; the grounded phase reads
   (`boss-3-phase.mp4`).
8. **Time-lapse:** pass on direction. This round moved the cameras and the creatures. The h2 caravan did not move at all.

### Sky Reach
1. **Title deck:** pass (R1A-8, R1B-9, R1C-16).
2. **First frame:** pass. Keeper, bridge, mill and one sun; it holds next to Driftwood's.
3. **First minute:** pass (R1A-9, R1B-3, R1C-8; minimap R1B-6).
4. **Four hero views:** R1C-11 (h2 a plain mill at point-blank range; h4 a boss bar with no boss), R1B-4 and R1C-10 (h3's
   glass reads as a cracked pane), R1A-7 (h4's chips). h1 passes.
5. **From above:** R1A-1 and R1C-9 (partly: still the cross), R1C-12 (partly). No void. R2C-1 is not counted.
6. **Hands and weapon:** R1A-6 and R1B-8 (the sleeve tube; the leaf has no pleats). The glove passes (R1C-14).
7. **Fight and boss:** R1B-5 (the bar shows without the Roc). The fight reads in all three phases. R2C-2 (the
   belly-in-camera dive) is not counted.
8. **Time-lapse:** pass. Loop 5 is the biggest single step of either shard: keeper, grass, glove, rims, sky.

**What Jake would feel, ranked.** Signal Dunes: (1) the caravan, the waymark and the brazier are black props on orange
sand; light and material them (the canvas and timber split, the rim on props, the kindling captured, the waymark bowl a
step above the sand); (2) the whip lump; (3) the aerial saw-tooth and flat sky. Sky Reach: (1) hide the Roc bar until the
Roc is in view; (2) pull h2 back to show the mill across its meadow, and give the tower a plaster or stone material; (3)
keep the updraft streaks off the glass ramp; (4) the sleeve.

VERDICT signal-dunes: below the bar
VERDICT sky-reach: at the bar
