# Deploy

Linked from [AGENTS.md → Deploy](../../AGENTS.md). Moved from AGENTS.md by E423 (2026-10-03).

- **GM1:** a running push run always finishes and lists every red; never cancel push CI or boot smoke by hand.
- **DA1:** hidden source maps remain in local/CI builds and boot-smoke artifacts for module checks, profiles and stack decoding. A release retains its exact `dist` maps, `version.json` and chunk report in the `production-source-maps-<SHA>` Actions artifact for 30 days, then omits maps only from `.vercel/output/static` before upload. Original build maps survive symlinked Vercel output. Sentry release tagging stays unchanged; there is no existing source-map upload pipeline.
- `.github/workflows/deploy.yml` runs the gates on every push and pull request. Production
  deploys as soon as CI and the exact six pass, or from `gh workflow run deploy`; the job skips if `/version.json` reports the **selected proven commit**. `gh workflow run deploy -f force=true`
  redeploys the same commit. The job builds Vercel output in GitHub Actions and uploads it
  with `vercel deploy --prebuilt`, so Vercel does not repeat the build.
  `VERCEL_BUILD_TOKEN` is the team-scoped Actions secret used for `vercel pull`,
  `vercel build` and `vercel deploy`; the old project-scoped token cannot run the
  CLI account lookup; `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` name the project. No credentials belong in Git.
- **Push / PR CI runs the whole vitest suite once**: twelve duration-balanced `behaviour` shards plus the blocking,
  single-worker `native-escape` job (**without coverage**, Jake G287/G691). The native trusted-input file keeps its
  original deadlines on its own Ubuntu runner, without sibling test or product-build I/O; `typecheck-lint` runs typecheck and lint;
  `prepare` runs the node checks and the
  vite build + chunk check in parallel (`scripts/ci-checks.mjs`), then the CSS check and the native build. **Coverage is reserved for nightly and
  milestone runs** (Jake G287); it is not a normal push-release prerequisite. **A push that only touches
  `docs/`, `progress/`, `art/` or `sources/` runs no push CI** (`paths-ignore`; it would re-test the parent's code): that SHA never becomes a release candidate, and production's
  "newest proven main" is its newest code ancestor, so compare `version.json` with the newest CI-green SHA, not the
  tip. Manual releases reuse completed exact-SHA push proof. Automatic shipping requires every successful
  same-run wave verdict before its own release job can start; it never waits for its own aggregate to finish.
  Prepare packages its tested dist and API functions into
  `.vercel/output`. Release downloads `vercel-prebuilt` from that exact proven source run, verifies the source identity
  and complete archive/member inventory, and runs `vercel deploy --prebuilt`. No app or native rebuild runs during
  ordinary release; missing artifacts refuse. A nearby commit or successful manual release cannot supply the test proof.
  The explicit emergency input `recovery_source_run` is the sole rebuild exception:
  `gh workflow run deploy.yml --ref main -f recovery_source_run=<exact-push-run>`.
  It verifies that completed main push's complete original job inventory, all twelve
  behavior shards, types/docs/prepare, SIX and the latest same-run boot status.
  The dedicated native job is required if it existed in that source. Only the
  already report-only phone leg and shipping may have failed. No status is changed.
  Recovery checks out that exact proven source, installs its frozen dependencies,
  and uses the pre-CI2 `vercel pull` / `vercel build` controller. Both built version
  files must match the full selected commit; private maps, serialized shipping,
  forward-only live floor, production version and API checks remain mandatory.
  An empty recovery input leaves the automatic prebuilt path unchanged.
  **CI is the full backstop of the push gate** (Jake, 2026-10-15): the gate runs only the tests that import the changed
  files (GIT.md). One `prepare` job restores the content-addressed preparation cache, runs generation once,
  builds and admits every product once before its dependent tables, then verifies source publication.
  It packs the exact-run full product/input
  snapshot, then verifies that same archive before the parallel node checks and web build. Native output shares
  those prepared inputs and builds only when native inputs changed. The job packages the tested Vercel output and
  smoke projections; neither release nor wave jobs regenerate or rebuild. Types/lint/docs and the behavior
  matrix consume the same `test-products` snapshot after prepare succeeds. Every reader verifies the full SHA,
  run ID, archive checksum and inventory before accepting bytes. `scripts/vitest-ci.config.ts` discovers the parallel
  files across isolated and explicitly reviewed pure projects; `scripts/vitest-native-escape.config.ts` selects
  only the native Escape file. Their disjoint union equals ordinary full-suite discovery. `DurationSequencer` packs
  the parallel inventory using the exact-run plan and measured timings (`test/durations.json` supplies fallback weights).
  The pure format suites use fork
  workers with `isolate: false` and no global setup; every other suite retains isolation and ordinary setup.
  `scripts/test-products.json` still supplies strict preflight dependencies, not an exclusion or second wave.
  Every matrix job sets `WS_TEST_PRODUCTS_SHA` only after verified artifact restoration. Missing or mismatched
  artifacts fail instead of rebuilding. File timing JSON is retained per shard to refresh measured weights.
  The matrix keeps `fail-fast: false`; `bail: 0` runs every selected case. The ship job requires prepare,
  every behavior shard, native Escape, types/lint/docs, all six browser journeys and their exact-SHA verdict to pass. Local/full/nightly configuration stays
  unchanged. G923 removed quarantine workflows, registry and exclusions; Native Escape, headless and every other
  real behavior case remain blocking. Each job finishes its own verdict independently of peer failures.
- **G745 phone route rollout:** the exact push build also publishes a separate
  `boot-dist-phone-route` bundle. Its dedicated report-only macOS job starts
  alongside Linux prepare. It selects the matching Xcode and inventories iOS
  once, then boots and warms Safari in the foreground before dependency or
  artifact IO. A real native failure refuses; WebKit is used only when no iOS
  runtime exists. The route awaits the original atomic ready/failed receipt.
  Native readiness serves a fresh loopback document and requires its signal
  after two animation-frame callbacks within the same 120-second budget.
  A successful URL command alone cannot grant readiness. An already proven
  document can retire its stuck owned `openurl` client; Safari stays running.
  A missing, foreign or late signal still refuses the lease.
  Before transfer, a condition wait requires this exact run's prepare job to
  succeed, within the phone job's original twenty-minute budget. It never
  waits on its own aggregate or retries a failed producer. SHA/run/archive
  validation still happens before any artifact bytes are served.
  Homebrew proxy bottles and the pnpm store are restored after Safari is ready;
  unused Playwright browser binaries are not installed for native Safari.
  The route follows title → SHARD SELECT → grid/Driftwood → road → Night Market,
  retaining every first-paint, resident-tile, board/wall, draw/pill, grain, fatal
  and pixel guard. The six required journeys alone decide release. The native
  readiness bound stays 120 s; entry, route and twenty-minute job caps stay.
  The prepared device is released even after transfer or route failure.
- **Automatic push proofs coalesce as whole workflows**, with one active six-leg
  cohort and the newest pending cohort. An active proof finishes all six legs;
  a newer push may replace a pending workflow, never individual legs from
  different exact SHAs. Browser legs have no independent cancellation groups. All
  original case, fatal, pixel and deadline checks remain within each exact run.
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
- **G920 retires the hourly GitHub schedule, local calendar backstop and shared hourly slot.** A green exact-SHA
  push wave ships its own exact prebuilt output immediately after all required checks succeed. Release concurrency and the production ancestry
  floor remain mandatory. The separately requested 2026-10-30 07:00 Cancun one-off remains installed.
- **Production ships the newest CI-green `main`** (Jake, 2026-10-02: "fix the deploy, whatever it takes"). The automatic
  or manual release reads `.github/deploy-pin.json`: mode `newest-ci-green` picks the newest main commit whose push
  wave (typecheck, lint, tests, prepare and browser journeys) passed. `.github/workflows/deploy.yml` now owns
  the browser matrix directly after prepare; the old boot-smoke workflow and dispatch chain are retired.
  Every public primary still reaches entered, unpaused page-ready with ten live gameplay frames. Prepare
  archives its actual web dist with its full commit, source run and tar checksum. Each browser job verifies
  the small manifest and downloads its exact same-run bundle, without a full-dist relay or another build.
  Four grid/Explorer legs share the same complete-world
  bundle because prediction and catalogue coverage can visit every declared primary. Standalone bundles omit only
  unselected shard-owned paths; shared assets, title images, compiled modules and source maps remain available.
  Historical content-addressed packs absent from every emitted JS or JSON URL table are not transferred.
  Every served file retains its original bytes and SHA-256. Archive SHA-256, file inventory, SHA/run/leg binding,
  version, path and regular-file checks refuse corrupt or mixed transfers before extraction, without retry.
  Each receipt records transferred bytes and transfer-plus-verification seconds under the unchanged 20-minute cap.
  First ordinary measurements (2026-10-25, source CI `40228094199`, exact tested `5b7f2466dd`,
  smoke `40229204509`) follow. Download seconds are the artifact action's elapsed time, including extraction;
  total seconds include manifest transfer and strict file verification. Artifact uploads already use deflate level 6.

  | Leg | Raw tar bytes | Compressed artifact bytes | Download seconds | Transfer + verification seconds |
  | --- | ---: | ---: | ---: | ---: |
  | Public | 1,521,315,840 | 1,018,615,814 | 69 | 78.197 |
  | Developer | 1,287,321,600 | 894,736,269 | 30 | 39.881 |
  | Grid | 1,655,203,840 | 1,070,346,470 | 70 | 80.669 |
  | Chromium HOVER | 1,655,203,840 | 1,070,346,470 | 41 | 49.350 |
  | WebKit HOVER | 1,655,203,840 | 1,070,346,470 | 23 | 33.112 |
  | Explorer | 1,655,203,840 | 1,070,346,470 | 35 | 46.526 |

  The central job downloaded only the 822-byte compressed manifest in 0.236 seconds. All six transfers verified;
  the later Nine image-decode failures in public, Developer and Explorer keep this smoke red. These measurements
  establish the transport result, not release acceptance. The previous full-dist relay exhausted 1,191.6 seconds
  downloading a 1,373,810,670-byte artifact in smoke `40217512944` before the unchanged outer deadline stopped it.
  The Nine failure was a transport dependency omission: JS-only pack pruning missed external JSON boot tables,
  leaving zero packs in that artifact. On exact `5b7f2466dd`, replacing only those pack responses with SPA HTML
  reproduced the native image-decode failure (9 seconds versus an 18-second complete-pack boot). The corrected
  JS-and-JSON scan restores all eight table-named Nine packs byte-for-byte; 60 contained file hashes match the
  failed CI's original individual-file inventory. Archive integrity alone does not prove dependency completeness.
  Smoke verifies that provenance and the version stamp before serving the same selected bytes to each browser leg;
  it never regenerates products. Missing or expired artifacts refuse the proof: push a head containing the artifact
  publisher and prove that head; an older run without the artifact cannot supply this proof.
  Cases come from that build's actual title catalogue, excluding frozen copies and
  explicit `shardSelect: false` rows, which have no standalone picker card. Selectable
  hidden shards remain Developer cases. Explorer retains grid-only catalogue rows.
  Experimental
  primaries (including Signal) use their real Developer entry. While Nine is experimental, its public leg is an
  explicit PUBLIC-POLICY ADMISSION proof (call44): the existing `?chunk=` document fully hydrates Nine to the title
  with Developer off (`data-dev` absent), zero fatal reports, a locked COMING SOON card and the actual initial draw. The title then gates its frame loop.
  It does not claim a public menu or grid entry. The public playing-envelope refusal remains active at `level.world`;
  a pre-`1b39cec67` build must fail that negative. The separate Developer Nine case retains entered gameplay and ten
  live frames. When Nine becomes public, its public case uses the ordinary gameplay entry. The Developer grid proves its home handoff, then a
  road-to-Template entry, ten live frames and a checkpoint-backed return to the road, followed by the real
  road-to-Signal crossing, entered runtime residency and ten live gameplay frames. Initial road approaches use
  the existing probe; held input and the shipping fixed step perform each crossing. Template's return has no
  second pose and requires its durable storage checkpoint. Home retains its 90-second budget; the Template
  roundtrip and Signal share the existing 90-second road budget. A prepared cell or ready home cannot
  substitute for either entered runtime or the return checkpoint.
  The initial title has its own 150-second budget. Standalone gameplay starts at
  the real entry action, so cold title loading cannot consume the home proof.
  Grid entry changes documents: its cold preparation has a separate 150-second
  bound through visible home residency. The following 90-second home proof still
  requires every visible ring and ten gameplay frames before the Signal road leg.
  Smoke receipts distinguish drawn frames, fixed ring steps and clock/pause state.
  Screenshot diagnostics retain a stable Playwright trace only while a boot frame is captured, with trace
  screenshots, snapshots and sources disabled. Logs retain capture duration and font-ready milestones;
  native layout/capture/PNG encoding/cleanup RPC durations are explicitly unavailable in this trace API.
  Chromium's separate protocol observer records layout and screenshot RPC round trips without retaining payloads.
  Only the title capture also records native Chromium tracing through public `browser.startTracing` / `stopTracing`,
  with `gpu`, `cc`, `viz`, `devtools.timeline` and `disabled-by-default-devtools.timeline` categories and no screenshots.
  Existing smoke artifacts retain its gzip trace and wall-time receipt; raw retention is capped at 32 MiB and
  compressed artifacts at 8 MiB. The first Nine trace was 16,440,478 raw bytes and exceeded the initial 8 MiB raw cap.
  Oversize or unavailable evidence is reported, never silently trimmed or used to replace the capture verdict.
  The public API returns the complete trace buffer before that retention cap can be checked. These diagnostic runs
  establish no performance gain; a warm/compile explanation requires actual retained renderer/GPU events.
  Chromium captures the same device-scale viewport PNG through Playwright's public CDP session with
  `optimizeForSpeed: true`, then decodes it through the same pixel assertions. Fonts and one browser animation
  frame settle first without requesting a game draw; all stages share the original ten-second allowance.
  CF2's retained failure on exact `b8721bd4c0` (smoke `40243550276`, Developer artifact `12618296342`)
  shows a 7,440.530 ms renderer animation task, including 6,191.577 ms across shader-program status waits;
  the longest query took 1,826.850 ms. Fonts took 11.557 ms and layout 58.148 ms, while the native PNG hit
  the shared 10,027.200 ms deadline. This establishes competing renderer/GPU work, rather than an idle GPU.
  Script execution stays enabled throughout capture. Smoke `40254948826` on exact `2158fa6713` proved
  that the attempted script suspension let title PNGs finish but stopped Driftwood and Nine at 0–1 live
  gameplay frames. A native Chromium differential with the same pending animation loop and a 150 ms
  transport hold reproduces the cause: disabling scripts discards the pending callback, so the counter
  remains at 2 after re-enabling and another 250 ms. Leaving scripts live advances it from 12 to 27.
  Re-enabling JavaScript alone did not restore that loop; the earlier fixture only checked a nonzero
  counter and missed this. A debugger-pause control also exceeded the unchanged capture allowance and
  was rejected. Neither mechanism is used. No game scheduler, callback replay, clock, readiness row,
  viewport or pixel gate is replaced. Native PNG timing and bounded Chromium traces remain available
  for the original capture contention; no further capture tuning or retry is justified by this repair.
  The corrected default helper passes the original 19,968 title pixel samples (dark share zero), and its
  real animation counter advances from 6 to 24 after capture without replaying or requesting a game draw.
  A stalled stage refuses without accepting a late PNG or requesting a replacement. The failure JPEG remains diagnostic.
  The composited image, pixel checks and 10-second screenshot timeout remain unchanged; a missing diagnostic
  trace is reported without substituting a successful frame or retrying the capture.
  Six required macOS legs separate public cases, Developer standalones, the grid/Signal road proof,
  Chromium HOVER and WebKit HOVER/rendering (`boot-public`, `boot-developer`, `boot-grid`,
  `hover-chromium`, `hover-webkit`, `explorer`). Each keeps its 20-minute outer deadline. The 2026-10-18
  Developer job spent 9.5 minutes building, passed all seven standalone cases, then exhausted
  the outer deadline before its grid case could finish. The grid now has its own required leg;
  no case, gameplay deadline or failure condition changed. HOVER waits for the loading overlay
  to close within its existing 150-second title budget before tapping the real entry button.
  The `boot-verdict` job requires all six legs before publishing the one `boot-smoke` status. Fatal UI, page
  errors and bad asset responses still refuse. macOS jobs now run within the push wave, with at most five
  concurrent legs. Automatic shipping uses trusted GitHub `needs` from that same main push and binds its full
  SHA and source run; a missing, failed, cancelled, skipped or foreign prerequisite refuses. The ship job is
  serialized with manual releases, verifies its prebuilt artifact, and checks the live forward-only floor.
  Manual releases keep newest-completed-CI plus exact-SHA smoke selection; a newer unfinished proof does not
  replace an older fully proven candidate. PRs run browser journeys but never publish production or statuses.
  An explicit emergency rollback may instead return to any SHA
  proven previously live in production, even before the smoke existed: verified `production-live` status or a
  successful historical release job's exact full pin plus matching production-version reading. Pin history alone
  is insufficient. The OTA reader enforces the same proof. `force`
  only bypasses the already-live check. Inspect the smoke artifact's queue/run timings when a release waits.
  The old gpu-gate workflow was deleted on 2026-10-13; it runs neither nightly nor by dispatch. Pixel parity and
  golden comparisons are local look tools, not release prerequisites. Historical `newest-green` pin mode reads
  the old status only; current production uses `newest-ci-green` with full push CI and exact six-leg smoke.
- **A green push wave releases immediately (G920/CI9).** `build-and-deploy` runs after all required wave jobs,
  downloads the same prepare artifact and deploys it without dispatching or rebuilding. `read-wave` checks
  exact main/source/checkout identity and every prerequisite; automatic shipping respects `newest-ci-green`
  mode. Manual `gh workflow run deploy` retains configured pin/rollback selection. Both paths share the same
  production concurrency group, private source-map handling and ancestry floor. No hourly slot or cooldown.
- **Nobody waits for GitHub after a push** (Jake, E428, 2026-10-03: "waiting 15 minutes for remote GitHub is just too
  slow"). The local gates on a clean export of HEAD are the check; CI and automatic deploys run on their own. A red CI
  run is fixed by whoever sees it. If the game needs an immediate release, `gh workflow run deploy` (no need to watch it).
- Do not run `vercel deploy` by hand while CI is healthy. Keep commits and pushes small.
- **Done does not wait for the deploy** ([ASKS.md](ASKS.md)): an ask is done when its commit is on `origin/main` with
  the local gates green. Add the live build id when the deploy ships it. If `version.json` lags your green HEAD by more than ~2 h,
  inspect the exact CI/smoke/release failure, fix it forward, then use `gh workflow run deploy` when proven.
- **Deploy from a clean export of HEAD**, never the working tree. Delete the export after.
- **A frozen public URL per version:** `scripts/release-url.sh vX.Y.Z` deploys a clean export of the tag once to its own
  Vercel project (the main project's aliases sit behind deployment protection). Tag first and bump package.json.
- **A branch preview** deploys to its own Vercel project, never the main `wildshard-singleplayer` one.


G609: the products job restores generation and shardfile content-addressed caches
through actions/cache, keyed by the exact checked-out source tree with a prior
snapshot fallback. Generation still verifies inputs and complete output hashes.
Strict product reuse checks captured input receipts and reruns current full
byte/schema/budget/script admission on every hit; a cache is not a test verdict.
The job still builds all 24 products and publishes a new SHA/run/checksum-bound
artifact. Parallel generation retains the complete normal output set.


G609: push/PR web checks and both web/native static builds consume the products
job's verified same-run preparation. They do not run a second generation or
product build. The exact push web dist is still published for boot smoke;
release pin selection, proof checks, Vercel functions and live verification
remain unchanged. Every TypeScript project runs once, with all lint partitions
and all ten complete behaviour partitions retained.

C6: push/PR checks build the additional native bundle only when its entry,
native-only modules, HTML/Vite transform or build toolchain changes. The complete
push range or PR base-to-merge range is checked, including deleted paths; an
unknown initial base builds conservatively. Shared game changes retain the web
build and normal tests. Releases always retain the native build.


G609: generation publishes a separate SHA/run/checksum-bound generated-inputs
artifact. Typecheck/lint jobs need only that artifact and start while the
products job builds all 24 outputs. Full web/test consumers still require the
complete test-products artifact. Generated-only evidence cannot satisfy full
product restoration, and it refuses any embedded product before writing.

G609: preparation proofs retain a complete catalogue inventory while omitting
unchanged tracked outputs from the transfer. Each omitted file records its
size, SHA-256, Git blob and mode, and must match the exact checked-out commit.
Archive and retained paths are disjoint. Missing, modified or symlinked files
refuse before any restore write; no generator repairs an incomplete checkout.
The same-run SHA/checksum proof and the full-product requirement stay active.

G609: the complete TypeScript project check has its own matrix worker beside
the four lint partitions. It no longer serializes one lint partition after
all types. Coverage, generated-input proof and the existing deadlines remain
unchanged; no running push CI is cancelled.

G671 V3: the required Explorer leg reads the exact built title catalogue and opens
every primary shard through the existing Model Explorer entry with Developer on.
It waits for every real card canvas, rejects build/asset/page errors, missing or
at-least-90%-near-black thumbnails, and records each model identity. Explicit
empty catalogues are reported separately. It uses the same verified boot-dist;
no model, light, material, scene or frame is injected or re-rendered for proof.
CF5 replaces the Explorer's total 180-second case deadline with a 180-second
no-progress hang guard: only the first observed canvas for a new model identity
extends it. Repeated polls or redraws of existing cards cannot extend the guard.
Every catalogue and final pixel/fatal check remains required; the leg's outer
20-minute workflow limit still bounds a slowly progressing software-GPU run.

G671 V1: the public, Developer and grid boot legs also inspect composited phone
screenshots at the usable title, SHARD SELECT, settled gameplay, grid HOME and
the real Signal road entry. A frame with at least 90% near-black sampled pixels
fails with its checkpoint identity; labelled pixel statistics remain in the
existing receipt, including failures. Sampling stays within the original boot
deadlines and never requests another game draw or changes the scene.
