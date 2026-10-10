# T15 council, round 1 — seat C

Read: `ideas.md`, `ledger.md`, `art/trailers/round-3-draft1/board-draft1.jpg`, `art/trailers/round-2-highway/`
(board, hero-shard, look-crossroads, shard-driftwood / nalati / pine / ninedragon), MARKETING-SITE §1, §7, VISION.

**What the images say before any scoring.** Every round-2 painting is the same picture: golden hour or neon, every
square inch detailed, volumetric haze, glow on every edge. That is criterion 2 of the diagnosis, and it is in the
*stills*, not only in the motion. So an idea that "projects one painting" is only as un-AI as the painting. Any idea
that reuses `b01`–`b15` or the `look-*` plates as they are inherits draft 1's look. Every pick below needs its own art
brief: one palette, one light, a plain sky, and a list of things to leave out.

Scores 1–5. C = concept, N = not AI, B = buildable, M = memorable.

| # | Idea | C | N | B | M | Note (riskiest step for B) |
|---|---|---|---|---|---|---|
| 1 | The seam | 5 | 3 | 2 | 5 | Strongest single image, but shards never touch: the highway runs between them (ledger 5). The pull-up reveal is a big move a projection can't fake. Risk: the crane up |
| 2 | Describe a world | 4 | 3 | 4 | 3 | The terminal is real. But "type a prompt, a picture appears" is an image-generator ad, and *shard uploaded* breaks ledger 6. Risk: the island still |
| 3 | The map that draws itself | 5 | 5 | 4 | 4 | Drawn line by line, and it says "players keep adding" with no caption. Echoes the inked map Jake liked on the site (round 1 B). Risk: plot fills that look drawn, not pasted |
| 4 | One shard, turntable | 3 | 2 | 3 | 3 | A product shot shows off TRELLIS texture mush; the "field of them" is a whole Blender scene (ledger 8). Risk: mesh quality under studio light |
| 5 | Postcards | 4 | 4 | 5 | 4 | Physical cards and real shadows read as handmade. The blank seventh card is the gag. Risk: the cards' weight and timing in the deal |
| 6 | Window seat | 4 | 4 | 3 | 4 | A locked frame with an identical interior across hard cuts is a designed gag, and it's true to the highway. Risk: exteriors that read as a parked car |
| 7 | One continuous drive | 4 | 1 | 2 | 3 | **Trap.** One LTX take that changes style is untested generated motion: draft 1's failure, only longer |
| 8 | The empty plot | 4 | 2 | 4 | 2 | This is draft 1's opening shot (`b01`) again, in the look Jake called AI |
| 9 | Pop-up book | 3 | 4 | 2 | 4 | Rigged paper is a whole Blender scene with real modelling. Risk: the hinges |
| 10 | The grid fills | 4 | 4 | 4 | 3 | Good system animation. **Trap in the counter:** *10,000 shards* is invented (seven exist, and Jake cut grid numbers, MARKETING §7). Fold into #3 |
| 11 | Day in the life of a plot | 3 | 2 | 3 | 3 | A shard landing from the sky is the upload set piece Jake dropped (ledger 6); LTX motion. Risk: the shard landing |
| 12 | Text only | 4 | 5 | 5 | 2 | Safe and forgettable; *Upload it.* breaks ledger 6. Better as the end card of another idea |
| 13 | Six doors | 3 | 1 | 4 | 2 | **Trap.** Portal doors in a white void are a stock AI-reel idea |
| 14 | The hand | 4 | 1 | 2 | 4 | **Trap** as written: generated hands. Only works with a real photographed hand, and Jake does no chores |
| 15 | Before / after split | 3 | 3 | 4 | 3 | Draft 1 already did grey → colour (`b03`). Sells "built", not "a world of shards". Risk: pixel alignment |
| 16 | The signpost | 4 | 3 | 4 | 4 | The new arrow is a good designed insert, but the base plate is `look-crossroads`, maximalist. Risk: the painting |
| 17 | Living painting | 2 | 3 | 3 | 3 | "The art style is the player's" is vague; the camera pushing into a canvas is a familiar AI move |
| 18 | ASCII to world | 4 | 4 | 4 | 4 | A glyph mosaic dissolved by luminance is authored, demoscene-like and new. Risk: the glyph island has to read at phone size |
| 19 | One night on the highway | 2 | 4 | 4 | 2 | Atmosphere, no argument. Its sound-led open belongs in #6 |
| 20 | The blueprint | 3 | 4 | 3 | 3 | Linework is good; "lines lift into 3D" needs 3D. A better #15, but still about one build, not the world |

## The four picks (four ideas, four techniques)

### A · The map that draws itself (#3, with #10's pull-back) — motion design, stroke animation
**Why it wins.** It is the only idea that shows the one big idea as a *process*: plot after plot added by different
hands, joined by the one road. It is fully authored (SVG strokes, eased timing), so nothing can boil, and it is the
furthest from draft 1's look. The pull-back over a page-filling map is the memorable beat.
**Riskiest step.** Twelve or so plot illustrations that *draw on* rather than pop in: generate each one flat in an ink
style (Qwen), vectorise it (potrace), and animate the stroke paths. Raster fills fade in under the linework.
**Make it better.** Draw each plot in a visibly different hand (fine nib, brush, blue ballpoint, a pixel stamp, a
watercolour wash), with a tiny handwritten author handle under it (*@mara*, *@juno*). The highway is the one constant
line, always the same ink. That says "each built by a player" with no caption. No counter, no invented numbers.

### B · Prompt to glyphs (#2 merged with #18) — real capture + glyph mosaic
**Why it wins.** It carries the "Claude Code" half of the pitch, the half no other pick says. The real terminal is
undeniably real. The payoff isn't a picture swapped in: the build log's own characters slide into a mosaic of the
island and then resolve, glyph by glyph, into it. An effect you can watch being made.
**Riskiest step.** The glyph mosaic reading as an island at phone size: coarse cells (~60 columns), high contrast, a
silhouette with a strong shape (the lighthouse).
**Make it better.** Drop *shard uploaded* (ledger 6); the last real line is the build / validate pass. Keep the
characters that are actually on screen (reshuffle the real log; don't invent text). Paint the island in a shard's own
house style (Driftwood toon), flat and midday, not a golden-hour fantasy island. Then the reveal reads as "a shard", not
as an image generator.

### C · Postcards (#5) — flat layers, physical 2.5D
**Why it wins.** It is the one idea where the paintings *should* look like pictures: they're printed cards. Deals on
the beat, real drop shadows and a wooden table make it read as handmade. The blank seventh card with *yours* written on
it is the clearest "you can build one" image in the twenty, and the six styles side by side show "every shard is
different" faster than any fly-over.
**Riskiest step.** Physical believability: card weight, the slight skew as each card lands, contact shadows, paper
grain and a printed border (HTML / CSS 3D in `titles.mjs`, no Blender scene).
**Make it better.** Repaint the six as *postcard art* (a limited print palette, a white border, the place name in
period type, a postmark). One card flips to show its back: *"Built by @mara in Claude Code."* The pen on the blank
card writes the end line, so the pitch is handwritten, not a title card.

### D · Window seat (#6, with #19's sound-led open) — locked plate + designed cuts
**Why it wins.** The only cinematic pick, and the only one about the highway (Jake's detail, ledger 5). A locked
camera with the same dashboard across three hard cuts is a gag a director designs; a generator wouldn't. The sound
carries it: black, the engine and the radio, then the frame.
**Riskiest step.** Forward motion with no generated video: the exterior plates are still. Motion comes from authored
lane dashes and streetlight sprites passing (motion design), plus a small camera-projection dolly on each exterior.
All three exteriors must share one horizon and vanishing point.
**Make it better.** Each road sign names the shard *and its author* (*Driftwood Isle · built by @mara*), so the cut
says "player-built". The interior is night, mostly silhouette and dashboard glow, which hides generator detail. The
exteriors go flat and calm (overcast toon beach, painted steppe, rain-neon), not golden hour.

## Alternates and traps
- **Alternate for D: #1 The seam, made true.** Make the seam the highway: a low camera crosses the two-lane road and
  the verge on the far side is another style. Two paintings composited along a hard mask, a lateral slide only, then a
  cut to a calm wide. It replaces D if Jake wants a single image over a gag.
- **Traps:** #7 (generated style-change motion), #13 (portal gag), #14 (generated hands), #10's counter (an invented
  number), #8 (draft 1's opener), and any line about uploading (#2, #11, #12; ledger 6).
- **Across all four:** no round-2 painting ships as it is. Each pick gets a fresh art brief with a "leave out" list.
