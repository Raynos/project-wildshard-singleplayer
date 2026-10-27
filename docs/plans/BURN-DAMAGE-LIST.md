# Plan: BURN-DAMAGE-LIST — burn the damage list to zero

**State:** `parked` (draft, 2026-10-27): starts when SHARD-PLATFORM completes, on Jake's word. Nothing here is built
during the mega build; lanes only add items to the list. Decisions stay in
[shard-platform/decisions.md](shard-platform/decisions.md) (G768, G769, G771, G780, G788, G798, G799).

**This file is the damage list's only home, never STATE.md (Jake). This file is never compacted; every break stays
until it's fixed and marked.**

Jake, 2026-10-27 ~01:00 Cancun (G769): *"Finish all the mini plans by tomorrow, whatever the fuck it takes. Mega
build. Go fast as fuck. And then deal with the damage later."*

## Why it exists

- The mega build (G768, G769) lands on types + lint only. Main may be red; CI and the night after catch the rest.
- Checks that made lanes wait were switched off, not fixed ([mega-build](shard-platform/mega-build-mini-plan.md) MB1–MB7).
- Every break that lands needs one place to be written down, or it is forgotten by the time the plan ends.
- This file is that place: the one real damage list. STATE.md only points here.
- When SHARD-PLATFORM is done, this plan turns main green, gets the deploy moving and puts back what Jake wants back.

## How to add to it (lanes, during the mega build)

- One item per break: **what broke · first bad SHA · owner after the plan**. Add it to the table below, next
  number, Status `open`. Batch it into your next commit; no commit of its own.
- First bad SHA = the first CI run's head where it shows red (the culprit may be earlier in that push batch).
- Owner = the lane that broke it (G754). If nobody knows, write "breaker (sp-x7 finds)".
- **Not listed:** a break that stops lanes building (types fail on main, the app won't build or won't boot). That
  is fixed at once by whoever broke it (G674, G769 (4)).
- sp-x7 adds what it sees in CI (G771). A fixed item is marked `fixed <SHA>`, never deleted; nothing leaves the
  table until the plan archives.
- Never put damage items in STATE.md: it is compacted to 3 KB and items get lost.

## The damage list

Seeded 2026-10-27 ~01:35 Cancun at HEAD `0a7d63da0d`. CI: last green push run `59a595ab10` (live). Every push run
since is red; the latest (`60e9b7bfe6`) fails `generated-inputs`, which fails fast and hides the test shards.

| Item | What broke | First bad SHA | Owner after the plan | Status |
|---|---|---|---|---|
| D1 | `src/engine/core/entered-shader-pause.test.ts`: "Entered shader pause wiring missing" | `ac3e62895d` | breaker (sp-x7 finds) | open; not seen since (masked) |
| D2 | `test/boot-dist-transfer.test.ts`: smoke legs download without a relay | `0acf223e06` | sp-x7 (G771) | fixing now |
| D3 | `test/title-shell-graph.test.ts`: cold title stays off the world graph | `a49bb564ce` | sp-x7 (G771) | fixing now |
| D4 | `test/nalati-render-source.test.ts`: 30 s timeout | `0acf223e06` | breaker (sp-x7 finds) | open; maybe a flake |
| D5 | `test/world-targets.test.ts`: move/contain error not thrown | `06d14d8288` | breaker (sp-x7 finds) | open |
| D6 | `test/tile-bakes.test.ts`: exact coordinate debt | `06d14d8288` | tiles lane (sp-x8) | open |
| D7 | `test/night-market-kit-budget.test.ts`: RM8 target over | `06d14d8288` | sp-o2 | open |
| D8 | `test/open-plot-collision.test.ts`: quarter-turns | `06d14d8288` | breaker (sp-x7 finds) | open |
| D9 | CI `gate-deferred` job red | `06d14d8288` | sp-x7 | open |
| D10 | CI `generated-inputs`: the generation stage misses generator modules (`far-reach/generators/knoll`, `nalati-grasslands/generators/geographySource.ts`) | `998fcef0ba` | generator lanes (sp-x1, sp-x6) | open; hides every later test |
| D11 | Deploy stuck: live stays `59a595ab10` (newest-ci-green pin, no green push since) | `ac3e62895d` | sp-x7 (G771) | open |
| D12 | Official quiet Simulator frame floor 11/15 | `3694a487bc` | sp-x8, sp-o4 | open |
| D13 | Flaky (CF2 title/grid flakes): Nine public/Developer title PNGs quarantined until 2026-10-28 03:30 UTC; the grid catalogue title flake is not quarantined | `531c009fdd` | sp-x1 | quarantined |
| D14 | Flaky (SW13, GM4): `nalati-place-blob-program`, `nalati-map-program`, `nalati-state-intake`, `population-raster`, `map-generation-inputs` | — (G788) | named in the quarantine job (G758) | to quarantine |
| D15 | Flaky (CF2 audit): `heavy-lane.test` timing, `nalati-creature-views` 5e-10 tolerance, V8 `SIGILL` in `shard-headless` | — (G788) | named in the quarantine job | to quarantine |
| D16 | Off (MB1): push gate is a 45 s fail-open wall; batch split path gone, `push_batch.py` dormant | `7d70d351bb` | Jake's call (BD4) | off |
| D17 | Off (MB2): fail-closed `unverified-inputs` refusal (G752); deferred-blob ledgers unread | `7d70d351bb` | Jake's call | off |
| D18 | Off (MB3): `ci-subset` push step; `push-ci-subset.mjs`, `push-subset-jobs.mjs`, `push-subset-mirror.mjs`, `push-deferred-ci.mjs`, `push_handoff.py` dormant | `7d70d351bb` | Jake's call | off |
| D19 | Off (MB4): red hold (G759); `push_red_hold.py` still loaded by `push-loop.py` | `7d70d351bb` | Jake's call | off |
| D20 | Off (MB5): the quiet lock no longer pauses pushes or lanes | `7d70d351bb` | Jake's call | off |
| D21 | Off (MB6): CF1 related walk in pre-commit (vitest + tsc); checker snapshots, proof receipts | `ea606a31d5` | Jake's call | off |
| D22 | Off (MB7): G746 pre-land product builds, parity previews, soaks, Sim readings before landing | — (G769 rule) | Jake's call | off |
| D23 | Readings deferred to one per plan at the end (G777, G780): ci-flow CF3/CF4; iphone-downloads I5, I12; loading S1, L16, G1; js-heap H rows; night-market-remaster RM12; tiles T10 soak; SHARD-PLATFORM M2 | — (G780) | each plan's lane | waiting |
| D24 | 21 files in `vite/` (G799): assetHashes, assetTables, backdropPrefix, basis, bootExtras, bootModules, bootProducts, bootProductTiers, chunkReport, crossroadsRig, devserver, gen, genShards, gridSeamPlans, noTopLevelAwait, outputProducts, preview, pwa-plugin, rapier, worldMapAtlas (+ titleCatalogue) | — (G799) | after the plan (BD7) | open |
| D25 | Virtual module `vite/titleCatalogue.ts` (G799: no virtual modules) | — (G799) | after the plan (BD7) | open |
| D26 | Uncommitted gate edits left in the shared tree (MB8: owner drops them): `.github/workflows/deploy.yml`, `scripts/gate-related-tests.mjs` (+ `.d.mts`), `test/gate-related-tests.test.ts`, `test/boot-smoke-dispatch.test.ts`, `test/precommit-stop-types.test.ts` (staged), untracked `scripts/ci-related-first.mjs` (+ `.d.mts`, test) | — (tree) | their owners | open |
| D27 | Seven leftover `.push-config-*.json` files at the repo root (untracked) | — (tree) | sp-x7 | open |
| D28 | Nalati generation stage: `generators/geographySource.ts` (new) is not in its job's inputRoots, so HEAD previews fail with ERR_MODULE_NOT_FOUND (log tmp/serve/failed-20261027-013000-4402.log) | c954d624a0 | breaker (sp-x7 finds) | open |

## Rows

Parked: none of these is built until SHARD-PLATFORM completes and Jake says go.

| Row | What | Done when |
|---|---|---|
| BD1 | Fix every red item, oldest first, each by the lane that broke it (G754); sp-x7 hands them out. Fix forward, keep every assertion (G690). | D1–D10 `fixed` with their SHAs |
| BD2 | Main green. | One push CI run on main is fully green |
| BD3 | Deploy resumes on the newest green main (`.github/deploy-pin.json`, hourly). Then Jake's phone check (G558). | Live build id is a green main SHA newer than `59a595ab10`; D11 `fixed` |
| BD4 | Decide which switched-off checks come back (Q1). Default (G768): the 45 s push gate and 5 s pre-commit stay; CF1, the red hold, `ci-subset` and fail-closed inputs stay deleted unless Jake asks. Delete the dormant code and its tests (Q2). | D16–D22 each `kept off` or `back`; no dormant gate file left |
| BD5 | Fix each quarantined flaky test deterministically (G690) and move it back to the blocking job. | D13–D15 `fixed`; the quarantine job is empty (Q3) |
| BD6 | Run the deferred readings, one per plan, in official quiet windows (G777, G780). | Each reading in D23 is recorded in its plan; its rows close or reopen |
| BD7 | Cut Vite to bundling only (G799): each `vite/` file is deleted, or its data becomes a committed file made by a plain script (G798); `titleCatalogue` stops being a virtual module. | `vite/` holds only what bundling needs (Q4); D24, D25 `fixed` |
| BD8 | Clean the tree: owners land or drop the abandoned gate edits; the `.push-config-*` leftovers go. | `git status` shows none of D26, D27 |
| BD9 | The list reaches zero; the plan archives to `project/archive/`. | Every item `fixed`, `kept off` or `back`; no row open |

## Questions for Jake (when it starts)

Option 1 of each is "Skip for now".

- **Q1 Which switched-off checks come back?** Options: Skip · Keep the G768 default (45 s push, 5 s pre-commit,
  the rest stays deleted) · Also bring back fail-closed inputs · Also bring back the CF1 related walk.
  **Recommended: the G768 default.** The old gate stalled lanes for hours (MB §1); CI catches the rest.
- **Q2 The dormant gate code (red hold, ci-subset, split, handoff, receipts): delete it?** Options: Skip · Delete it
  and its tests · Keep it dormant. **Recommended: delete.** G769 says delete machinery; dormant code rots and
  confuses lanes.
- **Q3 Once the flakies are fixed, does the quarantine job stay?** Options: Skip · Delete it when empty · Keep it for
  the next flake. **Recommended: delete it when empty.** A new flake is fixed the same hour (G690), so it needs no
  standing job.
- **Q4 How far does the Vite cut go?** Options: Skip · Bundling only: every plugin that makes data becomes a plain
  script + committed file · Only the virtual module and the dev-only plugins. **Recommended: bundling only** (your
  G799 words: *"really lean and simple"*).
- **Q5 Does the list burn before anything else after SHARD-PLATFORM?** Options: Skip · Burn first; HOST-AUDIT and
  the rest wait for zero · Run beside HOST-AUDIT. **Recommended: burn first.** Your phone check needs a green main
  and a moving deploy.

## Out of scope

- Jake's own after-plan work: the tiny repo, the git history rewrite, worktrees, and merging only when green.
- The tooling rows G770 moved to the end of the queue (green-main GM1, ci-flow, shared-waits, GS4/GS5): they are
  counted SHARD-PLATFORM rows, built in that plan.
- [HOST-AUDIT](HOST-AUDIT.md) and the other parked off-shoots of [SHARD-PLATFORM](SHARD-PLATFORM.md).
