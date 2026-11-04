# Close-out spike: archive every SHARD-PLATFORM plan except legacy (G824, G834)

**State:** `open` 2026-10-28 ~14:30 Cancun. Verified and rewritten by a wildshard-v subagent from origin/main
`8c27fbd1b2` plus the three local commits waiting for the push loop (`ffad75f6e3` loading archive, `9132329eee` SW13
mark, `8ba18aced3` shared-waits reading). Coordinator: wildshard-new. Replaces the first draft (`5a13f1b083`).

Jake, 2026-10-28 ~13:48: *"I want you to come up with a new mini spike plan to get all the fucking plans closed and
archived except the ones blocking on me ... we can't delete the legacy yet. I don't know what else. You have to tell me
what else I'm blocking on."* Then G834: the legacy rows stay in SHARD-PLATFORM, so it archives only after legacy goes.

## 1. Where it stands

- **Rows: 190 / 209 = 91 % on origin/main; 192 / 209 = 92 % once the three local commits push** (loading 40 / 40,
  shared-waits 13 / 13). Counter: `python3 -I tmp/plan-pct/plan_pct.py . --rev origin/main` (denominator frozen at 209).
- **Effort: 1,004 / 1,132 lane-h = 89 %** (128 lane-h open; 50 of them are legacy LD5–LD8 + A1–A2).
- **Archived already:** green-main, ci-flow, js-payload, js-heap, night-market-remaster, generators (+ gen speed,
  oxlint, no-binaries, TS quick wins, core-memory, debug-rows, memory-strip, fail-fast, the zero plans); loading +
  loading-speed in `ffad75f6e3` (local, pushes on the next tick).
- **After CO2–CO4 the counter reads true at 194 done, 9 moved, 6 open of 209**; the 6 are LD5–LD8, A1, A2. The counter
  drops `folded into` rows from the total, so it will print 194 / 200 = 97 %; quote it as "194 + 9 moved of 209".

**Counter misreads to fix (wildshard-v, in `tmp/plan-pct/plan_pct.py`, not a repo file):**

| Misread | Why | Make it read true |
|---|---|---|
| SW13 open on origin/main | status read `done9872…` | fixed in `9132329eee`; reads 13 / 13 once pushed |
| build-speed 15 / 16 | `carry` mode: no row table, the 10-26 15:00 number forever | read its State `done` (G809) as 16 / 16 |
| grid-ready 9 / 10 | `n-of-m` reads SHARD-PLATFORM.md's cell `**9 of 10**`, not the plan | cell → `**10 of 10** (Nalati closed unreachable, G828)`; after SHARD-PLATFORM archives the cell is gone, so pin it |
| generators 16 / 17 | archived GR10 says `— folded (…)`; only `folded into` counts as a drop | let a bare `folded` drop (its archive says 16 / 16) |
| moved rows | `moved to X` matches nothing and stays open | mark them `folded into <plan> <row>` (AGENTS.md status word) |

**Shared tree, not ours to touch (list only):** `ffad75f6e3` / `9132329eee` / `8ba18aced3` are committed, not pushed.
Uncommitted: `BURN-DAMAGE-LIST.md` (working copy is −326 lines against HEAD: stale, committing it whole would delete
damage items), `project/archive/2026-10-28-tile-streaming.md` (+489 working, an old copy staged in the shared index), `iphone-downloads`
(I2 punctuation), `HOST-AUDIT.md`, `host-audit/custom-sections`, `project/archive/2026-10-27-js-heap.md` (staged).
Anyone landing those files patches from HEAD (`commit.sh --patch`), never the whole working copy.

## 2. Per plan

| Plan | Rows | Left | How it closes | Owner |
|---|---|---|---|---|
| loading + loading-speed | 40 / 40 | none | archived in `ffad75f6e3` (G831); just push | push loop |
| shared-waits | 13 / 13 | none | SW13 fixed `9132329eee`; archive | wildshard-new |
| iphone-downloads | 12 / 12 | none | State `finished` (G821); archive | wildshard-new |
| grid-crossing | 5 / 5 | none | State `superseded by G828`; archive | wildshard-new |
| grid-ready | 9 / 10 | Nalati | closed unreachable (G828) in the plan, not in SHARD-PLATFORM.md's cell; fix the cell, archive | wildshard-new |
| build-speed (CI) | 15 / 16 | none real | State `done` (G809); counter fix above; archive | wildshard-new |
| tile-streaming | 12 / 12 closed | none in this plan | archived 2026-10-28; T6 folded into D202 (da1d91c6ba, 0 MB), T7 slices into BURN-DAMAGE-LIST (35ee4f1c19 / later-entry record), G842. T10 G832 closed (4990c215fb); 13 / 15 frame floor retained | sp-x10 close-out |
| night-market-pilot | 12 / 15 | R1–R3 | Jake's check passed (G827). R1 → OPEN-PLOTS OP7–OP9, OP13, OP21 (the five new ideas); R2 → OP5–OP22; R3 → OP24; archive | wildshard-new |
| remaster-open-plots | 1 / 4 | RP2–RP4 | RP2 → OP5–OP22; RP3 → the cell swaps in OP7–OP21; RP4 → OP24; archive | wildshard-new |
| open-plots (hologram) | P1–P8 done | none | not counted; archive | wildshard-new |
| mega-build + finish-line | process | none | rules live in G768–G805; archive both | wildshard-new |
| legacy-deletion | 4 / 8 | LD5–LD8 | **Jake's word** after the CO6 boards; LD4's six open gap rows (LD4-DW…SD) go on those boards | Codex lanes |
| custom-code-freeze | 11 / 13 | A1, A2 | after LD8; no extra Jake input | Codex lanes |
| close-out (this) + qa-fixes | rows below | CO1–CO8 | archive with SHARD-PLATFORM (CO8) | wildshard-new |

OPEN-PLOTS already holds the replacement rows (OP1–OP24), so the moves copy nothing: each source row gets
`folded into OPEN-PLOTS OPx` and keeps its done-when beside it.

## 3. What waits on Jake

1. **LEGACY vs SHARDFILE** (blocks SHARD-PLATFORM's archive). Skim six labelled sheets (4 cameras × LEGACY · SHARDFILE
   per shard, plus LD4's list gaps) and say "delete legacy now", or name a shard that must wait. **~10–15 min**, once
   CO6 lands (~18:00 today). His word starts LD5–LD8, then A1–A2 (~12–20 h of lane time, mostly in a chain).
2. **Opus capacity** (blocks CO1's render fixes, not the archive). At 13:50 openusage read the active Claude account
   at **99 % weekly** and the other at **100 %** (18 min stale). G836 burns to 100 % and then switches, but both accounts
   look spent. Jake: say when an account resets, or let Codex take the water / blurred-top / pier / reveal fixes.
   **~1 min.**
3. **Open picks, none blocking the archive** (one question batch, ≤ 4, option 1 "Skip for now"):
   - **D185** Pine phone PBR model textures (three texture copies per GLB): board by wildshard-v. ~2 min.
   - **Night Market figures (G755 redo)**: `art/grid/round-71-night-market-figures-g755/board.jpg`, waiting since
     10-26; figures stay off until he picks. ~1 min.
   - **D179 / D181 / D183** (Nine spawn view, Pine crossing shaders, Sky warm return) are made moot by G821 and G828:
     the coordinator marks them `superseded by G821 / G828` and Jake is not asked.
4. **Start the parked plans, on his word, after the archive:** OPEN-PLOTS (G829 answered scope, style, play and the
   lantern count; **Q3 budget, Q5 repeat cells and Q7 lanes are still open**, ~2 min) and BURN-DAMAGE-LIST (its Q1–Q5:
   which switched-off checks come back, dormant gate code, the quarantine job, the Vite cut, burn first; ~3 min).
5. **The next mega plan** (one world, fast crossings, the deeper loading fixes) is his to write after a retro
   (G828, G831). Nobody drafts it.

Not his: phone checks of CO1 (his playtests are the check), the ask receipts (E461, E500, E503, E504 close with their
plans; CO4), and every row in §2 above legacy.

## 4. Rows

| Row | What | Owner | Done when |
|---|---|---|---|
| CO1 | **done (2026-10-29 13:23): live 8621318d9-mvtvd1tf, Jake's QA build (cf1d4066e3 + every QA fix; CI 40919003760, exact six 40924043499).** **Ship the QA fix release** found in Jake's 10-28 phone QA: service-worker stall limits (G830: page reload, stylesheet, `shard.json`, map code), the loading screen painted on tap, the update screen's reload step animated, steps under 500 ms grouped, the hold toggle on the loading screen, the water regression, the blurred top, the minimap tile labels off, the pier and far stand-ins, reveal after the spawn shaders link, the Props 23.7 s check. Rows: [qa-fixes-2026-10-28](../../../project/archive/2026-10-29-qa-fixes.md) | two Codex lanes + Opus after the account switch; sp-ci-deploy releases | one immediate deploy; Chromium + WebKit iPhone runs load Driftwood without a hang; build id to Jake |
| CO2 | **done (2026-10-29, wildshard-new):** grid-ready cell 10 of 10 (G828); D179 / D181 superseded by G821 / G828; D183 decided B (G872). **Marks**: tile T10 `closed (G832)` with the 13 / 15 reading; grid-ready's SHARD-PLATFORM.md cell → `**10 of 10**` (Nalati closed, G828); build-speed counted 16 / 16; D179 / D181 / D183 `superseded by G821 / G828` | wildshard-new; wildshard-v for the counter | `plan_pct.py --rev origin/main` reads tile 10.5 / 12 (T6, T7 open until CO3), grid-ready 10 / 10, build-speed 16 / 16 |
| CO3 | **done (verified 2026-10-29):** R1-R3 / RP2-RP4 folded into OPEN-PLOTS; T6 / T7 and G832 pop-in on BURN-DAMAGE-LIST (D202, T7, D200). **Moves**: R1–R3 and RP2–RP4 `folded into OPEN-PLOTS OPx` (now); at 18:00, T6 and T7 to BURN-DAMAGE-LIST as named items with their numbers and their whole done-when, and G832's pop-in + far-content item with his screenshots. Patch BURN-DAMAGE-LIST from HEAD | wildshard-new | no row lost; each source row names where it went; the damage list grew by 3 items, lost none |
| CO4 | **done (2026-10-29):** every plan above legacy archived (incl. Nine / Far Reach 44c51cc4ac, G548 build speed f8ccbaa6c3); asks E461 / E500 / E503 / E504 done. **Archive** every plan in §2 above legacy to `project/archive/2026-10-28-<name>.md`, links fixed in SHARD-PLATFORM.md, the asks done (E461, E500, E503, E504) | wildshard-new | only legacy-deletion, custom-code-freeze, close-out and qa-fixes stay live in `docs/plans/shard-platform/` |
| CO5 | **done (C1: the counter reads fixed status words; wildshard-v owns the script):** **Counter fixes** in `tmp/plan-pct/plan_pct.py` (§1 table) | wildshard-v | one run reads 194 done, 9 moved, 6 open of 209 |
| CO6 | **done — LEGACY vs SHARDFILE boards** (G834): every shard entered both ways from the same 4 cameras, phone portrait, labelled, one sheet per shard, plus LD4's Node list gaps (Nine registrations and POIs, Far Reach POIs, the conditional Sets) | sp-x9; [six inspected sheets](../../../art/legacy-vs-shardfile/round-1-2026-10-28/README.md), 48 captures, 0 errors; Nine's NR8 closing sheet [22-nr8](../../../art/nine-dragon-stack/round-32-shardfile-regressions/22-nr8-sheet.jpg) (`04ed616aa6`) | batch ready in STATE for Jake; Sky visual gap and LD4 gaps retained; deletion still needs his word |
| CO7 | **Preparation re-verified on HEAD `0842029378` (2026-11-02), §6; implementation waits for Jake's Nine QA word (G908/G933/G966).** Current chain: LD5 → remaining Nine LD6/LD7 (158 files) → LD8 → LD9 → NF18 → LD10; the old three-pair chain is historical | coordinated source owners; sp-ci-deploy schedules milestone hardware | each row's original gates; final exact-source six-leg smoke and NF18 frame/golden/download bars, then CO8 |
| CO8 | **Archive SHARD-PLATFORM** with decisions.md, STATE.md, this page and qa-fixes, then stop every lane and the builder (G824) | wildshard-new, then wildshard-v | the archive commit; herdr shows the lanes released |

Order: CO1, CO2, CO5 and CO6 now, in parallel; CO3's plot moves now and its tile moves at 18:00; CO4 once CO2–CO3
land; CO7 on Jake's word; CO8 last. (The draft's CO5, legacy as its own plan, is dropped by G834.)

## 5. Finish times (Cancun)

- **Everything archived except SHARD-PLATFORM: today ~19:30.** CO2 / CO5 take under an hour; the tile moves wait for
  18:00; one archive commit set after. The two live pages left with SHARD-PLATFORM are legacy-deletion and
  custom-code-freeze (plus this page and qa-fixes). CO1's release is separate: tonight if Opus has capacity, else when
  an account resets (§3.2).
- **SHARD-PLATFORM archived: Thursday 10-29 ~16:00–22:00**, if Jake gives his word on the CO6 boards tonight (~18:00–
  20:00). LD5–LD8 + A1–A2 are ~50 lane-h estimated but a chain (LD6's three pairs each need green gates; A1 needs a
  boot smoke and a walk per shard), so ~12–20 h of wall time. Every hour his word slips moves this one hour.

## 6. CO7 re-verified: the remaining Nine QA chain (2026-11-02)

**Preparation done; implementation still waits for Jake's Nine QA word.** Source/readers were re-verified on
`084202937820db17df42a7f360dbaf40843b7bd8` (committed HEAD, including CS5 `9507499224`), using tracked-path and package-export resolution,
TypeScript import/type-import/dynamic-import parsing, and literal/string-load searches. No source was deleted,
no branch created, and no build, test, browser or Simulator was run for this preparation. CS9 is handed to sp-x1;
it is not a prerequisite to writing this chain. G872's self-applied case decisions do not substitute for the explicit
Nine QA release condition in G908/G933/G966.

This section supersedes the **implementation inventory/order**, not the recorded outcomes, in the October 28–29
snapshot above and the prepared `ac8db2e95d` / `3e9937f146` chain. Only
`src/shards/nine-dragon-stack-legacy/` remains: **158 tracked files / 4,256,784 bytes**, with every SHA-256 matching the
sole sealed row in `lint/legacy-shards.json`. Pine's 239 files are already gone (`5abfc53bb9`), as are its ten exclusive
leaves (`153d6b5689`, `a9bdb20119`); the other frozen trees are gone too. There are no three remaining pairs to delete.
The checked helper is `scripts/legacy-shards.mjs`, not a nonexistent `scripts/legacy-shards.json`; the entry selector
is `src/game/shard/entryMode.ts`, not `entries.ts`.

### Ordered commits after the word

These are **proposed commit subjects**, not claims of landed implementation. Prepare/rebase each patch against its
actual parent and serialize shared files with their owners. The release owner schedules one containing milestone
qualification, using the ordinary lanes; nobody dispatches CI, starts duplicate previews or waits for CI to push a
green local slice. The small source commits are ready to start within an hour of the word; the native milestone bars
still need their actual turns and cannot be declared complete from this audit.

| Order | Row and proposed commit | Exact boundary and local gate |
|---|---|---|
| 0 | Release receipt, no source deletion | sp-ci-deploy binds Jake's accepted Nine build/full source, the existing goldens and the last legacy-containing source. Local `legacy-final` currently resolves to `91a9eef081ba1fa1b952f0acff520adda2805b08`; verify its intended historical role rather than silently moving it or claiming it names the new QA build. Any new release reference follows the release owner's normal procedure. |
| 1 | **Done 11-04 (sp-o1): `d3143de1cf` + drivers `d0d8d26283`.** LD5 — `refactor(entry): remove legacy entry choice` | Remove the user-facing LEGACY button/Debug row and saved-mode selection in the files below. Preserve a compile-only compatibility surface for the still-sealed Nine manifest until step 2; do not edit that manifest to make step 1 compile. Run entry/title/travel positives and stale-save negatives. |
| 2 | **Done 11-04 (sp-o1): `1d4f2e2fe3`.** LD6 Nine + LD7 remainder — `refactor(legacy): retire the Nine snapshot` | Delete exactly the sealed 158-path tree and its inventory row; retire the four leaves with only frozen importers, reconcile the two oracle-read leaves before removal, and prune their defining package keys. Regenerate discovery/art/manifest closure normally. All modern products, public assets and historical byte oracles stay. |
| 3 | **Done 11-04 (sp-o1): `af33359def` + `880c17d3fb` + `dcb1ef7d3d`; LD5's compatibility types: manifest shape A `4a92df75a4` and B (the `entries` schema field and authored rows, full local build exit 0) done.** LD8 prerequisite — `refactor(legacy): remove empty registry` | Remove the now-empty inventory/helper/identity bridge and its caller branches; retain real modern tooling and the historical line basis. Finish deletion of LD5's temporary compatibility types. Tool discovery, zero ruler, source seal and modern admission refusals remain tested. |
| 4 | LD9 — `refactor(boot): use one client-plan entry` — **LD9a done `66c036d0a8` (+ `714d040215`); LD9b (copied-runtime arm, format/sdk/scripts; rebuilds every product) open, after NF18** | Replace the standalone adapter/empty-native-class construction with one declared client-plan boot; preserve CSS readiness, phase order, home/stage ownership, grid residents, save/quest semantics and disposal. Retire the copied-runtime declaration arm and its execution path without weakening client-plan admission. |
| 5 | NF18 — `refactor(render): remove the TSL runtime` — **done (this commit)** | Rendering owner removes the runtime TSL door/handler and node-only branches after the shared contracts and remaining entry callers use GLSL. Retain authoring DSL, graph IR and all shipped GLSL paths. Named compiler/parity tests first; the download/frame/golden bars below remain required. |
| 6 | LD10 — `refactor(core): retire orphaned boot APIs` | Recompute reachability after both LD9 and NF18, remove only proven unused modules/exports/members, redirect the two root audio loans, and update ENGINE.md in the same commit as the API removals. A layer-graph pass alone is not an orphan proof. |
| 7 | CO8 — `docs(shard-platform): archive the plan` | Only after every attached row is landed or has its explicitly recorded final disposition and the milestone gates close: mark finished and move the live plans/decisions/state together, fixing incoming and relative links in that same commit. No archive or lane shutdown happens in this preparation. |

**Common gates for implementation:** `pnpm exec tsc -b tsconfig.layers.json --builders 1`, the scripts/test type projects
when their code changes, typed lint on remaining touched TS/JS, normal staged ratchets/storage/deleted-path checks,
`git diff --check`, and each row's maintained focused suites. Use `scripts/vitest.sh` for focused tests; no local full
suite. Changed registered inputs go through the registered source producers / commit wrapper, including GS4 outputs;
never hand-write generated manifests or pins. The scheduled committed-only push gate remains the publication check.
The final exact-source milestone keeps all six existing smoke legs (`boot-public`, `boot-developer`, `boot-grid`,
`hover-chromium`, `hover-webkit`, `explorer`), ordinary required CI/native groups and their unchanged caps. Actual scripts
are `scripts/parity/boot-smoke.mjs`, `scripts/parity/hover-touch.mjs` and `scripts/parity/explorer-smoke.mjs`; there is no
`scripts/boot-smoke-dispatch.mjs`. Browser work uses browser-lane, muted/iPhone portrait, builds heavy-lane/serve-build,
and any Simulator proof sim-lane, all coordinated by sp-ci-deploy. Preserve raw refusals; no new pixel tolerance,
checkpoint retag, disabled check or deadline raise.

### LD5: current entry/Debug callers and fixture edits

- `src/game/shard/legacyButtons.ts` is a real three-caller module: `src/game/titleDeck.ts`,
  `src/game/session/loadout.ts`, `src/game/shard/entryMode.ts`. Remove the `legacyShardButtons` Debug registration,
  `debug.global.legacyShardButtons` setting reads and install calls together; an old persisted value must not resurrect
  the row. Remove only its strings/styles in `src/game/strings.ts` and `src/game/mainMenu.css`; keep Developer itself.
- `entryMode.ts` owns `shardEntries`, `defaultEntry`, `hasEntry`, `chooseShardEntry`, `shardEntryChoices` and `shardEntry`,
  plus the session `shardEntry` save slot. Its actual runtime readers are `src/entry.ts`, `src/game/grid/pageEntry.ts`,
  `src/game/session/{loadout,play}.ts`, `src/game/titleDeck.ts`, `src/game/travel/entry.ts`,
  `src/game/shard/runtimeVariant.ts`, and `src/game/shardfile/{clientSource,productGround}.ts`. Convert each modern
  reader to the single admitted entry rather than retaining a hidden fallback. Old saved `legacy` choices become inert;
  do not change ordinary save/content namespaces.
- `src/game/shard/legacy.ts` is read by titleDeck, session/loadout, session/summary and travel/entry. Remove its legacy
  resolver and duplicate-manifest UI branches only with those readers. `src/game/shard/manifest.ts` still declares
  `ShardEntryMode`, `ShardEntries`, `legacy` and `entries`; the sealed Nine manifest needs its existing type shape until
  step 2 removes it. Retire the compatibility shape in step 3, not by weakening its validation in step 1.
- Change `test/shard-select-entries.test.ts` from dual-button/saved-mode expectations to one ENTER WORLD in public and
  Developer, including locked/not-yet/catalogue cases and stale saved-setting negatives. Adapt
  `src/game/travel/travel-entry.test.ts`, `test/session-title-exit.test.ts` and `test/session-chunk-budget.test.ts` without
  losing exact entry/leave/title/disposal or lazy-byte checks. Drivers selecting `.ws-menu-shardfile` or a LEGACY button
  must use the maintained single-enter selector and retain their native readiness assertions. Keep synthetic catalogue
  negatives in `test/boot-smoke-catalogue.test.ts` and `test/explorer-catalogue.test.ts`; do not drop catalogue coverage
  merely because a legacy fixture is retired.

### LD6/LD7: the 158-file operand and the last leaves

The deletion operand is the exact `git ls-tree -r --name-only <parent> src/shards/nine-dragon-stack-legacy/` result,
matched against the sealed row immediately before deletion. Outside that tree, the actual registration import is
`scripts/legacy-explorer-lists.ts` → `playground/registration`; tests
`test/{frozen-legacy-format,legacy-runtime-state}.test.ts` import its `shard.config.ts`. Remove/rewrite those imports in
the same step. `src/game/shard/legacy/runtimeState.ts` is still called by `src/game/plugin/headless.ts`: remove only the
frozen content-identity remapping, keeping the ordinary/placed instance identity and save-isolation assertions.

| Existing residual module | HEAD readers outside the frozen tree | Step-2 treatment |
|---|---|---|
| `src/engine/player/nalatiArms.ts` | No resolved import outside the frozen tree | Remove after the fresh parent search, including its defining engine export. |
| `src/game/shardfile/portalLink.ts` | No resolved import outside the frozen tree; string-based declaration test remains | Remove the game export and only the retired case in `src/game/isolated-game-registry-declarations.test.ts`. |
| `src/sdk/runtime/weapons/Firearm.ts` | No resolved import outside the frozen tree | Remove its SDK exports/publish entry with the module. |
| `src/sdk/runtime/weapons/starterBow.ts` | No resolved import outside the frozen tree | Remove its SDK exports/publish entry with the module. |
| `src/engine/ai/EliteBrain.ts` | Value import in `test/fixtures/species-oracle/pineElites.ts`; no tracked importer of that fixture was found | Recheck the fixture transitively on the deletion parent. If still unconsumed, retire it with the module; if a new real oracle consumes it, first move the exact reference implementation to that fixture owner and retain its comparisons. |
| `src/sdk/weapons/firearmProfile.ts` | Type imports in `test/fixtures/weapon-oracle/{leverAction,leverBridge,nalatiRifleProfile,pineFirearmProfile}.ts` | Define the exact test-only reference shape at its fixture owner, migrate all four importers, then remove the production export/module. No permissive replacement schema. |

The other eight leaves from the old 14-module final-pair list are already absent; do not recreate deletion operands.
The two `src/sdk/runtime/audio/{combatCues,weaponVoices}.ts` wrappers **still have root entry callers** and belong to LD10,
not this deletion. `src/format/groupBrains.ts` is modern schema, not the retired SDK facade.

Reconcile only Nine-prefix exemptions/pins in `scripts/check-models.mjs` (seven current paths: `vm/swordSupport`,
`playground/GrapplePlayground`, `world/install`, `world/facade/batch`, `world/portals`, `world/hero/kitx`, `vm/geo`),
`lint/generated-import-debt.json`, `lint/generated-source-debt.json`, `lint/runtime-performance.json`, `lint/host-reviews.json`
and the actual matching ratchet rows. Remove debt/exemptions, never broaden them. Regenerate
`src/shards.generated.ts` and `src/game/shard/{slugs.generated.ts,slugs.generated.json,art.generated.ts,manifest-closure.generated.json}`
through their defining producer. Public assets used by the modern Nine producer, AssemblyScript policy budgets,
`lint/legacy-line-basis.json` and `test/fixtures/legacy-oracles/nine-{audio,light}.json` remain.

Run/adapt `test/{frozen-legacy-format,legacy-runtime-state,legacy-seal,model-contract-paths,lint-recorded-debt,
no-shard-runtime,ratchet-paths}.test.ts` and the direct species/weapon oracle consumers. New assertions prove no frozen
Nine discovery or registration survives and the primary Nine entry still admits; retained oracle comparisons keep all
original math/state/pose/byte assertions. SDK source exports and publishConfig keys must agree after removal. The old pineElites fixture comment names a test path that is now absent; do not claim that historical suite ran.
Trace the reference fixture transitively at the deletion parent, moving it only if an actual oracle still consumes it.
The current weapon consumers are `test/{held-firearm-rows,pine-firearm-intake,ranged-cycle}.test.ts`; retain their
original action/save/pose comparisons rather than substituting a new implementation.

### LD8: required empty-registry cleanup before LD9

The empty inventory is not permission to delete its callers wholesale. Current readers of `scripts/legacy-shards.mjs`
or generated `LEGACY_SHARDS`/`LEGACY_CONTENT_IDENTITIES` are:

- `.githooks/commit-msg`; `lint/{host-files.mjs,ratchet.mjs,wildshard-plugin.js}`;
- `scripts/{bake-loader,boot-dist-plan,build-shardfiles,check-custom-section-growth,check-graph,check-models,
  check-platform-ratchets,check-shards,committed-fast-checks,decision-legacy-lines,frame-floor-inventory,game-plugins,
  gen-budget-derivations,gen-programs,gen-shard-words,gen-shards,generated-files,json-declarations,map-hash,
  precommit-checks,shard-coupling,shard-platform,shard-runtime-closure,sim-in-runtime,source-generators,title-catalogue}.mjs`,
  plus `scripts/push-source.py` and `scripts/legacy-explorer-lists.ts`;
- `src/{shardList,shardSelection,shards.generated}.ts`; the identity implementations in `src/game/shard/list.ts` and
  `src/game/shard/legacy/runtimeState.ts` have indirect modern headless callers too.

Retire the helper plus `scripts/legacy-shards.d.mts` and `lint/legacy-shards.json` only after these imports and
legacy-specific branches disappear. Keep modern model checks, source fences, hook trailer validation, JSON/AS rules,
shard discovery and the zero ruler. Historical line denominators stay in `lint/legacy-line-basis.json`; no empty list
may turn a missing product/template into a zero or a pass. Reconcile the directly importing maintained tests, especially
`test/{legacy-seal,ruler-legacy-basis,lint-recorded-debt,ratchet-paths,model-contract-paths,no-shard-runtime}.test.ts`,
plus catalogue tests; retain malformed/unregistered/missing-input refusal fixtures at their modern owner.

### LD9: one client-plan boot, with modern shared owners retained

1. **Manifest producer:** `scripts/authored-manifest.mjs` emits the dynamic call to
   `@wildshard/game/shard/declaredEntry`; it is a real runtime edge even though a literal import graph finds only test
   callers of `src/game/shard/declaredEntry.ts`. Replace that call and the empty native class together with its defining
   implementation. Preserve the declared CSS preload barrier (bounded unique styles) before entry and the exact phase
   order: world → native world → world-bindings, native kit → plan kit, prepare-play → native play → plan play.
2. **Ownership declarations:** `src/format/minimap.ts` validates the platform client-plan binding.
   `src/shards/{driftwood-isle,nalati-grasslands,nine-dragon-stack,pine-hollow}/manifest.json` carry distinct
   `retainHomeRuntime` / `stagesOwner` declarations: Driftwood false/declared, Nalati and Nine true/declared, Pine
   true/runtime. Encode the still-required ownership as data at the direct entry; do not flatten all four policies.
3. **Adapter retirement:** retire `standaloneHybridEntry` from `src/game/plugin/context.ts` and
   `prepareStandaloneHybrid` from `src/game/shard/runtimeVariant.ts` once callers/fixtures use the one entry.
   **Keep ShardContext/ShardPlugin and their staged host API.** `runtimeVariant.ts` also exports `gridPage`, used by
   `src/game/shardfile/worldSceneSurface.ts`; move/retain that real function before deleting a file. Similarly,
   `src/game/shard/plugin.ts` still supplies `worldBuildYield` to `src/game/shardfile/worldAssembly.ts`; move the defining
   helper without changing its yield/barrier semantics before removing the frozen constructor facade.
4. **Resident lifetime:** `src/game/shardfile/hybrid.ts` is not wholly dead. `src/game/grid/liveSession.ts` and
   `regionalRuntime.ts` use its resident/session contracts; `src/game/shardfile/clientWorldAssembly.ts` uses its
   `HybridResidentWorld` cache. Keep/extract those definitions and the shared cache identity. Its standalone adapter
   uses `src/game/shard/scopedRuntime.ts`; preserve the borrow/restore of parent descriptors, entered/home runtime
   ownership and cleanup until the direct entry supplies the equivalent lifetime. Remove only the then-unused adapter.
5. **Old copied-runtime admission:** retire `LegacyRuntimeSchema` and the `entry` arm in
   `src/format/{runtime,outputIndex,outputFields,shardSchema}.ts`, then the corresponding branches in
   `src/sdk/{outputRuntime,outputProduct,project,cli,formatJsonSchema}.ts`. Keep ordinary named JSON, codecs, AS scripts,
   client-plan binding/spawn/cost validation and negative runtime-source refusals. Remove whole files/package keys
   only when their last live functions have moved or disappeared.

**Fixtures to change/run:** `test/{authored-manifest,authored-transition,client-runtime-declaration,entry-styles,
copied-runtime-build,output-runtime,platform-output-reader,hybrid-entry-preparation,hybrid-inventory,hybrid-product-rows,
hybrid-render-preparation,client-plan-platform,client-plan-boundary,client-plan-lazy,client-mover-owners,
held-entered,held-primary-entry,mounted-entry,driftwood-entry-lifetime,nalati-entry-construction,nalati-manifest-data,
nine-authored-manifest,island-book-product,world-construction}.test.ts` and
`src/game/shard/page-mode-boot.test.ts`. Replace synthetic legacy/empty-class constructors with explicit modern host
fixtures; keep complete CSS order, missing/duplicate preparation, grid/home ownership, inventory, save/quest,
lighting/readiness, disposal and malformed-source assertions. Accept copied-runtime inputs only as negative refusal
cases after removal. Final six-leg smoke and the maintained `node scripts/physics-baseline.mjs --no-build --mode=walk`
0-stuck milestone remain; no additional hand walk or checkpoint repin is invented.

### NF18: runtime-only TSL retirement after the same QA word

HEAD no longer has a live "Graph back-end: GLSL / TSL" Debug registration: the matched text in
`src/game/shardfile/clientMaterials.ts` is a stale comment, and its actual call is already `loadLookGraphCompiler`.
Do not add a switch to remove it. NF2's node mask branch still exists in `src/engine/world/coarseTileMask.ts`.
The October 30 chunk sizes in NF18 are historical; measure the actual parent/child, not those figures as today's saving.

- **Close the remaining lazy doors first:** `src/engine/render/dataLook.ts`, `src/game/looks/staticCapture.ts` and
  `src/game/shardfile/client.ts` still call `loadGraphCompiler`; migrate their required outputs to the shipped GLSL
  look/post contracts. `src/game/shardfile/clientGraphs.ts` still adapts raw compilers with `tslLookCompiler`; migrate
  injected compiler fixtures as well as the production signature. Keep graph validation/bindings, fog tokens,
  outlines, textures, post normal inputs, and ownership/disposal exact.
- **Keep the shared backend:** `src/engine/render/graphBackend.ts` currently owns both TSL and GLSL entry points,
  material map loans and cloning. Delete only `loadGraphBackend`, `loadGraphCompiler`, `tslLookCompiler` and their
  node-specific types/state after the callers move. Keep `loadLookGraphCompiler`, `loadPostGraphCompiler`,
  `bindGraphMeshMap`, `graphMeshMapBase` and required owner sharing. Its live readers include clientMaterials,
  clientGraphs, `src/game/looks/scaledPost.ts`, `src/game/grid/cellClip.ts` and `src/engine/world/declaredProps.ts`.
  `nodes/graphOwners.ts` has a real backend reader and no TSL import: move or retain necessary bookkeeping under a
  neutral owner before retiring the directory. Do not delete the GLSL `graph/{glsl,glslMaterial,glslProgram}.ts` files.
- **Retire node implementation:** `src/engine/render/graph/compile.ts` and `src/engine/render/nodes/` contain the
  production value imports of `three/webgpu` / `three/tsl`. The directory has 31 tracked files including its tests.
  Remove the handler and node-only implementations, move independent CPU/validation oracles where needed, and
  reconcile defining engine exports. Update the `installedGraphBackend` diagnostics in `src/engine/core/Game.ts`
  and node blocks in `src/engine/render/precompile.ts`, without removing classic shader warm/link/readiness work.
- **Remove node halves, retain classic behavior:** inspect `src/engine/render/{fogPatches,regionLook,nodeLayerFrame,
  shadowDepthVariants,instancedTwin}.ts`, `src/engine/world/{coarseTileMask,backdropLayer,declaredProps,skyRig}.ts`,
  `src/engine/models/instancedBatch.ts` and `src/engine/entities/AnimalFactory.ts`. The handler installs node-layer
  framing; backdropLayer calls it. Delete that branch only with its caller and retain classic frame defines/fade,
  shadow resolvers, masks and skin/instance behavior. Eliminate leftover node-only type imports too; don't mistake
  `isGraphShaderMaterial` (the shipped classic path) for `isNodeMaterial`.
- **Test migration is explicit:** rebase the tests under `src/engine/render/graph/` and `nodes/` that import the TSL
  compiler/handler onto the equivalent classic contract or an independent reference oracle. Keep refusal, stage-order,
  uniforms, graph-map clone, lighting, shadow, mask, skin, instance and disposal checks; only assertions solely about
  the deleted backend disappear. Include `src/engine/core/node-gpu-rebind.test.ts`,
  `src/engine/render/graph/{node-build-reuse,graph-batch,graph-ambient-ibl,graph-declared-fog,graph-pbr-loan,
  graph-clip-position,layer-frame-graph}.test.ts` and the existing GLSL suites, plus the client graph/post/data-look
  tests. Retain build-time TSL callers under SDK/shard generators and author tools if they are outside the app graph.

**NF18 closure gates:** actual emitted app reachability/chunks contain no runtime `three/webgpu` or `three/tsl`;
matched parent/child boot wire is at least **100 KB gzip smaller**; the maintained NF15/NF17 performance bounds still
hold at HEAD; every shard's frame-floor and golden cases pass with their existing rules. Inspect the build manifest
and downloaded boot closure as well as source imports: a removed static edge alone is not the size proof. All native
measurements run once at the combined milestone through the agreed queue, not once per node-file deletion.

### LD10: rooted orphan/member sweep and ENGINE.md

Run a fresh HEAD importer/export/member census **after steps 4 and 5**, rooted at app entry, worker/service-worker
entries, the SDK CLI/bin and author tools, Blender string loads, package exports, tests/oracles and declaration merges.
Resolve aliases, dynamic imports and reflective/string-keyed dispatch; a package export or test reference is still a
reader. `scripts/check-graph.mjs --source-only` checks layers/reach but is not a complete orphan detector. Treat the old
61-export review list in legacy-deletion as candidates, rechecking each against this later parent before deletion;
keep private functions still called inside their module. Keep ShardContext's bag/rows/manifest/product/cube members
with modern or reflective readers. Record a defining modern owner for every moved API and an explicit keep for each
remaining caller; no broad public-export purge.

Two concrete surviving loans can then go: `src/entry.ts` dynamically imports
`src/sdk/runtime/audio/{combatCues,weaponVoices}.ts`. Retarget to the existing `sharedCombatCues` / `sharedWeaponVoices`
in `src/game/plugin/audio.ts`, preserving function identity, cue/sample order and deferred boot-bank readiness, then
remove those wrappers, their SDK source/publish keys and only their facade-debt rows. `src/entry-spawn.test.ts` must
assert the new defining loans while retaining original boot behavior. Conversely, `src/engine/world/blenderArea.ts`
**stays**: `scripts/blender/lib/export-scene.mjs` string-loads it, and `test/driftwood-ground-bounds.test.ts` uses its
bounds. `src/format/groupBrains.ts` stays as modern schema. Neither is an orphan even if an app-only graph omits it.

Update `docs/ENGINE.md` with the same removal commit: the SDK audio examples, ShardPlugin / standaloneHybridEntry /
declared-entry sections, lazy TSL door/node handler sections, graph ownership/lifetime and the now-single entry API.
Keep build-time graph DSL and modern grid-resident documentation. Correct already-stale examples rather than pointing
them at another facade. Public module keys are in defining `src/{engine,game,sdk,format}/package.json` (SDK publishConfig
too); regenerate ignored API/export documentation normally with `pnpm docs`, never hand-commit generated tables.
Run the affected owner/fixture suites, strict types/lint and fresh graph/deleted-path/ratchet checks; finish the common
six smoke legs on the final containing source. Every surviving explicit keep must have its actual caller named.

### CO8: archive only the completed queue, fix all references

The coordinator first reconciles the current rows rather than the obsolete October 28 percentages above. LD5–LD10,
NF18 and all other SHARD-PLATFORM attached rows must be done, dropped, superseded or folded with their exact destination
and acceptance; no unowned/open implementation row can disappear into an archive. CS10's retained live-user exits are
not permission to delete its guards or quietly declare another live plan finished. CI-FIRST-PRINCIPLES is outside
SHARD-PLATFORM under G924; parked OPEN-PLOTS and BURN-DAMAGE-LIST keep their own states.

In one HEAD-only archive commit, mark the finished plans and move `docs/plans/SHARD-PLATFORM.md` to
`project/archive/<execution-date>-shard-platform.md`, and its completed companion pages to the matching dated archive
folder: `docs/plans/shard-platform/{close-out-mini-plan,legacy-deletion-mini-plan,nine-fix-mini-plan}.md` plus the other
then-finished attached mini plans, `decisions.md`, `decisions-archive.md`, `STATE.md`, `history.md`, `rows.md` and remaining
plan-owned reviews/ledgers. The coordinator owns STATE; this audit does not edit it. `qa-fixes` is already
`project/archive/2026-10-29-qa-fixes.md`; custom-code-freeze already lives at
`project/archive/2026-10-28-custom-code-freeze.md`: fix their references, do not invent a second live copy to move.

Re-enumerate all current incoming links in tracked docs, code comments, scripts and ask/review records using the old
literal paths/basenames and relative targets before the move. Current incoming families include
`docs/plans/SHARD-PLATFORM.md`, `docs/plans/shard-platform/{decisions.md,lanes/ready-queue.md,legacy-explorer-lists.json}`,
`docs/reviews/legacy-deletion-plan.md`, the custom-code-freeze / Nine / Far Reach / QA archives and
`scripts/legacy-explorer-lists.ts`. Retired tools from LD8 need no recreated file just to update a link; retained
historical files get the correct archive target. Update docs navigation / live-plan registry and all relative links
inside moved files, then check every archive target and require zero stale live-path references. Keep historical
commit IDs and quoted decisions; a basename in an explanatory history paragraph is not an active broken link.
Run `git diff --check`, link/path verification, asks/status validation and the normal commit/push gate. Only after the
archive commit is pushed does the coordinator release completed lanes/builder normally (G824), never interrupting an
in-flight command. This step names no new phone chore, CI dispatch, branch or source deletion now.
