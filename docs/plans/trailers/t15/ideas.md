# T15 — twenty ideas for a single 15-second Wildshard trailer (TRAILERS Part C, E471)

Jake, 2026-10-10, on CT2 draft 1: *"it looks insanely AI. It looks really bad. It looks really like AI software clips put
together."* He asks for **one 15-second trailer that focuses on one thing**, with no in-engine footage, then **four
variants**: twenty ideas, a council picks four, the four are made, shown to him and reviewed.

## What made draft 1 look like AI (the lead's diagnosis; the ideas below are written against it)

1. **Many unrelated shots.** Fifteen 4-second clips, each its own generated world: the stock-footage montage of every
   AI-video reel. Nothing carries from one shot to the next.
2. **Everything everywhere.** Each frame is maximally detailed, saturated and lit at golden hour: the generator's
   default taste, with no art direction saying what to leave out.
3. **Generated motion.** Slow drifts, warping water, mushy figures. Motion that is invented, not designed.
4. **No idea.** It shows a world, but it doesn't argue one thing in 15 seconds.

So each idea below names its **one thing** and a **technique**, and says why that technique doesn't read as AI. The
techniques available here:

| Technique | What it is | Why it reads as made, not generated |
|---|---|---|
| **Motion design** | vector / typographic animation authored in HTML / SVG and rendered frame by frame (the titles pipeline, `titles.mjs`) | every curve and timing is designed; nothing morphs |
| **Camera projection** | one finished painting (OpenAI Image 2.5 / Qwen, retouched) projected onto its MoGe-2 depth mesh in Blender, filmed by a real camera move (BiRefNet cut-outs for layers) | the classic matte-painting trick: the picture never changes, only the camera moves, so nothing boils |
| **Flat layers** | cut-out paper / card layers moved in 2.5D (parallax, multiplane) | a known handmade look; no generated motion |
| **Real capture** | the real Claude Code terminal (asciinema + agg, as in the alpha trailer) | it is real |
| **One generated shot** | a single LTX-2.5 take, no cuts, under a strict art brief (one palette, one light, few objects) | at most one generated motion, art-directed to be calm |
| **Stills** | a held illustration, a type card, a cut on the beat | still images don't wobble |

The sound for every idea: one MiniMax Music 3 cue (~16 s) and MOSS v2 / SA3 sound effects, mixed to −14 LUFS, as in
the alpha trailer. Every idea ends on the logo, `wildshard.io` and *Concept trailer · not gameplay* (the corner tag
stays on every frame).

## The twenty ideas

### 1. The seam
**One thing:** two worlds touch. **15 s:** an extreme low close-up of grass; the camera slides sideways along the
ground and crosses a sharp straight line where painterly grass becomes faceted toon grass (Nalati → Driftwood); a
caption *Every shard is built by someone else.*; pull up to reveal the line runs to the horizon between two whole
worlds; logo. **Technique:** camera projection of one painting that holds both worlds and the seam. **Why not AI:** one
painting, one camera move, the idea is the composition.

### 2. Describe a world (the prompt)
**One thing:** you type a world into being. **15 s:** black; a cursor types *a floating island with a lighthouse and a
toon sea* (real keystrokes, Claude Code's own UI); the terminal streams the real build log at speed; the last line
*shard uploaded*; hard cut to one painting of exactly that island, held, slow push; logo. **Technique:** real capture
(the terminal) + one still with a camera-projection push. **Why not AI:** the screen is real; the world is one picture.

### 3. The map that draws itself
**One thing:** the world is a map that players keep adding to. **15 s:** an ink line on parchment draws one square plot
and a road; it fills with a little drawn island; a second, third, tenth plot appears faster, each in a different ink
style, roads joining them, until the map is too big for the page and the camera pulls back across thousands; logo.
**Technique:** motion design (SVG stroke animation; the plot fills are illustrations). **Why not AI:** drawn line by
line, it is animation.

### 4. One shard, turntable
**One thing:** a shard is an object, a world in a cube. **15 s:** a single floating cube of land rotates slowly on a
dark studio sweep like a product shot; three captions *A world.* *In a cube.* *Built by a player.*; it drops out of
frame and the camera finds a field of them; logo. **Technique:** a modelled shard (TRELLIS / Hunyuan from the hero
painting, textured) rendered in Blender with studio light. **Why not AI:** a real 3D object lit like a product.
**Risk:** Jake's *"making a video in Blender is going to be absolute dog shit"* (2026-10-09, about whole scenes).

### 5. Postcards
**One thing:** every shard is a different place you can visit. **15 s:** postcards are dealt onto a wooden table one
by one, on the beat — Driftwood, Nalati, Pine Hollow, the Dunes, Sky Reach, Nine Dragon — each a distinct style; the
seventh card is blank; a pen writes *yours* on it; logo. **Technique:** flat layers (six painted cards, a photographed
or painted table, real 2.5D card motion with shadows). **Why not AI:** the paintings never move; the cards do, by design.

### 6. Window seat
**One thing:** the highway between worlds. **15 s:** inside a car at night, one fixed shot over the shoulder through
the windscreen; the road runs straight; the world outside changes style in three hard cuts at three road signs
(toon beach, painted steppe, neon city), the car interior identical in every cut; logo. **Technique:** one car-interior
plate + three painted exterior plates projected behind (camera projection for the road's motion). **Why not AI:** the
locked frame and the identical interior make it a designed gag, not a montage.

### 7. One continuous drive
**One thing:** the highway crosses the shards. **15 s:** a single unbroken low tracking shot along the highway; at
each border the style changes (toon → painterly → neon) as the camera passes a roundabout; caption *One road. Every
world.*; logo. **Technique:** one generated shot (LTX) guided by a Blender layout of the road, with three style zones.
**Why not AI:** one shot, no cuts. **Risk:** generated motion again; style changes inside one LTX take are untested.

### 8. The empty plot
**One thing:** there is room for your world. **15 s:** high over the lit grid at night, every plot built except one,
dark; slow push down into the empty square; it fills the frame; caption *This one's yours.*; logo. **Technique:**
camera projection of one painting (b01's composition, art-directed calmer). **Why not AI:** one picture, one move.

### 9. Pop-up book
**One thing:** a world unfolds from a page. **15 s:** a book opens on a desk; a paper shard pops up (cliffs, a tower,
trees fold upright); the next spread pops up a different world, and the next; on the last the book is a terminal;
logo. **Technique:** flat layers (paper cut-outs on hinges in Blender, real paper texture). **Why not AI:** the
craft look is the point. **Risk:** pop-up rigging is real modelling work.

### 10. The grid fills
**One thing:** scale — a world built by thousands. **15 s:** top-down, one lit square on black; a second appears
beside it, then four, sixteen, hundreds, the counter in the corner racing *1 → 10,000 shards*; each square a tiny
different world; zoom in on one at the end; logo. **Technique:** motion design (a grid of 200 small painted tiles,
animated in HTML). **Why not AI:** a designed system animation; the tiles are small and still.

### 11. Day in the life of a plot
**One thing:** a shard arrives into the world. **15 s:** a locked wide view of one empty plot between highways, cars
passing; time-lapse light (dusk → night); at the beat the shard comes down from above and seats; headlights turn into
it; logo. **Technique:** one generated shot (LTX, as CT2's b06 re-roll, which held its look) or camera projection
with the shard as a separate layer. **Why not AI:** a locked frame and one event.

### 12. Text only
**One thing:** the pitch, said in type. **15 s:** five type cards cut hard on the beat over black with sound design
underneath — *Describe a world.* / *Claude Code builds it.* / *Upload it.* / *Players arrive.* / *Wildshard.* — with one
image only at the end. **Technique:** motion design + one still. **Why not AI:** there is almost nothing generated.

### 13. Six doors
**One thing:** every shard is a different world, side by side. **15 s:** a row of six doors in a white void; each opens
on the beat to a different style behind it; the camera walks through the last door into its world; logo.
**Technique:** camera projection (one void plate, six door paintings). **Risk:** a portal gag is a stock AI idea.

### 14. The hand
**One thing:** a world small enough to hold. **15 s:** a hand sets a little cube of land onto a tabletop grid of other
cubes, between a toon island and a neon city; the camera pushes in until the tiny world fills the frame; logo.
**Technique:** one generated shot (miniature, shallow depth of field). **Risk:** hands are the generator's weakest
point; a real-hand photo plate would be better.

### 15. Before / after split
**One thing:** grey blocks become a world. **15 s:** one locked frame of a shard as a grey blockout; a vertical wipe
line sweeps across left to right on the beat and paints it (CT2's b03 wipe, done properly); caption
*Claude Code builds it.*; logo. **Technique:** stills (the grey render and the painted repaint, pixel-aligned) +
motion design wipe + camera projection push. **Why not AI:** two pictures and a wipe.

### 16. The signpost
**One thing:** the crossroads where worlds meet. **15 s:** a close-up of one wooden signpost at a roundabout, arrows
painted *Driftwood →*, *Nalati ←*, *Nine Dragon ↑*; a new arrow slides in, freshly painted: *Your shard ↓*; pull back
to the four worlds around the roundabout; logo. **Technique:** camera projection of one painting + one designed arrow
animation. **Why not AI:** the gag is a designed insert on one picture.

### 17. Living painting
**One thing:** the art style is the player's. **15 s:** an oil painting of a landscape on an easel, brush strokes
visible; the camera pushes into the canvas and the painting becomes deep (a parallax of its own layers); the edge of
the frame reveals a highway around it; logo. **Technique:** camera projection of a real painterly image with
BiRefNet layers. **Why not AI:** a painting staying a painting.

### 18. Ascii to world
**One thing:** code becomes a place. **15 s:** the Claude Code terminal fills with characters that, seen from far,
form the shape of an island; the characters resolve, glyph by glyph, into the painted island (a dissolve by
luminance); logo. **Technique:** real capture + motion design (glyph mosaic of the painting, by luminance) + one still.
**Why not AI:** an authored effect over real text.

### 19. One night on the highway (sound-led)
**One thing:** the world is alive at night. **15 s:** black screen, sound only — engine, tyres, a radio — then the
windscreen view of the highway at night in one held frame with moving headlight streaks; a sign *Nine Dragon Stack
2 km*; logo. **Technique:** one painting + motion-design light streaks + sound. **Why not AI:** mostly sound.

### 20. The blueprint
**One thing:** your idea, built. **15 s:** a technical blueprint of a shard (white lines on blue: plan, elevation,
tower, river), annotations writing themselves; the blueprint lines lift into 3D and the colour floods in from the
tower outward; logo. **Technique:** motion design (the blueprint) → wipe to a still with camera projection.
**Why not AI:** linework animation + one picture.
