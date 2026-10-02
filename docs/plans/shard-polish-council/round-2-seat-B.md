# Round 2 (last) · seat B (Claude, lens: evidence and coverage)

**What I checked.** Every frame of the round-2 capture at full resolution (780×1688):
`progress/sunscar-dunes/20261002-0136-14a26e19/` (`SD2`) and `progress/far-reach/20261002-0136-14a26e19/` (`SR2`). The
round-1 frames they replace are `progress/sunscar-dunes/20261002-0041-eaeb401f/` (`SD1`, plus the fix capture
`20261002-0123-0b33bb31`) and `progress/far-reach/20261002-0051-4c39a774/` (`SR1`). The references are
`progress/<slug>/20261002-0011-0d59505c/` (`REF/<slug>`). I also read the seven round-2 and round-1 sheets. I sampled
both `clip.mp4` at 1 fps, `boss-3-phase.mp4` and `roc-fight-phases.mp4` at 0.5 fps (the Roc's flash frames at 4 fps),
and the first and last frames of both `timelapse-heroes.mp4`. I read `whip-arena.jpg`, both boards' READMEs, all six
portrait cards, both plans' State lines and row tables, and the fix commits' messages and stats (read-only `git show`).
Pixel coordinates are in the 780×1688 frame unless a crop is named.

**Not in the capture.** `04189b76` (kindling in the unlit bowls) landed after `14a26e19`, so nothing below credits it.

**Register bookkeeping (evidence nit, no ID).** R1B-14, R1C-3 and R1C-5 cite `84d41f75`, which is a Sky Reach commit. The
Signal Dunes fix is `0948dc77` ("R1C-3 R1C-5 R1B-14"). R1B-16 and R1B-17 also land in `be2f6b36` / `1b7fd97b`.

## (1) Every register row, round 2

| ID | Shard | Round-2 status | Evidence frame | Note |
|---|---|---|---|---|
| R1A-1 | sky-reach | verified | `SR2/aerial-spawn.jpg`, `SR2/aerial-overview.jpg`, `SR2/clip.mp4` 0–9 s | The keels are faceted crag strata with hanging spurs, the rims are notched with boulders, and the lids are no longer smooth discs. They read as authored islands next to `REF/driftwood-isle/aerial-overview.jpg`. |
| R1A-2 | signal-dunes | partly | `SD2/h4-tower-deck.jpg` (x 540–780, y 900–1300) next to `SD1` and `REF/nine-dragon-stack/first-frame.jpg` (crop `glove.jpg` in my scratchpad) | Fingers now wrap the handle, the handle tilts toward the crosshair and the glove separates from the violet sand. The glove is still a large faceted brown mass: triangle facets show on the knuckle wrap in every FP frame. The coil is three pale, waxy hoops. It is the weakest viewmodel of the six (`whip-arena.jpg` bottom row). |
| R1A-3 | signal-dunes | verified | `boss-3-phase.mp4` 0–10 s (the manta body at a distance and close); `SD2/aerial-spawn.jpg` (x 250–300, y 690–700): a pale manta, not a dark kite | The ray shares the generated manta (`species/manta.ts`). No hero view shows the ordinary ray any more, so Jake's first close look comes in play. |
| R1A-4 | signal-dunes | verified | `SD2/first-frame.jpg`, `SD2/h1-spawn-crest.jpg`, `SD2/h2-caravan.jpg`: no VITALS row (SD1 showed 86) | The ray is held until Sefa. |
| R1A-5 | signal-dunes | **not fixed** | `SD2/h2-caravan.jpg` (x 260–500, y 590–820) against `SD1` (crop `wagon.jpg`) | The wagon is the same dark shell: the hoops, wheels and timber are near-black on dark brown, and the canvas is a broken grey plane. Mean luma over the wagon went 47 → 52 of 255 (p5 3 → 5). "A step lighter" does not separate boards, hoops and wheels at phone size. `REF/driftwood-isle/h2-hut.jpg` and `REF/pine-hollow/h2-pond.jpg` still out-finish it. |
| R1A-6 | sky-reach | verified | `SR2/first-frame.jpg` (x 440–780, y 730–1300) | Bronze ribs, painted cloud silk, a gloved hand with fingers on the guard and a bracer with rivets. |
| R1A-7 | sky-reach | partly | `SR2/h3-grove-high-step.jpg` (y 1100–1430) is fine; `SR2/h4-crown.jpg` (y 1060–1430) | The near grass in H1, H2 and H3 now tapers and ramps green to gold. The crown meadow in H4 and in the Roc fight's grounded phase is still a carpet of short hard triangles with white flecks. |
| R1A-8 | sky-reach | verified | `src/shards/far-reach/thumbs/far-reach-portrait.jpg` (`f93714aa`) | Re-cut from the current build: the keeper, the bridge, the windmill and the gold sky. |
| R1A-9 | sky-reach | verified | `SR2/first-frame.jpg`: chip "TALK TO THE KEEPER \| KEEPER 8 M" | The keeper is in frame at x 40–200, clear of the rope post. Only his raised hand touches the HOVER tab. |
| R1B-1 | sky-reach | verified | `SR2/first-frame.jpg` (one sun at 205,800; nothing at SR1's hard disc, 198,663), `SR2/h3` (one at 130,1005), `SR2/aerial-spawn.jpg` (one at 190,315), clip 0–3 s | One sun everywhere. |
| R1B-2 | sky-reach | verified | `SR2/h2-windmill.jpg` | The windmill is the subject, the slats are gone from the view, and the foreground is grass. The new aim is tight: the cap and the top sail are cut by the frame top, from about 6 m. |
| R1B-3 | sky-reach | verified | `SR2/first-frame.jpg` | The keeper is in frame and named. His pin "KEEPER 8 M" floats at y 428, about 400 px (≈ 2.4 m) above his head at y ≈ 830. This is the same pin-height fault R1C-7 fixed for Sefa, not yet applied here. |
| R1B-4 | sky-reach | partly | `SR2/h3-grove-high-step.jpg` | The clipping beige plane is gone, and the glass is one framed slab. The white updraft streaks still cross the crosshair like cracked glass (x 330–470, y 700–900). |
| R1B-5 | sky-reach | partly | `SR2/h4-crown.jpg` | Three stones and the kerb now read as a ring (x 100–220, 360–420, right edge). The "Storm Roc" bar is still up with **no Roc in frame** (y 400–465), and LOCK shows. `01500e79` ("the Roc circles in the arena's view") doesn't show in this capture. |
| R1B-6 | sky-reach | verified | `SR2/first-frame.jpg`, `SR2/h2-windmill.jpg` minimaps (crop `minimaps.jpg`) | Island discs, plank bridges solid, hover spans dashed, the quest diamond. On a par with the Signal Dunes and Nalati painters. |
| R1B-7 | sky-reach | verified | `SR2/aerial-overview.jpg`, `SR2/aerial-spawn.jpg`, clip | The bare 3-D skyline cones are gone (SR1 had them at 120,280 and 330,340 in the overview). The worn paths on the hub top are still soft smears, not crisp strips (minor). |
| R1B-8 | sky-reach | partly | `art/far-reach/round-15-loop-5/roc-fight-phases.mp4` 2–26 s (the forearm fills the lower right) | The hand is fixed: a glove with fingers, and a bracer. The forearm is still a plain cream tube with two cord rings. Under the HUD in the posed views it hides; in the fight, when the camera pitches, it is a large untextured cylinder. |
| R1B-9 | sky-reach | verified | as R1A-8 | |
| R1B-10 | sky-reach | verified | `roc-fight-phases.mp4` (27 s; dives, the gale wall, grounded) | The current look and all three phases. The faceted Roc reads. The camera clips through its wing in two dives (about 3–5 s); the one white frame (about 16 s) is a hit flash. |
| R1B-11 | sky-reach | verified | `SR2/first-frame.jpg`: SWING has a fan icon, GUST a wind icon | |
| R1B-12 | signal-dunes | partly | H4 verified: `SD2/h4-tower-deck.jpg` shows the rail, the planks and the brazier on its stand in the centre third. H3: `SD2/h3-waymark.jpg` | H3 now aims at the waymark, but the subject is a dark bowl on a pole and a red rag on a crossbar, over about 60 % blank slope (y 850–1430 is empty sand). It is the flattest of the new shards' ten hero frames (luma std 22 against 34–54 for the rest), next to built lookouts in `art/shard-polish-council/round-2/compare-h3.jpg`. The scree is six flat wedges. |
| R1B-13 | signal-dunes | verified | as R1A-4 | |
| R1B-14 | signal-dunes | partly | `SD2/aerial-overview.jpg`, `SD2/clip.mp4` 0–9 s | In the clip the horizon bands now rise and fall, and the skirt meets them. But in both aerials and every clip frame the low sky is still a flat orange band with no cloud deck (y 0–120 overview). The overview's horizon is one flat lavender wall (y 120–250) over a striated skirt. Of the places only the tower reads, at about 20 px (420,720). The caravan is a lantern dot (60,1040), and no well or basin shows. The "trodden trails" read as soft dark translucent smears (a vertical one through x 400, y 380–1200), not paths. Compare `REF/driftwood-isle/aerial-overview.jpg` and `REF/nalati-grasslands/aerial-overview.jpg`. |
| R1B-15 | signal-dunes | verified | as R1A-3 | |
| R1B-16 | signal-dunes | partly | `art/sunscar-dunes/round-14-council-r1/whip-arena.jpg` | The board exists at HEAD: idle, light 18, heavy 16+16, and the first-frame weapon next to Nine Dragon and Pine Hollow. The **pull** asked for is missing. The board itself shows the glove as the faceted brown lump (R1A-2). |
| R1B-17 | signal-dunes | verified | `boss-3-phase.mp4` ~10–14 s (phase II storm: the Matriarch's silhouette reads against the dark band), ~18–26 s (grounded, lit, pale belly) | It reads in all three phases. Around 16 s the dive passes through the camera (the frame fills with the underside) for under a second. |
| R1B-18 | signal-dunes | verified | `SD2/first-frame.jpg`, `SD2/h2-caravan.jpg`, `SD2/h4-tower-deck.jpg`: no blocky flakes | |
| R1B-19 | signal-dunes | verified | `SD2/h2-caravan.jpg`: the fps pill reads 30, not red | |
| R1B-20 | both | partly | `docs/plans/SIGNAL-DUNES.md` rows match (done / in progress). `docs/plans/SKY-REACH.md` rows C1–C7 and P1–P5 still read `open`, and C4 still says "to the windmill island" | `0b33bb31` touched only Signal Dunes. The Sky Reach State line is current. |
| R1C-1 | signal-dunes | partly | as R1B-12 | H4 meets the fix (the brazier and the rail in the foreground, the basin beyond). H3 has its subject, but it doesn't read until it is lit. |
| R1C-2 | signal-dunes | partly | The creatures are fixed (`boss-3-phase.mp4`: a lighter hide and a pale belly). The props are not: `SD2/h2-caravan.jpg` (the wagon), `SD2/h3-waymark.jpg` (the bowl and pole near-black against the sky) | The rim and the cool fill don't reach the wagon or the waymark. |
| R1C-3 | signal-dunes | verified | `SD2/first-frame.jpg` (y 1150–1430 violet shade), `SD2/clip.mp4` | The warm/cool crest split is now the strongest edge. |
| R1C-4 | signal-dunes | partly | as R1A-2 | The pose and the values are fixed. The glove facets remain, so the "normals smoothed" claim doesn't show at full resolution. |
| R1C-5 | signal-dunes | partly | as R1B-14; `SD2/clip.mp4` 4–9 s | The crests are sharper and the far band rises and falls in the clip. The overview's band, the places and the trails are not fixed. |
| R1C-6 | signal-dunes | verified | `src/shards/sunscar-dunes/thumbs/sunscar-dunes-portrait.jpg` | The lit waymark is the subject, as the fix asked. It is the sparsest of the six cards: one pole and a flame over about 55 % empty sand, 82 KB against 190–384 KB for the others. A taste call, so it isn't a row. |
| R1C-7 | signal-dunes | verified | `SD2/first-frame.jpg`: "LIGHT THE SIGNAL FIRE \| SEFA 8 M"; the pin is at y 884 with her head at y ≈ 960 | |
| R1C-8 | sky-reach | verified | as R1A-9 and R1B-3 | |
| R1C-9 | sky-reach | verified | `src/shards/far-reach/layout.ts:13–16` (side isles at (−54,5) y27, (60,−12) y34, (−58,−60) y32.5, (65,−72) y28); `SR2/clip.mp4` | Rims, keels and heights vary, and the side isles are off the grid. The spine Sunrest → Windmill → Step → Crown stays on x = 0 by design. |
| R1C-10 | sky-reach | verified | `SR2/h3-grove-high-step.jpg` (x 360–590, y 790–1140), `SR2/aerial-overview.jpg` (x 540–780, y 1180–1250) | A cyan, half-transparent slab with a solid frame. No stair banding, and it no longer reads as a render bug. |
| R1C-11 | sky-reach | partly | h2 and h3 are fixed (as above). h4 is not: as R1B-5 | |
| R1C-12 | sky-reach | partly | The bare cones are gone (R1B-7). `SR2/clip.mp4` 4–9 s (the painted castle isle with waterfalls, top) | The matte's islands are still sharper and more detailed than the playable isles beneath them. |
| R1C-13 | sky-reach | verified | `art/shard-polish-council/round-2/compare-first-frame.jpg` | A blue zenith and green grass. The two new columns no longer read as the same orange-peach pair. |
| R1C-14 | sky-reach | verified | `SR2/first-frame.jpg`: the grip sits at y 1060–1160, above the GUST disc (y 1165) | Bronze ribs, a glove and a bracer, as target C. |
| R1C-15 | sky-reach | partly | `SR2/first-frame.jpg` is fixed (taper and a root-to-tip ramp); `SR2/h4-crown.jpg` is as R1A-7 | |
| R1C-16 | sky-reach | verified | as R1A-8 | |
| R1C-17 | sky-reach | verified | `SR2/h2-windmill.jpg`: framed sails with cloth panels | |
| R1C-18 | both | verified | `docs/design/LOOK-LOOP.md:310`; `art/sunscar-dunes/round-14-council-r1/README.md` (gap list); `docs/plans/SKY-REACH.md` | The form-and-subject column exists and is filled. |

**Tally.** Signal Dunes (21 rows, counting the two "both" rows): 11 verified, 9 partly, 1 not fixed (R1A-5), 0 regressed.
Sky Reach (28 rows): 20 verified, 8 partly, 0 not fixed, 0 regressed.

## (2) New must-fix findings

None. Every remaining gap I can evidence sits under an existing row. These are observed, but below the round-2 bar for a
new finding (not must-fix), for the lead's list:
- Sky Reach: the keeper's pin height (R1B-3 note).
- Sky Reach: a flat white, hard-edged waterfall card under an island keel (`SR2/clip.mp4` about 8.5 s, island at lower centre).
- Sky Reach: the new cumulus cards show straight edges from above (`SR2/aerial-overview.jpg` (40,1415)→(240,1380) and (590,1110)→(780,1160); contrast-stretched, they are clear).
- Signal Dunes: the camera passes through the Matriarch in one dive.

## (3) The battery

### Signal Dunes
1. **Title deck:** pass (R1C-6 verified; the sparsest card of six, a taste call).
2. **First frame:** pass with R1A-2. Sefa waves in frame, the goal is named, nobody arrives hurt, and the tower sits between buttes under a violet-shaded crest. The brown faceted glove fills the lower-right quarter.
3. **First minute:** pass (R1A-4, R1B-13 and R1C-7 verified; the minimap route and the pin are at her feet).
4. **Four hero views:** R1A-5 (H2 wagon, not fixed), R1B-12 / R1C-1 (H3 partly), R1C-2 (props partly), R1A-2. H1 and H4 pass.
5. **From above:** R1B-14 / R1C-5 (partly). The aerials are the weakest of the six on the round-2 sheets: no place reads, the low sky is flat, and the overview's horizon is a wall.
6. **Hands and weapon:** R1A-2, R1C-4, R1B-16 (all partly; no pull on the board).
7. **Fight and boss:** pass. The manta ray and the Matriarch read in all three phases (R1A-3, R1B-15, R1B-17 verified).
8. **Time-lapse:** pass. 20/20 at `0b33bb31` is a long way from 1/20 (`95eb5db9`). H3's composition only changed this round.

### Sky Reach
1. **Title deck:** pass (R1A-8, R1B-9, R1C-16).
2. **First frame:** pass. One sun, the keeper waving in frame, a blue and gold sky, a green meadow, the fan with bronze ribs. The pin floats high (note).
3. **First minute:** pass (R1A-9, R1B-3, R1C-8, R1B-6 verified).
4. **Four hero views:** R1B-5 / R1C-11 (H4: a boss bar with no Roc), R1B-4 (H3 streaks), R1A-7 / R1C-15 (H4 grass). H1, H2 and H3 otherwise pass; H2 is framed tight.
5. **From above:** pass with R1C-12 (the matte out-details the isles). The crag islands, glass spans and cloud sea hold; no void.
6. **Hands and weapon:** R1B-8 (the forearm tube). Fan and hand pass.
7. **Fight and boss:** pass (R1B-10 verified). The bar-without-Roc in H4 is R1B-5.
8. **Time-lapse:** pass. 21/21 (`5297a6eb`) against 1/21 (`54e37d4d`) is the largest move of the two.

VERDICT signal-dunes: below the bar
VERDICT sky-reach: at the bar
