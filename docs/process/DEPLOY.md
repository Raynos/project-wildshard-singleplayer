# Deploy

Linked from [AGENTS.md → Deploy](../../AGENTS.md). Moved from AGENTS.md by E423 (2026-10-03).

- `.github/workflows/deploy.yml` runs the gates on every push and pull request. Production
  deploys at :17 each hour or from `gh workflow run deploy`; the job skips if
  `/version.json` already reports `main`'s short SHA. `gh workflow run deploy -f force=true`
  redeploys the same commit. The job builds Vercel output in GitHub Actions and uploads it
  with `vercel deploy --prebuilt`, so Vercel does not repeat the build.
  `VERCEL_BUILD_TOKEN` is the team-scoped Actions secret used for `vercel pull`,
  `vercel build` and `vercel deploy`; the old project-scoped token cannot run the
  CLI account lookup. No credentials belong in Git.
- **GitHub drops the :17 schedule** under load, with no error (2026-10-02/03: one run every 4–6 h). A launchd agent on
  Jake's Mac is the backstop (E403): `scripts/deploy-backstop/backstop.sh` runs at :47 every second hour and dispatches
  the deploy when no scheduled run started in the last 119 minutes. `scripts/deploy-backstop/install.sh` (re)installs
  it; the log is `~/.wildshard/deploy-backstop/backstop.log`; `backstop.sh --dry-run` only reports.
- **Production ships the newest CI-green `main`** (Jake, 2026-10-02: "fix the deploy, whatever it takes"). The hourly
  or manual release reads `.github/deploy-pin.json`: mode `newest-ci-green` picks the newest main commit whose push
  `deploy` run (typecheck, lint, test, build) passed. `gpu-gate` still reports on every push but does not hold a release
  (its push runs cancel each other under the agents' push stream). `mode pinned` (`deploy-pin.mjs set` / `rollback`)
  freezes production on one SHA; `mode newest-green` waits for gpu-gate.
- After every push, watch that push's CI run. After
  the next hourly or manual deployment, confirm `https://wildshard-singleplayer.vercel.app/version.json` reports the
  shipped short SHA and record the build ID in the ask file. A green push means verified in GitHub, not yet live. If
  the game needs an immediate release, run `gh workflow run deploy` and watch it.
- Do not run `vercel deploy` by hand while CI is healthy. Keep commits and pushes small.
- **Done does not wait for the deploy** ([ASKS.md](ASKS.md)): an ask is done when its commit is on `origin/main` with
  green CI. Add the live build id when the deploy ships it. If `version.json` lags your green HEAD by more than ~2 h,
  check `~/.wildshard/deploy-backstop/backstop.log`, then `gh workflow run deploy` (retry a `HTTP 500` after ~90 s).
- **Deploy from a clean export of HEAD**, never the working tree. Delete the export after.
- **A frozen public URL per version:** `scripts/release-url.sh vX.Y.Z` deploys a clean export of the tag once to its own
  Vercel project (the main project's aliases sit behind deployment protection). Tag first and bump package.json.
- **A branch preview** deploys to its own Vercel project, never the main `wildshard-singleplayer` one.
