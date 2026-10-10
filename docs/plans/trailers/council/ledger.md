# TRAILERS Part B council — the frozen ledger (2026-10-10)

What is settled. A seat may reopen an item only with new evidence (a file and line, a quote, a frame) that it is wrong.
Preference is not evidence (docs/process/COUNCIL.md).

## Jake's decisions and words, dated

1. **Two trailers.** An alpha in-engine trailer (done, live on wildshard.io) and a cinematic **vision** trailer that does
   not use in-engine footage as footage (E466, 2026-10-09).
2. **Local models only for video**; no paid cloud video model (CT0, 2026-10-09). Image models: **Qwen-Image-2.1 and
   OpenAI Image 2.5, no licence caveat** (2026-10-09: *"Use qwen image it's a trailer fuck off with non commercial"*).
3. **Blender is the layout and camera, never the final look** (2026-10-09: *"making a video in Blender is going to be
   absolute dog shit"*); its grey render is the input a model paints.
4. **CT1 verdicts (Jake, 2026-10-10, on the board):**
   - #7 Wan image-to-video *"barely moves"*; #8 Wan VACE *"failed"*: both out.
   - #6 per-frame repaint of the alpha capture: *"the remaster itself works, but the movement and the frame-by-frame
     drift, it's too jarring"*: per-frame methods (#4, #5, #6) out as the main method.
   - #10 OpenAI keyframe → LTX: *"surprisingly good"*.
   - **#9 (LTX Layout-To-Render on the Blender grey) and #10b (LTX animating the Qwen keyframe) *"look way better than
     experiment 10 … that movement on the gray and that 10B experiment, that's producing way better results"*.**
   - #1 (the grey blockout on its own) reads as nothing: *"I can't really tell what I'm supposed to be looking at"*.
     It is an input; a board must never show it as a result without its painted output beside it.
5. **The look follows the engine, not the concept painting** (2026-10-10): *"way too heavily built around the concept
   art … What we actually did in the alpha in-game is we have the road network instead … the fact that there is a
   highway and not this blue is really important"*. Shards are divided by the **15 m server-owned highway**
   (docs/design/mmo/VISION.md §The world), with a road entry at each edge's midpoint; **no glowing lattice walls**.
6. **Concept art inspired by the six shards built in engine** is a bonus (2026-10-10): Driftwood Isle (toon),
   Nalati Grasslands (painterly), Pine Hollow (photoreal), Signal Dunes (dusk), Sky Reach (golden hour), Nine Dragon
   Stack (neon). Each shard keeps its own style (AGENTS.md / JAKE.md).
7. **Placement:** on wildshard.io **beside the alpha trailer** in "The world"; the alpha trailer stays the main one.
   Labelled **"Concept trailer · not gameplay"** at its start and end (MARKETING-SITE §1.1 honesty rules).
8. **Jake's process:** he gave his feedback and left: *"use your own judgment … run a council over the experiments …
   I want to see the first draft of the cinematic trailer plan"* (2026-10-10).

## Givens from the evidence

- LTX-2.5 runs locally on the M5 Max under ComfyUI on MPS (patched #15804): image-to-video ~5 min per 6 s shot
  (64 GB peak), Layout-To-Render with the grey video + a look still (results/09-ltx-layout/notes.md).
- The model lock serialises every local model run machine-wide; queues of 7–9 jobs happen.
- The vision (VISION.md): one world of 500 m shards stitched by the highway; the upload ritual (nine beacons, ~30 s);
  shards built by players in Claude Code; cars on the highway, a hoverboard, auto-pathing.
