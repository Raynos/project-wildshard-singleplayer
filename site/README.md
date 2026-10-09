# site/ — the Project Wildshard home page

The marketing site ([MARKETING-SITE](../docs/plans/MARKETING-SITE.md), E465): the story of the MMO, the shards you can
play today, how a shard is made in Claude Code, and the author door. The fourth website in this repo, next to the game,
`admin/` and `drafts/`. It imports nothing from the game layers.

- `index.html` — the page (seeded from the round-2 mockup, `art/marketing-site/round-2-merge/`).
- `public/media/` — small WebP copies of real in-engine captures (and the labelled concept art).
- `pnpm build:site` → `dist-site/`; `pnpm deploy:site` ships HEAD to `https://wildshard-site.vercel.app` (public).
