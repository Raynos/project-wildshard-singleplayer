# T15 V1 · Prompt to glyphs (TRAILERS §3b, E471)

A real Claude Code session typed and answered, then its own characters fly into a coarse monospace mosaic of the island
it described, which resolves cell by cell into the painting (`art/trailers/round-4-t15/v1-glyphs/island.jpg`).

- **The session** (`progress/trailers/t15-v1-lighthouse-session.cast`): recorded 2026-10-10 in a scratch folder holding
  a three-file stub shard (`CLAUDE.md`, `sdk.d.ts`, a placeholder `world.ts`), with
  `asciinema rec --window-size 76x22 --idle-time-limit 1.5 -c 'claude --setting-sources project,local --permission-mode acceptEdits --model sonnet'`
  (user settings off, so no personal hooks show), the prompt typed key by key:
  *a small island with a crooked lighthouse and a toon sea*. Claude Code read the folder and wrote `world.ts`.
- **The island**: OpenAI Image 2.5 (codex image_gen), prompted from that `world.ts` (round island, wide beach, crooked
  lighthouse, palms, rock, rowboat, teal toon sea; flat-shaded low-poly, midday, nothing else).

```bash
V=<scratch>/v1-glyphs; P=scripts/steam-trailer/t15/v1-glyphs
<venv with pyte>/bin/python $P/cast_frames.py progress/trailers/t15-v1-lighthouse-session.cast $P/data/cast.js
node -e "const fs=require('fs');fs.writeFileSync('$P/data/island.js','window.ISLAND = \"data:image/jpeg;base64,'+fs.readFileSync('<1920×1080 island.jpg>').toString('base64')+'\";\n')"
SKIP_BROWSER_LANE=1 node scripts/steam-trailer/titles.mjs $V/frames <cards.json: [{"id":"main","card":"main","dur":12}]> --titles-html=$P/glyphs.html
ffmpeg -framerate 60 -i $V/frames/main/%05d.png -c:v libx264 -crf 14 -pix_fmt yuv420p $V/content.mp4
python3 scripts/steam-trailer/t15/assemble.py v1-glyphs <scratch>     # the corner tag, the end card, the mix
```

`cast_frames.py` blanks one row: Claude Code's account usage banner, which is not part of the session.
