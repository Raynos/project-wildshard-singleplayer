# SF68: wildshard-admin, the UI (G248–G251, E462)

The admin site lives in `admin/`: its own `package.json`, Vite config, `tsconfig`s and output (`dist-admin/`), nothing
from the game's `src/` or Vite plugins. It is static: at build time it runs sp-x2's pipeline (`scripts/admin-data.mjs`,
`wildshard-admin/1`, committed blobs only, G250), validates it with `readAdminBundle`, maps it to the page's view
(`admin/tools/view.ts` → `data/bundle.json`, `wildshard-admin-view/1`, types in `admin/src/bundle.ts`) and publishes
the pipeline's content-hashed media plus a poster still per clip (ffmpeg; skipped when absent).

- Build: `pnpm build:admin` (or `pnpm --dir admin build`) → `dist-admin/` (63 MB, mostly the playtest clips).
- Deploy (coordinator only): `bash admin/tools/deploy.sh` builds a clean `git archive HEAD` export and uploads it to
  the Vercel project `wildshard-admin`. It refuses to run until `admin/vercel-project.json` holds the project's ids,
  so the upload can never name a project after its build directory. Unlisted: `noindex` header, meta and robots.txt.
- A local build reads HEAD of the checkout (`committedAdminTree`); the deploy reads its clean export with `ADMIN_REV`
  set to HEAD's full sha (`exportedAdminTree`). A new committed report appears after the next deploy.

## Captures (WebKit, "iPhone 16 Pro", portrait; `capture.mjs` through `scripts/browser-lane.sh`)

Zero page errors, zero horizontal overflow at 402 px.

| File | What |
|---|---|
| 01-memory-pine-centre.jpg | Pine centre: 1,185 MB, 185 over; Total / GPU / RAM bars by owner with the 1,000 MB cap line; estimated hatched, unattributed striped grey |
| 02-memory-owner-drilldown.jpg | Owner list with measured / estimated / unattributed split; Engine & game drilled to its assets (M/E badges, GPU/RAM) |
| 03-memory-ram-owners.jpg | RAM only |
| 04-memory-compare.jpg | Pine centre (0e6d699) minus Nalati centre (65106ea): total, GPU, RAM and per-owner deltas |
| 05-memory-missing-pose.jpg | SF64 Far Reach centre: not measured, with the report's own reason |
| 06-loading-empty.jpg | Loading explorer empty state until SF67 lands |
| 07-playtest-top10.jpg | Round 2's top 10, item 1 open |
| 08-playtest-gallery.jpg | Clip gallery with build-time poster stills; tap opens a full-screen player |
| 09-plan-effort.jpg | SHARD-PLATFORM 53 % by effort, Part A / M1–M3, each shard toward 80/20 |
| 10-plan-rows.jpg | SF rows: 50 of 106 done, open / closed / all filter, tap a row for its done-when |
| 11-plan-decisions-search.jpg | G1–G251 search ("admin" → G248–G251) |
| 12-memory-light.jpg | Light mode |
