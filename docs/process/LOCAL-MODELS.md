# Local models: music, SFX, 3D, mockups

Linked from [AGENTS.md → Local models](../../AGENTS.md). Moved from AGENTS.md by E423 (2026-10-03). Read it before you
generate any asset.

The game's music, sound effects and 3D models are generated **on this Mac** (M5 Max, 128 GB unified memory), not in
the cloud. Mockups are the exception: they still come from codex. Two repos next to this one hold all of it:

- **[`~/projects/weights`](../../../../weights/)** is the machine's one weight store.
  - [`MODELS.md`](../../../../weights/MODELS.md) lists what is downloaded, with sizes and licences.
  - Add a model only with `bin/fetch-repo.sh <org/repo>`: it resumes and checks sha256. Never use `hf download`, and
    never copy weights into a tool's folder.
  - Never `git add` a weight ([its AGENTS.md](../../../../weights/AGENTS.md)).
- **[`~/projects/localai`](../../../../localai/)** says how to run each model, how fast it is and what breaks.
  - [`docs/music-models.md`](../../../../localai/docs/music-models.md): music and SFX.
  - [`docs/3d-models.md`](../../../../localai/docs/3d-models.md): image → 3D.
  - [`docs/engines.md`](../../../../localai/docs/engines.md): the local LLM servers. The Qwen3.8-27B LLM is for coding
    agents, not for assets.
  - [`project/LANDMINES.md`](../../../../localai/project/LANDMINES.md): traps that already cost hours. Read it before a
    new setup.

| Job | Engine | Weights (`~/projects/weights/manual/…`) | Runs from | Licence / credit |
|---|---|---|---|---|
| Music | **MiniMax Music 3** (diffusers, MPS bf16) | `MiniMaxAI/MiniMax-Music3` | `~/ml/music/minimax-music3/.venv` + `scripts/music/gen/gen_minimax.py` | credit "Music: MiniMax-Music3" in game |
| SFX, take 1 | **MOSS-SoundEffect v2** (MPS bf16) | `OpenMOSS-Team/MOSS-SoundEffect-v2.0` | `~/ml/music/sfx/MOSS-TTS/moss_soundeffect_v2` + `scripts/music/gen/gen_sfx_moss.py` | Apache-2.0 |
| SFX, take 2 | **Stable Audio 3 Medium** (MPS fp32) | `cocktailpeanut/stable-audio-3-medium` | `~/ml/music/sfx/stable-audio-3` (`uv run`) + `scripts/music/gen/gen_sfx.py --model medium` | "Powered by Stability AI" |
| SFX, the pick | the better take per sound (CLAP rank) | — | `scripts/music/gen/sfx_merge.py` → `public/assets/sfx/best/` | both credits |
| 3D props / creatures | **TRELLIS.2-4B** (MPS), then a Blender post | `microsoft/TRELLIS.2-4B` + TRELLIS-image-large, DINOv3, BiRefNet | `~/ml/img2mesh/trellis-mac/.venv` + `scripts/img2mesh/` ([README](../../scripts/img2mesh/README.md)) | MIT. **Hunyuan3D-2** (`~/ml/img2mesh/Hunyuan3D-2`) is equally allowed and faster: use whichever gives the better model |
| Mockups, fidelity | **codex `image_gen`** (OpenAI, cloud, ~3 min + upload): see [MOCKUPS.md](MOCKUPS.md) | — | `codex exec` / `scripts/horizon-matte/run_codex.py` | — |
| Mockups, fast local | **Qwen-Image-2.1 + turbo LoRA** (7B, diffusers MPS bf16, 6 steps, **~20–35 s**), + an edit mask for localised edits. The only local model that felt decent in the E104 bake-off ([scoreboard](../../art/local-image/round-2-bakeoff/README.md)) | `Qwen/Qwen-Image-2.1` + `Viggle/Qwen-Image-2.1-viggle-turbo` | **`scripts/mockup-local.sh`** ([how-to](../../../../localai/docs/image-models.md)) | research licence: fine for mockups, never for shipped art |

- **One model at a time, machine-wide.** Other agents (herdr panes making music, SFX and 3D for the other shards)
  load models on this same box.
  - Every load runs under `lockf -k ~/projects/localai/.model.lock` and waits until anonymous memory is below 70 GB.
    Use `~/projects/localai/bin/img2mesh/run-locked.sh <log> <cmd…>`, or `~/ml/imagegen/run-locked.sh`.
  - `pgrep -fl "lockf -k"` shows the queue.
  - Keep a batch under 30 minutes so the others get their turn.
- **`~/projects/localai/bin/evict.sh` unloads every LLM server on the box**, other agents' included. A music, SFX, 3D
  or image batch frees its memory when its python exits, so it needs no evict.
- **Check the licence before a new model**: read the card *and* its LICENSE file.
  - Non-commercial or research-only means it is not for the game. **Territory limits don't matter**: the game ships in
    North and South America only (AGENTS.md), so never raise a territory licence caveat.
  - Then fetch it with `fetch-repo.sh`, add a `MODELS.md` row, and write down its speed and memory in a localai doc.
- **Blender models: the script is the source, the GLB is committed, a `.blend` never is** (M10, E315;
  [why](../design/blender-practice.md)). A Blender model is a headless `bpy` script in `scripts/blender/<slug>/` with a
  row in `scripts/blender/targets.json`. Build it with `bash scripts/blender/build.sh <target>` (Blender 5.2.1,
  `--python-exit-code 1`, the model lock) and commit the GLB. `--check` rebuilds and compares with the committed GLB;
  `--save-blend` puts an inspection `.blend` in `~/.cache/wildshard-blender/`. `scripts/check-model-sources.mjs` (in
  `pnpm test`) refuses a Blender GLB with no script, an orphan script and a tracked `.blend`.
- **Where a shard's generated assets go:** its own folders, `public/assets/<slug>/`, `public/assets/music/<slug>/`,
  `public/assets/sfx/<slug>/` (and the folders in its manifest's `assetGlobs`). Its code loads them by those paths;
  an `/assets/…` path outside them fails `wildshard/shard-sandbox`. A model it shows is a `defineModel` row in
  `src/shards/<slug>/models/` and a `live(model)` entry in its `roster.ts` (`#engine`).

## Audio engines (Jake, 2026-09-23)

- **Music: MiniMax Music 3**, generated locally (weights in `~/projects/weights`). New music is made with it and
  nothing else; the in-game credit "Music: MiniMax-Music3" is a licence condition.
- **Sound effects: every sound is generated twice**, once with **MOSS-SoundEffect v2** and once with
  **Stable Audio 3 Medium**, and **the better take of the two ships**, picked per sound. The game has one merged
  set, not a set per model. Both credits show ("Powered by Stability AI" is a Stability licence condition).

## Choosing a model

- **Newest models first** (Jake, 2026-09-24): generative flows use open models released in the last ~2 months; older
  ones are comparison points only. State the release date next to every model you recommend, and search for anything
  newer before settling.
- **Licences:** the game ships in North and South America only, so a territory clause never matters (Hunyuan3D is as
  allowed as TRELLIS.2). Only non-commercial / research-only terms matter, and only for shipped assets: a
  research-licensed model is fine for mockups (Jake: "research only is fine. It is just mockups"). Never raise a
  territory caveat.
