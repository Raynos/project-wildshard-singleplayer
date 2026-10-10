# T15 council, round 1 — seat B

Read: `ideas.md`, `ledger.md`, `art/trailers/round-3-draft1/board-draft1.jpg`, the round-2 storyboard, the six shard
paintings, `look-crossroads.jpg`, `look-grid-night.jpg`, `hero-shard.jpg`; skimmed MARKETING-SITE and VISION.

**What I read in the images.** Draft 1's frames are mostly fine one at a time. What makes them read as AI is
that they all share the generator's house look: golden hour or neon at night, every inch filled in, glowing
streetlights, a galaxy behind the shard. The six shard paintings carry the same look, apart from Driftwood. So any
idea that reuses these paintings as they are comes back as draft 1 slowed down. Every pick below that uses a painting
needs a fresh one, briefed on **what to leave out**. My scores assume that brief.

## Scores (1–5)

| # | Idea | Concept | Not AI | Build | Memo | Note |
|---|---|---|---|---|---|---|
| 1 | The seam | 4 | 4 | 3 | 5 | The best single image. As written it breaks ledger 5: shards are split by the highway, not a bare line. Make the seam the road. Risk: MoGe stretching on a low lateral slide |
| 2 | Describe a world | 5 | 4 | 4 | 3 | The only idea that shows Claude Code doing it. *shard uploaded* breaks ledger 6. The hard cut to a painting is the site's hero C again |
| 3 | Map draws itself | 5 | 5 | 3 | 4 | Many hands on one map is exactly the idea. Risk: ten ink plots that really look like ten different hands, drawn on as strokes |
| 4 | Turntable | 3 | 2 | 2 | 3 | TRELLIS from a painting gives a soft, blobby mesh. A product shot is a stock gimmick. Close to ledger 8's line |
| 5 | Postcards | 5 | 4 | 4 | 4 | Six places plus a blank seventh says "yours" with no words. The card frame turns AI paintings into props. Risk: the pen stroke |
| 6 | Window seat | 3 | 4 | 3 | 4 | A good locked-frame gag, but it sells the highway, not authors. Road motion behind a still plate is fiddly |
| 7 | Continuous drive | 4 | 1 | 1 | 3 | **Trap.** A style change inside one LTX take is the generated motion that failed. Untested and long |
| 8 | Empty plot | 4 | 2 | 4 | 2 | **Trap.** It is draft 1's shot 1 (b01) with a slow push, the drift Jake just rejected |
| 9 | Pop-up book | 3 | 4 | 1 | 4 | Paper hinges in Blender take days and sit on ledger 8's wrong side. Lovely, not buildable in 2–4 h |
| 10 | Grid fills | 4 | 4 | 4 | 2 | An infographic. *1 → 10,000 shards* is a false number (seven exist; Jake cut grid numbers from the site) |
| 11 | Day in the life | 3 | 2 | 3 | 3 | An LTX time-lapse with an object landing is generated motion. Close to an upload beat (ledger 6) |
| 12 | Text only | 4 | 5 | 5 | 2 | A safe control, but it is draft 1's captions with no pictures. *Upload it.* breaks ledger 6. Nobody will remember it |
| 13 | Six doors | 3 | 1 | 3 | 2 | **Trap.** The portal gag is the most stock AI-reel idea on the list |
| 14 | The hand | 4 | 2 | 2 | 4 | Generated hands are the weakest point. A real-hand plate means a photo shoot, and Jake does no chores |
| 15 | Before / after | 4 | 4 | 4 | 3 | Honest (Claude really builds grey first), but b03 was in draft 1. Pixel alignment drifts under repaint |
| 16 | The signpost | 5 | 3 | 4 | 4 | *Your shard ↓* is a clear gag. The crossroads plate is pure golden-hour AI. A flat arrow on a painting can look pasted |
| 17 | Living painting | 2 | 3 | 3 | 3 | Pushing into a canvas that turns 3D is itself an AI-reel trope. "The style is the player's" is weak |
| 18 | ASCII to world | 4 | 4 | 4 | 4 | An authored effect with a strong last image. Alone, it risks reading as an "ASCII filter" demo |
| 19 | Night highway | 2 | 4 | 4 | 3 | Nice sound idea, no concept: nothing says players build. Fold its sound-first open into 6 |
| 20 | Blueprint | 4 | 4 | 3 | 3 | The "lines lift into 3D" morph is an AI transition. A blueprint is not how a shard is really made (15 is) |

## The four picks

Each pick sells a different part of the one idea: **Claude Code builds it** (2), **every shard has its own author**
(1), **there's one for you** (5), **it's a whole world of them** (3). Each also uses a different technique: real
capture, camera projection, 2.5D cards, ink motion design.

### Pick 1 — #2 Describe a world, sharpened with #18 (real capture → glyph resolve)
- **Why it wins:** it is the only idea where the screen is real, and the screen *is* the pitch: Claude Code builds the
  world. A muted viewer gets it from the typing alone.
- **Riskiest step:** the move from the terminal to the world. A hard cut to a painting is a known move and looks
  generated. A glyph mosaic can look like a Photoshop filter.
- **Change:** drop *shard uploaded* (ledger 6). End on the last real log line, then let **those same log glyphs**
  re-colour, by the painting's luminance and hue, into the island over ~3 s, all in monospace on the terminal's black
  (#18's effect, applied to the real text). Make the prompt human and specific, not a fantasy cliché: *"a small
  island with a crooked lighthouse and a toon sea"*. Paint the island in Driftwood's flat toon style, with no galaxy
  and no golden hour.

### Pick 2 — #1 The seam, rewritten so the seam is the highway (camera projection)
- **Why it wins:** it is the one image a viewer would retell: one lawn, a road, and the far side is a different
  artist's world. One picture and one move, so nothing boils.
- **Riskiest step:** the low ground-level slide. MoGe-2 depth on grass at the lens tears and stretches at depth
  edges.
- **Change:** honour ledger 5. The camera slides low across painterly Nalati grass, over the kerb and the two-lane
  road with its dashed line, and the far kerb is faceted Driftwood toon grass. Caption: *Every shard is built by
  someone else.* Then rise to show the road running to the horizon between the two worlds. Paint the two halves as
  **two separate paintings** composited along a ruler-straight road, so the generator can't blend the styles. Build
  the foreground grass as BiRefNet card layers (multiplane), not a depth mesh. Keep the move short: lateral, then up.

### Pick 3 — #5 Postcards (2.5D card motion, HTML / CSS 3D in the titles pipeline)
- **Why it wins:** it has an object (cards on a table), a rhythm (dealt on the beat) and an ending (the blank card) in
  15 s, with zero generated motion. The postcard frame does the art direction: a white border, a printed caption,
  a stamp.
- **Riskiest step:** the seventh card. A handwriting animation of *yours* in a pen stroke has to look drawn, not
  faded in.
- **Change:** give the cards a **printed-postcard treatment** (halftone, a slightly desaturated print palette,
  *Greetings from Driftwood Isle*). That kills the AI sheen in the source paintings. Shoot it top-down and locked
  (stop-motion table-top, real drop shadows), with no camera moves. On the blank seventh card, have a monospace cursor
  type *greetings from: your world* instead of a pen writing *yours*. That brings Claude Code in and avoids the
  handwriting risk. Optionally, write each card's author handle in small type on its border.

### Pick 4 — #3 The map that draws itself (ink motion design, SVG strokes)
- **Why it wins:** it is the most clearly made-by-a-person technique on the list (drawn line by line), and it states
  the idea outright: one map, many hands, each plot in its own ink.
- **Riskiest step:** the plot illustrations. About ten small drawings must read as ten different hands and draw on as
  strokes, not as a raster fade.
- **Change:** generate each plot as black line art on white (Qwen / Image 2.5), vectorise it with potrace, and
  animate its strokes, so the line art really draws. Vary the hand per plot: crow-quill, brush, technical pen,
  crayon. Keep it to two inks plus one accent colour. Leave #10's counter out (no false numbers). For the pull-back,
  tile the ten plots, mirrored and rotated, and blur them with distance. Sign each plot with a tiny author handle in
  its own hand.

## Traps
- **#7, #11:** generated motion again. #7 in particular stakes the whole variant on an untested LTX style change.
- **#13:** the portal gag. **#17:** the push into a painting. Both are AI-reel stock.
- **#8:** it is literally draft 1's opener.
- **#10:** it states a false scale.
- **#4, #9:** a Blender object or scene as the final look (ledger 8), and too slow to build.
- **Across all of them:** reusing the round-2 paintings as they are. Every painting needs a new brief that says what
  to leave out: no golden hour, no galaxy, no glowing grid, one light, few objects.
