# site/ — the Project Wildshard home page

The marketing site ([MARKETING-SITE](../docs/plans/MARKETING-SITE.md), E465): the story of the MMO, the shards you can
play today, how a shard is made in Claude Code, and the author door. The fourth website in this repo, next to the game,
`admin/` and `drafts/`. It imports nothing from the game layers.

- **`COPY.md` — every word on the page.** Edit the text under any `## Heading`; keep the heading. The build fills the
  page from it (`tools/copy.ts`) and stops on a missing, unused or duplicated heading (`test/site-copy.test.ts` too).
- `index.html` — the page template: layout, styles and `{{Heading}}` slots, no prose (seeded from the round-2 mockup).
- `public/media/` — small WebP copies of real in-engine captures (and the labelled concept art).
- `pnpm build:site` → `dist-site/`; `pnpm deploy:site` ships HEAD to `https://wildshard-site.vercel.app` (public).
