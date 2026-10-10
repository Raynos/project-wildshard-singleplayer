# Steam trailer (E168)

A 45 s wishlist trailer, 15 s per shard (Driftwood Isle · Nalati Grasslands · Pine Hollow), shot in engine and cut to a
MiniMax Music 3 score. This is a clean-room pipeline. The older `scripts/trailer/` (the 15 s / 30 s cuts of 2026-09-18)
is not used.

## How it is made

| Step | Script | What it does |
|---|---|---|
| Score | `steam-jobs.json` → `scripts/music/gen/gen_minimax.py` | One 60 s epic orchestral cue, 4 seeds. Take **204** is used: a quiet open, the band enters, a drop, a percussion hit, a full peak, a break, then a final hit. Check it with `music_scan.py` (loudness per second, beats, hits) and `music_stems.py` (htdemucs: vocal share, stems). |
| Sound design | `sfx-jobs.json` | 8 trailer families (whoosh, braam, riser, impact, sub drop, reverse cymbal, sword, gallop). Each one is generated with MOSS-SoundEffect v2 **and** Stable Audio 3 Medium, and the better take by CLAP rank is used (AGENTS.md "Audio engines"). |
| Shots | `shots/{driftwood,nalati,pine}.mjs` | Each shot is a URL (shard, time of day, weather, boss / elite / ride harness params) plus in-page `setup` / `afterWarm` / `tick`. It either drives a spline camera rig or drives the player's own inputs (sword combo, horse archery, crossbow). `waitFor` waits for a boss to spawn; `probe` records what the shot found. |
| Capture | `capture.mjs` | Loads each shot group from a **`vite preview` of a clean export of HEAD** (:5190). The dev server's HMR reloads every open page when anyone edits `src/`. The capture gates the frame loop and replaces the clock with a fixed step. `performance.now` / `Date.now` follow the same virtual time, so animals and the gallop bob run at sim speed. Frames render at **3840×2160** (Render scale native, dpr 2) at **120 Hz** (2 sub-frames per 60 fps frame), with the HUD, lock-on, chunk-boundary lines and the viewmodel on rig shots hidden. `speed` < 1 gives true in-engine slow motion. `--dry` writes 3 stills per shot (the scouting pass). `--edl` writes only the frames the cut uses. |
| Cut | `cut.mjs` | The single source of truth: the clip table on the score's hits, the titles and every sound cue (the game's own SFX on the picture's events, the trailer hits on the shard changes, the reveals and the end card). It writes `edl.json`, `titles.json` and `mix.json`. |
| Titles | `titles.html` + `titles.mjs` | Per-shard lower thirds and the end card in the game's glass identity (Rajdhani / JetBrains Mono, cyan hairlines), rendered as transparent 60 fps PNG sequences from a pure `pose(card, t)`. |
| Mix | `mix.py` | Splices the score (25 ms equal-power joins) and adds the ambience beds, the events and ducking, then a two-pass loudnorm to **−14 LUFS / −1 dBTP**. |
| Conform | `edit.mjs` | Per clip: tmix over the sub-frames (180° shutter motion blur), a Lanczos 4K → 1080p downscale (supersampled AA, full-res chroma), a light per-shard finishing grade and flash-frames on the shard changes. Then concat, vignette and fine grain, the titles on top, and **H.264 High 1080p60 CRF 14** (~30 Mb/s) with AAC 320k. |

## Re-shoot after the game changes

```bash
SP=<scratch dir>
git archive HEAD | tar -x -C $SP/build && node scripts/link-node-modules.mjs $PWD $SP/build
(cd $SP/build && npx vite build && npx vite preview --port 5190 --strictPort) &
node scripts/steam-trailer/cut.mjs $SP/cut <take-204.wav> <sfx best dir>
node scripts/steam-trailer/capture.mjs $SP/frames --shots driftwood --edl $SP/cut/edl.json   # one process per shard, ≤ 3 browsers
node scripts/steam-trailer/titles.mjs $SP/titles $SP/cut/titles.json
~/ml/music/analysis/.venv/bin/python scripts/steam-trailer/mix.py $SP/cut/mix.json $SP/mix.wav
node scripts/steam-trailer/edit.mjs $SP/frames $SP/cut/edl.json $SP/titles $SP/mix.wav $SP/wildshard-steam-trailer.mp4
```

A capture is ~70 s of rendering per 4 s shot (4K, 2 sub-frames) plus the boot, and ~1 GB of JPEG per shot.

## Credits carried on the end card

- "Music: MiniMax-Music3" (a licence condition).
- "Sound effects: MOSS-SoundEffect v2 · Stable Audio 3 — Powered by Stability AI" (a Stability licence condition).
- "Captured in engine".

## The alpha trailer (E466, TRAILERS Part A)

The ~63 s alpha trailer on wildshard.io: the six shards in engine, a real Claude Code session beside the Sky Reach
time-lapse, the grid fly-in, and "alpha" said three ways (the opening card, the corner bug, the end card). Its cut is
`cuts/alpha.mjs` (MiniMax take 304 of `alpha-jobs.json`), its shots `shots/{driftwood,nalati,pine,nine-dragon,dunes,
sky-reach,grid}.mjs`, its build beat `build-beat.mjs`. Keep every output in one private folder (`$T`); a subagent gets
its own folder, never yours.

```bash
T=<scratch>/trailer
scripts/serve-build.sh --head --name trailer                       # prints the preview URL (BASE below)
~/ml/music/minimax-music3/.venv/bin/python scripts/music/gen/gen_minimax.py --jobs $PWD/scripts/steam-trailer/alpha-jobs.json \
  --keys trailer/alpha --seeds 304 --out $T/score                 # under lockf -k ~/projects/localai/.model.lock
# trailer SFX: gen_sfx_moss.py + gen_sfx.py --model medium on sfx-jobs.json (whoosh, braam, riser, impact, subdrop,
# reverse), then sfx_pick.py --out $T/sfx-best; link tr-<family>.wav → tr-tr-<family>.wav (the picker doubles the prefix)
asciinema rec --window-size 92x44 --idle-time-limit 2 -c 'claude' $T/build-beat.cast   # a real session in a scratch worktree
node scripts/steam-trailer/build-beat.mjs $T/build-beat.cast $T/build-beat.mp4 --dur 8.13
node scripts/steam-trailer/cut.mjs $T/cut $T/score/trailer-alpha/minimax3-304.wav $T/sfx-best --cut alpha \
  --build $T/build-beat.mp4 --bug $T/titles/bug.png
node scripts/steam-trailer/titles.mjs $T/titles --preview bug.json   # [{"id":"bug","card":"bug","dur":1,"at":0.5}]: the bug still
node scripts/steam-trailer/titles.mjs $T/titles $T/cut/titles.json   # both through the browser lane
scripts/browser-lane.sh node scripts/steam-trailer/capture.mjs $T/frames --shots driftwood,nalati,pine,nine-dragon,dunes,sky-reach,grid \
  --edl $T/cut/edl.json --base <BASE>
~/ml/music/analysis/.venv/bin/python scripts/steam-trailer/mix.py $T/cut/mix.json $T/mix.wav
node scripts/steam-trailer/edit.mjs $T/frames $T/cut/edl.json $T/titles $T/mix.wav $T/wildshard-alpha-trailer.mp4
# the site: 30 fps trailer-1280.mp4 (~1.3 Mb/s, AAC 128k) + trailer-720.mp4 (~0.6 Mb/s, AAC 96k) WITH the mix — the page
# autoplays it muted, its controls unmute it (Jake, 2026-10-10) — in a folder, then
node site/tools/publish-media.ts <folder>                          # keeps the shard loops; the poster is the alpha card frame
```

The alpha end card adds "Built with Claude Code" to the credits above.
