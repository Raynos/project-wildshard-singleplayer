# T15 council — the frozen ledger (E471)

Settled. A seat may reopen an item only with new evidence (a file and line, a quote).

1. **Draft 1 failed on look.** Jake, 2026-10-10, on the 67 s CT2 draft 1 (`art/trailers/round-3-draft1/board-draft1.jpg`):
   *"it looks insanely AI. It looks really bad. It looks really like AI software clips put together."*
2. **15 seconds, one thing.** Jake, 2026-10-10: *"what if we made a single 15 seconds cinematic trailer? Or even a single
   15 second trailer, full stop … What would be the best 15-second trailer for the concept of Project Wildshard if we just
   focus on one thing?"*
3. **No in-engine footage.** Jake, 2026-10-10: *"We're trying to make a trailer of the game without using in-game engine
   footage."* (The alpha trailer already covers gameplay.)
4. **Four variants, picked by the council from twenty ideas** (`ideas.md`), made, shown to Jake, then reviewed.
5. **What Wildshard is** (VISION, MARKETING-SITE): an endless grid of shards — floating cubes of land — joined by a
   **highway** (two lanes, roundabouts, streetlights, cars; not a glowing lattice, Jake 2026-10-10). **Each shard is built
   by a player with Claude Code**, in its own style (Driftwood toon, Nalati painterly, Pine Hollow photoreal, Signal Dunes,
   Sky Reach, Nine Dragon neon). You play it in the browser. Pitch line: *Play it in the browser. Build it in Claude Code.*
6. **No upload ritual** (Jake 2026-10-09, MARKETING-SITE §7).
7. **Labelled concept.** A trailer that isn't gameplay says so on every frame (*Concept trailer · not gameplay*) and on
   its end card (TRAILERS Part B, council R1C-4).
8. **Blender for whole scenes is out as a final look.** Jake, 2026-10-09: making the video in Blender *"is going to be
   absolute dog shit"*; Blender is for grey layouts that feed a model. (A single modelled object, or Blender used only as
   a camera on a painting, is a judgement call for the seats; say which side of this line an idea falls on.)
9. **Per-frame repaint is out** (CT1 #4–#6: *"way too fucking jarring"*), Wan is out (#7, #8).
10. **Tools on this machine:** LTX-2.5 (image-to-video ~8 min, Layout-To-Render ~12 min per 4–6 s clip, one model at a
    time), OpenAI Image 2.5 via `codex exec` and Qwen-Image-2.1 for stills, MoGe-2 (depth / geometry from one image),
    BiRefNet (cut-outs), Real-ESRGAN, Blender 5.2 headless, Playwright HTML → PNG frames (`scripts/steam-trailer/titles.mjs`),
    the real Claude Code terminal recorder (`build-beat.mjs`), MiniMax Music 3, MOSS-SoundEffect v2 + Stable Audio 3,
    ffmpeg. The four are made in one session, so each must be buildable in roughly 2–4 hours of agent work.
