# Deploy

Linked from [AGENTS.md → Deploy](../../AGENTS.md). Moved from AGENTS.md by E423 (2026-10-03).

- `.github/workflows/deploy.yml` runs the gates on every push and pull request. Production
  deploys at :17 each hour or from `gh workflow run deploy`; the job skips if `/version.json` reports the **selected proven commit**. `gh workflow run deploy -f force=true`
  redeploys the same commit. The job builds Vercel output in GitHub Actions and uploads it
  with `vercel deploy --prebuilt`, so Vercel does not repeat the build.
  `VERCEL_BUILD_TOKEN` is the team-scoped Actions secret used for `vercel pull`,
  `vercel build` and `vercel deploy`; the old project-scoped token cannot run the
  CLI account lookup. No credentials belong in Git.
- **Push / PR CI runs vitest once, in 8 parallel shard jobs** (E429; 8 since SF74 W16): `typecheck-lint` runs
  typecheck and lint; `build-and-deploy` runs `pnpm run test:checks`' commands (the node checks of `pnpm test`) and the
  vite build + chunk check in parallel (`scripts/ci-checks.mjs`), then the CSS check and the native build; `vitest`
  (matrix 1–8) runs `vitest run --shard=i/8`, **without coverage** (Jake, G287). **Coverage runs nightly and at
  milestones** (`.github/workflows/coverage.yml`: 09:23 UTC, or `gh workflow run coverage [-f sha=<candidate>]`): the
  same 8 shards under `--coverage`, merged with `scripts/coverage-merge.mjs` (the same numbers as one unsharded run),
  then `scripts/coverage-ratchet.mjs`; it holds no release, and a coverage drop is found there, not per push. **A push that only touches
  `docs/`, `progress/`, `art/` or `sources/` runs no push CI** (`paths-ignore`; CI's sparse checkout drops those
  paths, so it would re-test the parent's tree): that SHA never becomes a release candidate, and production's
  "newest proven main" is its newest code ancestor, so compare `version.json` with the newest CI-green SHA, not the
  tip. Releases reuse that complete test proof when the
  selected exact SHA has a successful main push-CI run (SF74 W0); they still build and check chunks and verify
  production. A historical pin without that CI proof still runs `pnpm test`. The reader reports `ci_green` separately
  from smoke and pin mode; a nearby commit or successful manual release cannot supply the test proof.
  **CI is the full backstop of the push gate's cache** (2026-10-09): the gate runs `vitest related` and skips unchanged
  bake / audit steps (GIT.md), so a transitive break the cache missed shows up here first; fix it like any red run.
- **CI's vitest is Linux x64 (under coverage in the nightly): other floats, and ~2–2.5× a Mac's time** (ci-green, 2026-10-09; main was
  red for hours on both):
  - **A recorded digest never passes through V8's native transcendentals** (`Math.sin / cos / tan / exp / log / atan2 /
    asin / pow`, or `**` with a non-integer exponent): they round differently on arm64 and x64. Install
    `test/fake/portableMath.ts` for the file (`installPortableMath()`), keep its terrain analytic, and check the digest
    under x64 Node too (Rosetta: `scripts/x64-vitest.sh --setup` once per Mac fetches nodejs.org's darwin-x64 build and
    the matching `@rolldown/binding-darwin-x64` into `~/.local/node-x64`; `scripts/x64-vitest.sh <files>` runs them).
    The push gate's `x64-digests` step runs the `*-oracle` / `*-tape` / `sim-memory-interval` tests that way on every
    gate (~45 s beside vitest; SF74 W28), and skips green on a Mac without the setup. Comparing two runs inside one
    process needs none of this.
  - **Headless suites' budget:** a test's local time under `--coverage` stays under a third of its timeout (the nightly coverage run uses the same timeouts). A restore
    checkpoint costs 10–20 s under coverage (the string round trip of the native world), so: one checkpoint per test
    (`it.each`), one string round trip per checkpoint, continuations compared with `expectSameSimSnapshot`
    (`test/fake/simSnapshot.ts`), never `toEqual` on whole snapshots nor serialising both sides to compare. A walk tape
    is at most 10k ticks per test, with a 60 s budget.
- **GitHub drops the :17 schedule** under load, with no error (2026-10-02/03: one run every 4–6 h). A launchd agent on
  Jake's Mac is the backstop (E403): `scripts/deploy-backstop/backstop.sh` runs at :47 every second hour and dispatches
  the deploy when no scheduled run started in the last 119 minutes. `scripts/deploy-backstop/install.sh` (re)installs
  it; the log is `~/.wildshard/deploy-backstop/backstop.log`; `backstop.sh --dry-run` only reports.
- **Production ships the newest CI-green `main`** (Jake, 2026-10-02: "fix the deploy, whatever it takes"). The hourly
  or manual release reads `.github/deploy-pin.json`: mode `newest-ci-green` picks the newest main commit whose push
  `deploy` run (typecheck, lint, test, build) passed **and whose exact SHA has `boot-smoke = success`**. The separate
  `.github/workflows/boot-smoke.yml` follows successful main push CI (or an explicit SHA dispatch), builds that exact
  commit and drives the real title, Driftwood gameplay and Developer grid home. It runs as two macOS legs at once (`boot`: title and
  gameplay; `hover`: the touch HOVER mounts), and its `verdict` job publishes the one `boot-smoke` status (SF74 W16). Fatal UI, page errors and bad asset
  responses refuse the proof. Its macOS queue stays outside push CI's critical path. A missing, pending or failing
  latest smoke status excludes that candidate; selection can still return an older proven build. Successful smoke
  completion makes the candidate eligible for the next hourly/manual release; it does not change Jake's hourly
  cadence. An earlier release may correctly select the already-live older build while the new smoke is pending.
  Smoke runs following manual/scheduled releases are intentionally skipped (only push CI or explicit smoke dispatch
  runs the proof), so inspect the run event as well as its SHA. An explicit emergency rollback may instead return to any SHA
  proven previously live in production, even before the smoke existed: verified `production-live` status or a
  successful historical release job's exact full pin plus matching production-version reading. Pin history alone
  is insufficient. The OTA reader enforces the same proof. `force`
  only bypasses the already-live check. Inspect the smoke artifact's queue/run timings when a release waits.
  `gpu-gate` runs nightly and by dispatch at a milestone (`gh workflow run gpu-gate`, `-f sha=<candidate>`), not on
  every push (Jake, 2026-10-09, after the process audit `progress/process/audit-2026-10-09/`), and it does not hold a release. `mode pinned` (`deploy-pin.mjs set` / `rollback`)
  freezes production on one SHA; `mode newest-green` waits for gpu-gate.
- **Any agent may kick the release by hand, at most once an hour** (Jake, 2026-10-09: *"If the hourly cron is not working … agents are allowed to get it deployed out at most once an hour by just kicking it off manually"*): when `version.json` lags the newest proven main
  and no `deploy` release run (schedule or dispatch) started in the last 60 minutes, run `gh workflow run deploy`; never
  a second dispatch inside the hour, and never while a release run is queued or in progress.
  **boot-smoke does the same by itself** (SF74 W16, G284): its `release` job runs after a green exact-SHA smoke of main and
  dispatches `deploy` only when `node scripts/deploy-pin.mjs release-slot` says the hour is free and `version.json` does
  not already serve that SHA; otherwise it does nothing and the cron, the backstop or a hand dispatch picks the pin up.
- **Nobody waits for GitHub after a push** (Jake, E428, 2026-10-03: "waiting 15 minutes for remote GitHub is just too
  slow"). The local gates on a clean export of HEAD are the check; CI and the hourly deploy run on their own. A red CI
  run is fixed by whoever sees it. If the game needs an immediate release, `gh workflow run deploy` (no need to watch it).
- Do not run `vercel deploy` by hand while CI is healthy. Keep commits and pushes small.
- **Done does not wait for the deploy** ([ASKS.md](ASKS.md)): an ask is done when its commit is on `origin/main` with
  the local gates green. Add the live build id when the deploy ships it. If `version.json` lags your green HEAD by more than ~2 h,
  check `~/.wildshard/deploy-backstop/backstop.log`, then `gh workflow run deploy` (retry a `HTTP 500` after ~90 s).
- **Deploy from a clean export of HEAD**, never the working tree. Delete the export after.
- **A frozen public URL per version:** `scripts/release-url.sh vX.Y.Z` deploys a clean export of the tag once to its own
  Vercel project (the main project's aliases sit behind deployment protection). Tag first and bump package.json.
- **A branch preview** deploys to its own Vercel project, never the main `wildshard-singleplayer` one.
