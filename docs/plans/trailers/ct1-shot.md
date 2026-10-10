# CT1 — the cinematic bake-off: one shot, ten experiments (TRAILERS Part B, E466)

Jake (2026-10-10): *"Can we build the top 10 experiments?"* Every experiment makes **the same shot** so the results
compare on one labelled board. Research: [research-2026-10-09.md](research-2026-10-09.md). Image models: Qwen-Image-2.1
and OpenAI Image 2.5, no licence caveat (Jake). All video models run locally on the M5 Max (CT0: no paid cloud model).

## The shot: a shard docks into the grid (~6 s)

- **What happens:** dusk, a deep-blue sky with the first stars. Below, the endless grid of shards from the concept art
  (`docs/design/mmo/concept-art/shard-grid-overview.jpg`): square biome cells (desert mesas, snow peaks, pine forest,
  a violet crystal field, a volcanic badland), divided by glowing blue-violet lattice walls of light. One cell is
  empty: a dark square with nine beacons (four corners, four edge midpoints, the centre). A newly built shard — a
  floating cube of land (a grassy top with a hill, pines and a small stone tower; rock-and-earth sides with hanging roots)
  — descends out of the sky into the empty cell. As it seats, the nine beacons flare and the lattice around the cell
  lights up.
- **Camera:** starts low beside a neighbouring cell's edge, looking up at the shard coming down against the sky;
  cranes up and back over the 6 s, ending on a wide three-quarter aerial of the grid with the shard locked in.
- **Format:** 1280 × 704 (sides ÷ 32), 24 fps, **145 frames** (8n + 1, 6.04 s). The final may upscale; tests stay here.

## Folders (`$CT = <wildshard-0 scratchpad>/ct1`)

| Path | What | Written by |
|---|---|---|
| `$CT/blockout/grey/%04d.png` | the Blender grey render (clay, flat light), frames 0001–0145 | #1 |
| `$CT/blockout/depth/%04d.png` | camera depth, near = white, one range for the whole shot | #1 |
| `$CT/blockout/normal/%04d.png` | camera-space normals | #1 |
| `$CT/blockout/{grey,depth,normal}.mp4` | the same as 24 fps video | #1 |
| `$CT/keyframes/{qwen,openai}-{first,last}.png` | frames 0001 and 0145 repainted in the concept-art look | #2, #3 |
| `$CT/capture/` | an alpha in-engine capture used as the source instead of Blender | #6 |
| `$CT/results/<nn>-<name>/` | each experiment's output: `out.mp4` (24 fps, 1280 × 704 where it can) + `notes.md` (settings, timings, what broke) | each lane |
| `$CT/lane-<name>/` | a lane's private scratch; **a lane deletes only inside its own folder** | each lane |

Inputs are read-only to every lane but their writer. Every model load runs under `lockf -k ~/projects/localai/.model.lock`
(one local model at a time, machine-wide).

## The ten experiments

| # | Experiment | Engine | Lane |
|---|---|---|---|
| 1 | Blender grey blockout + depth / normal passes, the camera directed in Blender | Blender 5.2 | wildshard-0 |
| 2 | Style keyframes (first + last) from the grey frames | Qwen-Image-2.1 edit | wildshard-0 |
| 3 | The same keyframes | OpenAI Image 2.5 (codex `image_gen`) | wildshard-0 |
| 4 | Every frame repainted from the grey (fixed seed, on twos at 12 fps, deflicker) | Qwen-Image-2.1 | wildshard-0 |
| 5 | A keyframe every 8–12 frames, propagated by EbSynth with the depth / normal guides | jamriska/ebsynth (+ Qwen) | lane C |
| 6 | An alpha in-engine capture as the source, repainted in the concept look | capture rig + Qwen | lane C |
| 7 | Image-to-video from a keyframe | Wan 2.2 I2V (mlx-gen) | lane W |
| 8 | Grey → video with depth control + a keyframe reference | Wan VACE | lane W |
| 9 | Grey playblast + a look still → render | LTX-2.5 + Layout-To-Render IC-LoRA | lane L |
| 10 | Image-to-video from a keyframe (+ depth control if it fits) | LTX-2.5 | lane L |

Board: `art/trailers/round-1-bakeoff/` (JPEG stills + a labelled A–J contact video kept outside git, sent to Jake).
