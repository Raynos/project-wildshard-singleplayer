# CT2 — the cinematic concept trailer: script and shot list (TRAILERS Part B, E466)

Draft (2026-10-10), from §3.1's first script and what CT1 taught. **Labelled "Concept trailer · not gameplay"** on the
first and last card. ~66 s, 16:9, 1280 × 704 generated, finished at 1920 × 1056 (upscaled), 24 fps.

## How every shot is made (CT1's winner, pending Jake's pick)

1. **A keyframe** in the concept-art look: OpenAI Image 2.5 (codex `image_gen`, parallel, remote) or Qwen-Image-2.1
   (local), always with `docs/design/mmo/concept-art/shard-grid-overview.jpg` as the style reference and one shared style
   line: *dusk-to-night palette, deep-blue starry sky, glowing blue-violet lattice light, painterly-realistic concept art,
   cinematic lighting, atmospheric depth, no text, no UI*.
2. **LTX-2.5 image-to-video** from it, 4–6 s (97–145 frames), the shot's motion in the prompt (~5 min per shot on the M5
   Max under the model lock; CT1 #10).
3. **What the research says to respect:** one motion per shot; the camera carries the movement; big rigid things
   (land, cliffs, towers, the lattice) hold, limbs and faces don't — figures stay small, far and slow; short shots and
   more cuts beat long uniform ones; never the same slow push-in twice in a row.
4. **Text is never generated.** The typed sentence, the captions and the end card are crisp overlays (`titles.html`).

## The shots

| # | t (s) | Shot | Keyframe | Motion (LTX prompt) |
|---|---|---|---|---|
| 1 | 0–4 | **The void.** Deep space, stars; one small glowing violet cube of light hangs in the dark (the Cell mark as an object) | a lone glowing cube in a starfield | slow push-in, the cube pulses once |
| 2 | 4–8 | **The prompt.** An author at a desk at night, seen from behind, a monitor's glow on them, the screen a soft blur of a terminal | over-the-shoulder, the screen unreadable, warm and violet light | very slow push toward the screen. Overlay: the typed line `> a floating fortress on a cube of land — pines, a stone tower, dusk` |
| 3 | 8–13 | **The shard forms.** In the void, light particles swirl into a floating cube of land: rock, a grassy top, pines, a stone tower | the finished floating shard in the void, motes of light around it | particles stream in and settle; the camera arcs a quarter turn |
| 4 | 13–17 | **The author walks it.** Golden hour on the new shard: a small cloaked figure walks the cliff edge toward the tower | wide, the figure small, long shadows | slow sideways dolly, the figure walks |
| 5 | 17–21 | **The upload ritual.** Nine beacons ignite round the shard — corners, edge midpoints, centre — beams into the night | the shard at night, nine pillars of light | the beams flare up one after another, the camera rises |
| 6 | 21–26 | **Lift-off.** The shard rises up through the clouds into the stars | the shard above a cloud sea, beams below | the shard rises, the clouds fall away |
| 7 | 26–32 | **It docks.** The shard comes down into the empty cell of the glowing grid (CT1's shot) | CT1's keyframe | CT1 #10 (or its re-render) |
| 8 | 32–36 | **The grid wakes.** Light runs outward along the lattice seams from the new cell | a wide aerial of the lattice at night | pulses of light race along the seams; a slow pan |
| 9 | 36–40 | **Across a seam (1).** A lone rider crosses a wall of lattice light from golden grassland into a snowy pine forest | low, the rider small, the wall of light between two biomes | the rider passes through the light; the camera tracks |
| 10 | 40–44 | **Across a seam (2).** A desert caravan at dusk passes through a lattice wall into a neon vertical city | the caravan small against the neon city beyond the light | slow tracking, lanterns sway |
| 11 | 44–48 | **Sky islands.** Floating islands at golden hour, rope bridges, a great bird | wide | the bird glides across; the camera drifts |
| 12 | 48–52 | **The frozen fjord.** Aurora over sea ice; a lone figure with a lantern | wide, the figure tiny | the aurora ripples; a slow push |
| 13 | 52–56 | **The frontier.** A jungle volcano, lava glow, a party of explorers on a ridge (the second concept painting) | from the concept painting `jungle-volcano-frontier.jpg` | embers drift, the camera cranes up |
| 14 | 56–61 | **The pull-out.** Up and back from the frontier: the 5 × 5 grid, then the endless grid to the horizon under stars | the endless grid from very high | a steady crane up and back |
| 15 | 61–66 | **End card.** The lattice light dims behind the card | the grid at night, dark | near-static. Overlay: the Cell logo, *Play it in the browser. Build it in Claude Code.*, wildshard.io, *Concept trailer · not gameplay* |

## Sound

One MiniMax Music 3 cue (~70 s): a sparse synth open for 1–2, a build from 3, the ritual (5) as a rising swell, the
dock (7) on the first big hit, the seams montage (9–13) at full drive, the pull-out (14) as the peak, a ringing end.
Sound design from the trailer set (MOSS v2 + SA3: whoosh, braam, riser, impact) on the cuts; no voice-over.

## Cost (local, from CT1)

13 new LTX shots × ~5 min = ~65 min of model lock; ~15 keyframes (codex, remote, 4–6 at a time, ~4 min each);
the score ~15 min; the cut, mix and conform on the existing pipeline (`cut.mjs`, `mix.py`, `edit.mjs`).
