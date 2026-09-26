# Nine Dragon Stack: round 2, in-game spawn mockups (E169)

Shard 4's spawn, **Lantern Square (stratum 6/9, +125 m in the 500 m cube)**, as iPhone portrait print-screens of the
game. Each one is codex `image_gen` (OpenAI, cloud) **editing a real iPhone capture of today's game** (Driftwood Isle,
sword, 736 × 1600), so the phone HUD keeps its layout, sizes and glass. The world and the viewmodel are replaced: the
Neon Jian in the right hand, the Fei Zhua grapple on the left forearm. HUD additions painted in: the quest chip
"RED ENVELOPE 0/9 | CROWN +250 M", the stratum readout "STRATUM 6/9 · LANTERN SQ · +125 M" with a 9-tick ladder,
"GLIDE" (umbrella) replacing HOVER, and a round "HOOK" button above JUMP. Made 2026-09-25 from the E169 shard brief.

| File | What it shows | Take |
|---|---|---|
| `board.jpg` | Decision board: A / B / C / D side by side | — |
| `A-paifang.jpg` | Straight across Lantern Square at blue hour: the neon-outlined red paifang gate, the banyan in its planter with a shrine, mahjong tables, a noodle stall with steam, a skybridge and drones in the violet sky strip. The jian points at the gate, and the claw gauntlet is at the bottom-left. | 1st take (the re-roll moved the banyan left and drew a weaker HOOK glyph) |
| `B-well-edge.jpg` | At the Yamen Well's stone balustrade: the Fei Zhua arm is raised with a cyan line to a brass dragon hook in a bracket reticle. A red cable car crosses the shaft, with stratum after stratum of walkways dropping into orange fog. | re-roll 1 (deeper, more legible 375 m drop than the 1st take) |
| `C-stair-street.jpg` | The square's corner: a steep stair-street climbing between towers of neon signs, under a monorail with a lit train and a glass skybridge. A dragon hook up the street has a cyan target marker, and **the HOOK button glows as ready**. | re-roll 1 (the 1st take did not light HOOK, and its jian ran up the stairs) |
| `D-night-rain.jpg` | A's view at deep night in heavy rain: magenta-dominant neon, umbrellas, strong puddle reflections of the gate and the signs, denser fog. | re-roll 1 (the 1st take swapped the ATTACK glyph for a sword) |

## Notes

- **Engine:** every frame is codex `image_gen` (`scripts/horizon-matte/run_codex.py`, 4 in parallel, ~2 min each).
  Two rounds were run: 8 generations in all, and 4 were kept.
- **The stratum ladder was repainted by script** (PIL, `patch_ladder.py` in the session scratchpad). In all 8
  generations image_gen drew 6–8 ticks, with the middle one lit, however the prompt counted them. The ladder is a flat
  UI element, so it was redrawn in each kept frame as exactly **9 ticks with the 6th from the bottom lit** (3 dim
  above, 5 dim below). The fill and tick colours were sampled from the frame's own panel. Nothing else was touched.
- Saved at the reference capture's size (736 × 1600, JPEG q88). image_gen returned 851 × 1849, the same aspect, so
  nothing was stretched.
- Known nits: D's quest-chip end-arrow is a few pixels malformed. The HOOK claw glyph differs a little between
  frames (A's three-talon claw reads best).

## Prompts (re-roll wording; the 1st takes had a looser ladder line and no jian-size / HOOK-glow lines in C)

Each job = COMMON + one SCREEN + TASK, with the reference capture attached (`-i`).

### COMMON

```text
GAME: Wildshard is a first-person action-adventure game played on an iPhone as a home-screen web app, portrait orientation. The world is made of floating 500 m "shards". This image shows SHARD 4, "NINE DRAGON STACK": Chongqing meets Cyberpunk 2077, built like the Kowloon Walled City, a single impossibly dense neon megablock a 500 m cube of city stacked in nine street strata with ~12 floors of Kowloon-style housing between each two, about 120 floors in all. The player stands on the sixth stratum, LANTERN SQUARE, +125 m, halfway up the stack, with 375 m of city below and 125 m more above: a real town square of worn wet granite flagstones, surrounded by concrete tower blocks that keep climbing another 125 m out of the top of the frame, every wall covered with windows, air-con units, drainpipes, window cages, laundry, bundled cables and hundreds of neon signs in traditional Chinese (vertical and horizontal, red, magenta, cyan, jade, warm amber; real-looking shop signs like 麵 noodles, 牙科 dentist, 火鍋 hotpot, 茶 tea, 藥房 pharmacy, 麻雀 mahjong, 旅館 hotel), red paper lanterns, red couplets on doors. Blue hour into night, light drizzle, wet stone mirroring the neon, volumetric fog, heavy bloom on neon, deep teal-blue shadows, sodium-orange street lights, brass details.

RENDER STYLE: it must read as a real print-screen of a AAA PS5-grade game engine running on the phone: neon-noir realism, grounded PBR materials, wet reflections, volumetric fog, bloom, slight lens softness, a real game frame. NOT concept art, not a painting, not an illustration, no depth-of-field matte-painting look. The attached reference is a low-poly toon beach from a different shard: REPLACE THAT WORLD ENTIRELY (no sky-blue sea, no pier, no palm trees, no toon clouds, no wooden sword). No device frame, no phone bezel, no watermark, no caption.

FORMAT: the image is an iPhone portrait print-screen, the same tall portrait layout and the same framing as the attached reference. Keep the black iOS status bar strip at the very top exactly as in the reference (time "22:48", bed icon, signal bars, "LTE", battery "69").

HUD (keep it exactly where the reference has it, same sizes, same fonts, same glass style; this is the game's shared UI language: dark navy glass #0d1b26 at ~80 % opacity, 1 px cyan #8fe3ff hairline borders with small corner brackets, letter-spaced monospace UPPERCASE labels, flat, no gradients, no emoji). Every string below must be spelled exactly as quoted:
- Top-left, first row: the "PAUSE" chip with its two-bar pause glyph, and next to it the fps chip reading "30 fps 33 ms" (the "30" in amber).
- Top-left, second row: the vitals bar: a white heart, the number "100", a cyan fill bar, and the label "VITALS".
- Top-right: the same round minimap frame with its tick marks and a white player arrow in the centre, "N" in a small tab at the top; inside it now shows this stratum's floor plan from above in dark navy and cyan lines: city blocks around a square, with the Yamen Well as a large dark circle beside the player arrow.
- Right under the minimap, right-aligned, the quest chip: a small cyan diamond, "RED ENVELOPE 0/9", a thin vertical divider, "CROWN +250 M", a small cyan play-triangle at its right end.
- NEW, right under the quest chip, right-aligned, same glass style: the stratum readout panel. On its left a slim vertical ladder of EXACTLY NINE short horizontal ticks (count them: nine, not seven), evenly spaced in one column as tall as the three text lines. Counting from the bottom, ticks 1 to 5 are dim, tick 6 is bright cyan and longer, ticks 7 to 9 are dim: so there are three dim ticks ABOVE the bright one and five dim ticks BELOW it (the bright tick sits clearly in the upper half of the ladder). To its right three stacked lines of text: "STRATUM 6/9", then "LANTERN SQ", then "+125 M".
- A small thin white crosshair in the centre of the screen.
- Right side above the pad: the round glass buttons exactly as in the reference: "LOCK" (crosshair glyph), "JUMP" (up-arrow glyph), "DODGE" (double-chevron glyph). NEW: a fourth round button of the same size and style, "HOOK" (glyph: a grappling claw, three curved talons fanning out from a short shaft), placed directly above "JUMP".
- The bottom touch pad band exactly as in the reference: on the left the "MOVE" label and the round MOVE stick with its glowing cyan thumb; in the centre the big round "ATTACK" button with the same diagonal arrow glyph as the reference (pointing up-right) and the small line "HOLD = HEAVY"; on the right the dashed square "LOOK" pad with its four-arrow glyph. The tab sitting on top of the pad above MOVE now reads "GLIDE" with a small open-umbrella glyph (instead of HOVER).

WEAPON VIEWMODEL (first person, drawn under the HUD):
- Right hand, entering from the bottom-right exactly where the reference's wooden sword is, blade angled up and to the left toward the centre: the NEON JIAN, a straight double-edged Chinese jian with a dark steel blade, a thin glowing cyan-white heat edge down both sides, faint etched cloud-scroll circuit pattern, a brass guard shaped like a stylised dragon head, a black-lacquered grip in a dark tactical glove, a red silk tassel and a small yellow paper talisman tied at the pommel. Realistic metal, reflecting the neon.
- Left forearm, entering from the bottom-left, partly behind the MOVE area of the pad: the FEI ZHUA wrist grapple, a compact brass-and-carbon launcher strapped to a dark sleeve, with a folded three-talon brass claw at its tip and a faint glowing filament line.
```

### SCREEN A-paifang

```text
SCREEN (variant A, "paifang"): The player faces straight across Lantern Square. Centre of the frame, 20-30 m away: a red-lacquer paifang gate with a green-tiled roof, outlined in glowing red and cyan neon tubes, red paper lanterns hanging under its beams. Beside it a big banyan tree in a round stone planter with aerial roots and a small red shrine with incense smoke. On the flagstones in the mid-ground a few folding mahjong tables with old men playing under a string of bulbs, and a noodle stall with a glowing sign and white steam rising into the neon. Scooters parked, puddles. Tower blocks climb on both sides and out of the top of the frame, dense with neon signs and lit windows; a skybridge and bundled cables cross high overhead. Between the tower tops, right under the HUD's top row, a narrow strip of deep violet sky with antenna silhouettes and a cargo drone's blinking red and white lights. Light drizzle streaks, wet flagstones reflecting the neon.
```

### SCREEN B-well-edge

```text
SCREEN (variant B, "well edge"): The player stands at the carved stone balustrade on the edge of the Yamen Well, a vertical light shaft about 40 m across cut 500 m down through the whole city. The balustrade runs across the lower third of the frame. Across the shaft: the far wall of the well, a cliff of stacked lit balconies, shopfronts, neon signs, laundry and pipes. Looking down past the balustrade: a dizzying 375 m drop, strata of lit balconies, walkways and neon falling away below, fog layer after fog layer (each stratum separated by a glowing fog bank), the bottom lost far below in orange-lit mist. A red cable car on a thick cable crosses the shaft in the middle distance. The left forearm with the FEI ZHUA grapple is raised higher here, aiming across the shaft, and a thin cyan targeting line runs from its claw to a brass dragon-head hook mounted on a sign on the far wall, the hook ringed by a small cyan target reticle. The NEON JIAN is still held low in the right hand at the bottom-right. Light drizzle, fog, bloom.
```

### SCREEN C-stair-street

```text
SCREEN (variant C, "stair street"): The player stands in the corner of Lantern Square where a steep, narrow stair-street climbs away between two tower blocks, and looks slightly UP the stairs: worn wet stone steps with a railing, potted plants, a tiny tea shop, red lanterns, a steaming vent. The stair-street is a canyon of neon signs stacked on both walls (vertical traditional Chinese signs in red, magenta, cyan, jade, amber), air-con units and cages. Crossing the canyon high above: a concrete monorail track on pillars with a lit train on it, and above that a glass skybridge between the towers, bundled cables sagging between them, fog and drizzle catching the neon light. The NEON JIAN is the same size on screen as the wooden sword in the reference: its tip ends near the screen centre just below the crosshair, it does NOT reach up the stairs. In the HUD, the new "HOOK" button above "JUMP" is visibly highlighted as READY: its ring glows bright cyan with a soft cyan halo around the button and its claw glyph is cyan, while "LOCK", "JUMP" and "DODGE" stay in their normal unlit style; and on a sign high up the stair-street a brass dragon hook has a small cyan target marker.
```

### SCREEN D-night-rain

```text
SCREEN (variant D, "night rain"): Same composition as a view straight across Lantern Square toward a red-lacquer paifang gate outlined in neon tubes, with red lanterns, a banyan in a stone planter, mahjong tables under a tarp and a noodle stall with steam, towers climbing out of the frame on both sides, a skybridge overhead, a thin strip of sky at the top with antenna silhouettes and a drone's blinking lights. But it is deep night now and the rain is heavy: visible rain streaks, splashes on the flagstones, a few people with umbrellas, the sky strip black-violet. The neon is MAGENTA-dominant (magenta and hot pink signs everywhere, with some cyan accents), and the puddles and wet flagstones make strong mirror reflections of the magenta neon and the gate. Denser fog, heavier bloom.
```

### TASK

```text
TASK FOR CODEX: Use the built-in image_gen tool to EDIT the attached reference screenshot into exactly ONE tall portrait image as described above (keep the HUD layout, positions and sizes of the reference; replace the world and the weapon). One generation only. Do not create or modify any other file.
```
