# Deploy

Linked from [AGENTS.md → Deploy](../../AGENTS.md). Moved from AGENTS.md by E423 (2026-10-03).

- `.github/workflows/deploy.yml` runs the gates on every push and pull request. Production
  deploys at :17 each hour or from `gh workflow run deploy`; the job skips if `/version.json` reports the **selected proven commit**. `gh workflow run deploy -f force=true`
  redeploys the same commit. The job builds Vercel output in GitHub Actions and uploads it
  with `vercel deploy --prebuilt`, so Vercel does not repeat the build.
  `VERCEL_BUILD_TOKEN` is the team-scoped Actions secret used for `vercel pull`,
  `vercel build` and `vercel deploy`; the old project-scoped token cannot run the
  CLI account lookup; `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` name the project. No credentials belong in Git.
- **Push / PR CI runs the whole vitest suite once**, in ten `behaviour` shards (`pnpm gen` then `vitest --shard=N/10`, **without
  coverage**, Jake G287); `typecheck-lint` runs typecheck and lint; `build-and-deploy` runs the node checks and the
  vite build + chunk check in parallel (`scripts/ci-checks.mjs`), then the CSS check and the native build. **Coverage runs nightly and at
  milestones** (`.github/workflows/coverage.yml`: 09:23 UTC, or `gh workflow run coverage [-f sha=<candidate>]`): the
  same 8 shards under `--coverage`, merged with `scripts/coverage-merge.mjs` (the same numbers as one unsharded run),
  then `scripts/coverage-ratchet.mjs`; it holds no release, and a coverage drop is found there, not per push. **A push that only touches
  `docs/`, `progress/`, `art/` or `sources/` runs no push CI** (`paths-ignore`; it would re-test the parent's code): that SHA never becomes a release candidate, and production's
  "newest proven main" is its newest code ancestor, so compare `version.json` with the newest CI-green SHA, not the
  tip. Releases reuse that complete test proof when the
  selected exact SHA has a successful main push-CI run (SF74 W0); they still build and check chunks and verify
  production. A historical pin without that CI proof still runs `pnpm test`. The reader reports `ci_green` separately
  from smoke and pin mode; a nearby commit or successful manual release cannot supply the test proof.
  **CI is the full backstop of the push gate** (Jake, 2026-10-15): the gate runs only the tests that import the changed
  files (GIT.md). The `products` job generates inputs and builds all products once. Behaviour shards restore its
  generated source/public files and `out/` from the same run's artifact, verifying the full SHA, run ID and archive
  checksum. The four typecheck/lint jobs restore that verified preparation too, then run every type project and
  their complete lint partition without repeating cold generation. Their 15-minute deadlines stay unchanged.
  `WS_TEST_PRODUCTS_SHA` keeps test hooks on those exact products; missing or mismatched artifacts fail
  instead of rebuilding. The `behaviour` shards run the whole suite on every code push, so a transitive
  break shows up there first; fix it forward like any red run.
- **CI's vitest is Linux x64 (under coverage in the nightly): other floats, and ~2–2.5× a Mac's time** (ci-green, 2026-10-09; main was
  red for hours on both):
  - **A recorded digest never passes through V8's native transcendentals** (`Math.sin / cos / tan / exp / log / atan2 /
    asin / pow`, or `**` with a non-integer exponent): they round differently on arm64 and x64. Install
    `test/fake/portableMath.ts` for the file (`installPortableMath()`), keep its terrain analytic, and check the digest
    under x64 Node too (Rosetta: `scripts/x64-vitest.sh --setup` once per Mac fetches nodejs.org's darwin-x64 build and
    the matching `@rolldown/binding-darwin-x64` into `~/.local/node-x64`; `scripts/x64-vitest.sh <files>` runs them).
    (The push gate's old `x64-digests` step, SF74 W28, is gone; CI's Linux run is the x64 check.) Comparing two runs inside one
    process needs none of this.
  - **Headless suites' budget:** a test's local time under `--coverage` stays under a third of its timeout (the nightly coverage run uses the same timeouts). A restore
    checkpoint costs 10–20 s under coverage (the string round trip of the native world), so: one checkpoint per test
    (`it.each`), one string round trip per checkpoint, continuations compared with `expectSameSimSnapshot`
    (`test/fake/simSnapshot.ts`), never `toEqual` on whole snapshots nor serialising both sides to compare. A walk tape
    is at most 10k ticks per test, with a 60 s budget.
- **GitHub drops the :17 schedule** under load, with no error (2026-10-02/03: one run every 4–6 h). A launchd agent on
  Jake's Mac is the backstop (E403): `scripts/deploy-backstop/backstop.sh` runs at :47 every second hour and dispatches
  the deploy when no scheduled run started in the last 119 minutes and `deploy-pin.mjs release-slot` proves the shared
  hourly slot is free and `release-ready` finds an eligible BOTH-proof-green candidate under the 20-minute chase bound below.
  Pending proof defers dispatch before that bound without consuming the hour; API or unreadable proof errors refuse it.
  Other configured pin modes retain their release-job proof checks. A recent scheduled/manual release or any
  queued/running release blocks it. Every retry checks
  again, and an API error or unreadable proof refuses dispatch. `scripts/deploy-backstop/install.sh` (re)installs it
  with both gh and Node on launchd's PATH; the log is `~/.wildshard/deploy-backstop/backstop.log`;
  `backstop.sh --dry-run` checks the slot and only reports.
- **Production ships the newest CI-green `main`** (Jake, 2026-10-02: "fix the deploy, whatever it takes"). The hourly
  or manual release reads `.github/deploy-pin.json`: mode `newest-ci-green` picks the newest main commit whose push
  `deploy` run (typecheck, lint, test, build) passed **and whose exact SHA has `boot-smoke = success`**. The separate
  `.github/workflows/boot-smoke.yml` follows successful main push CI (or an explicit SHA dispatch), reuses that exact
  successful main push run's `boot-dist` artifact, and drives every public primary shard to entered, unpaused page-ready
  with ten live gameplay frames. Push CI archives its actual web dist with its full commit, run ID and tar checksum.
  Smoke verifies that provenance and the version stamp before sharing the same bytes with all five browser legs;
  it never regenerates products. Missing or expired artifacts refuse the proof: push a head containing the artifact
  publisher and prove that head; an older run without the artifact cannot supply this proof.
  Cases come from that build's actual title catalogue, excluding hidden levels and frozen copies. Experimental
  primaries (including Signal) use their real Developer entry. While Nine is experimental, its public leg is an
  explicit PUBLIC-POLICY ADMISSION proof (call44): the existing `?chunk=` document fully hydrates Nine to the title
  with Developer off (`data-dev` absent), zero fatal reports, a locked COMING SOON card and the actual initial draw. The title then gates its frame loop.
  It does not claim a public menu or grid entry. The public playing-envelope refusal remains active at `level.world`;
  a pre-`1b39cec67` build must fail that negative. The separate Developer Nine case retains entered gameplay and ten
  live frames. When Nine becomes public, its public case uses the ordinary gameplay entry. The Developer grid proves its home handoff, then a
  real road-to-Signal crossing, entered runtime residency and ten live gameplay frames. One initial road pose uses
  the existing probe; held input and the shipping fixed step perform admission. Home and road each retain a
  90-second budget; a prepared cell or a ready home cannot substitute for Signal entry.
  The initial title has its own 150-second budget. Standalone gameplay starts at
  the real entry action, so cold title loading cannot consume the home proof.
  Grid entry changes documents: its cold preparation has a separate 150-second
  bound through visible home residency. The following 90-second home proof still
  requires every visible ring and ten gameplay frames before the Signal road leg.
  Smoke receipts distinguish drawn frames, fixed ring steps and clock/pause state.
  Five required macOS legs separate public cases, Developer standalones, the grid/Signal road proof,
  Chromium HOVER and WebKit HOVER/rendering (`boot-public`, `boot-developer`, `boot-grid`,
  `hover-chromium`, `hover-webkit`). Each keeps its 20-minute outer deadline. The 2026-10-18
  Developer job spent 9.5 minutes building, passed all seven standalone cases, then exhausted
  the outer deadline before its grid case could finish. The grid now has its own required leg;
  no case, gameplay deadline or failure condition changed. HOVER waits for the loading overlay
  to close within its existing 150-second title budget before tapping the real entry button.
  The `verdict` job requires all five legs before publishing the one `boot-smoke` status (SF74 W16). Fatal UI, page errors and bad asset
  responses refuse the proof. Its macOS queue stays outside push CI's critical path. A scheduled, backstop or manual
  release waits within the same run while a newer CI-green candidate's exact-SHA smoke is pending. A newly completed
  push CI with no smoke status yet gets the same wait (up to 15 minutes after CI completion), covering dispatch and
  queue startup. The selector refreshes candidates and statuses every 30 seconds, with a total 20-minute wait budget.
  Only an exact-SHA successful smoke can supply the pin. A terminal failure or superseded proof may be skipped for an
  older proven build. Under continuous landings, once 20 minutes have elapsed since an older **unshipped** SHA reached
  both push CI and exact-SHA smoke green, select the **newest BOTH-proof-green SHA**. Read the actual proof timestamps;
  each newer pending commit does not restart that bound. A previously shipped build does not start it. If no eligible
  both-proof candidate exists, an unresolved proof at the deadline still refuses selection and names its SHA. Waiting never chooses
  an unproven candidate or consumes another dispatch. The hourly cadence and manual dispatch limit stay unchanged.
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
  dispatches `deploy` only when `release-ready` finds the newest candidate already proven,
  `node scripts/deploy-pin.mjs release-slot` says the hour is free and `version.json` does
  not already serve that selected SHA. An older smoke finishing while a newer proof is pending
  leaves the hour free for that newer completion; otherwise it does nothing and the cron, the backstop or a hand
  dispatch picks the pin up.
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
