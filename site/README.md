# site/ — the Project Wildshard home page

The marketing site ([MARKETING-SITE](../docs/plans/MARKETING-SITE.md), E465): the story of the MMO, the shards you can
play today, how a shard is made in Claude Code, and the author door. The fourth website in this repo, next to the game,
`admin/` and `drafts/`. It imports nothing from the game layers.

- **`COPY.md` — every word on the page.** Edit the text under any `## Heading`; keep the heading. The build fills the
  page from it (`tools/copy.ts`) and stops on a missing, unused or duplicated heading.
- `index.html`, `play/`, `build/`, `mmo/` and `map/` — the page templates: layout and `{{Heading}}` slots, no prose; `style.css` styles them all.
- `tools/facts.ts` — the numbers (the grid, memory, the schema count), read from the game's own files when the site builds; COPY.md says `{=name}` where one goes.
- `public/media/` — small WebP copies of real in-engine captures (and the labelled concept art).
- `public/map/tiles/` — the world-map concept (`art/world-map/round-4-plots/worldmap.py`, scale 2) as 512 px WebP zoom tiles for `/map/`.
- `pnpm build:site` → `dist-site/`; `pnpm deploy:site` ships HEAD to https://wildshard.io (CI does it on every push to `site/`).
