# E435 clean-room audit: SHARD-PLATFORM and the MMO docs (Claude seat)

Auditor: Claude (clean room, read-only). Repo HEAD while auditing: `a7efb8ff6` (plan State line + Q5 "package-first").
Scope: `docs/plans/SHARD-PLATFORM.md` (SP), `docs/design/mmo/{MMO-REQUIREMENTS, SHARD-PLATFORM-PLAN, VISION, GLOSSARY,
SHARD-IDEAS, ONE-SHOT-REVIEW}.md`, and the P0 code they call done. Every number below is a command I ran; the
baseline tree `06de6df0e` was exported with `git archive 06de6df0e src` and searched with `rg`.

## Verdict

**The P0 scaffolding is real code, but most of what it calls "done" checks nothing yet, and the plan's headline
numbers are either unreproducible or wrong.** The §2 audit table, the source of every percentage in the plan
(the 42/11/27 phase split, the P5 targets 5/16/15/28/25/28/31, the "already 80/20 in aggregate" story), has no
committed classification behind it. The API-coupling counts that motivate SP11 (127 / 86 / 61) do not reproduce
with any pattern I tried. Three of the five "ratchets" don't ratchet. The world-contract test passes Nine Dragon
against a fake flat plane.

More important than the bad numbers: **the plan optimises the wrong quantity.** "TS lines outside `runtime/`"
measures where first-party code lives, not whether a stranger's shard can run without trusted code, on a server, on
a phone. Under Jake's package-first decision the plan's order runs backwards: the format, loader and validator
(P6, SP29/SP30) come last, after ~30 agent-days of speculative engine systems built against six shards that don't
need them for security. The netcode blockers the plan itself lists (aim ray from the viewmodel camera, hit-stop
scaling the fixed step) get no row at all.

## 1. Claims table

Verdicts: **true** · **false** · **exaggerated** · **unverifiable** · **hollow** (the code exists and passes, but the
check is vacuous or bypassable).

| # | Claim | Where | Verdict | Evidence |
|---|---|---|---|---|
| 1 | "Line counts are exact" for the table "at `06de6df0e`" | SP:50–52, 58–65 | **false** (small) | At `06de6df0e`: Driftwood 18,803 · Pine 21,762 · Nalati 33,115 · ND 25,177 · SD 4,826 · FR 6,893 · template 554. The table has Driftwood 18,766 / Nalati 33,094 / ND 25,166, which are `b96fed1a1`'s counts (a later commit), SD / FR / template from `06de6df0e`, and Pine 21,716, which matches neither commit. It's a mix of two snapshots, off by ≤ 0.2 %. Cmd: `git ls-tree -r --name-only <c> src/shards/<s> \| grep -E '\.tsx?$' \| xargs git show \| wc -l` |
| 2 | Total 110,461 | SP:64 | **true** (arithmetic) | The six table rows add up to 110,461 |
| 3 | The bucket shares (G/D/S/C/X per shard) | SP:56–65 | **unverifiable** | No per-file classification is committed (`rg -l "110,461"` finds only the plan; the commit `4a95c2454` touched four docs and no data file). They are self-described "estimates … ±5 points". The aggregate lands exactly on the target (C+X 20 %, G+D+S 80 %), which is suspicious for a hand estimate |
| 4 | Phase split G 42 % / D 11 % / S 27 % | SP:64, 141, 148, 156 | **unverifiable** | Derived from #3. The weighted arithmetic is consistent (41.7 / 11.2 / 27.5 %), but its inputs can't be reproduced |
| 5 | `ctx.app` used 127 times in shards | SP:101, SP11 | **false** | 95 occurrences (85 lines) at `06de6df0e`, at its parent and at HEAD. Template 22, Nalati 29, FR 16, Pine 11, ND 7, SD 7, Driftwood 3. Cmd: `rg -o -g '*.ts' 'ctx\.app\b' src/shards \| wc -l` |
| 6 | `ctx.game` used 86 times | SP:101 | **false** | 103 (including `.runtime`) at `06de6df0e`; 103 at HEAD. No pattern I tried (with or without the template, with or without `.runtime`) gives 86 |
| 7 | The newest two shards reach `ctx.game.runtime` 61 times | SP:101–102 | **false** | SD 20 + FR 12 = **32**. All shards including the template: 52. The uses are toast, `animals.spawn/retire` and `interactables.push`, but also raw `world.game.scene` and `world.player` (raw three.js access, not just "missing verbs") |
| 8 | Shards extend `Weapon` 10 times | SP:103 | **exaggerated** | 4 direct (`Bullwhip`, `WarFan`, `TemplateWhip` + generic form). 7 counting the kit intermediates (`Spear extends Melee`, `Sabre extends Sword`, `GoldenBow extends Bow`, `LeverRifle extends Firearm`) |
| 9 | Shards extend `Tool` 4 times | SP:103 | **false** | 2: `FeiZhua` (ND), `TemplateLantern` |
| 10 | `CreatureBrain` 13 | SP:103 | **true** (direct) | 13 direct; 12 more classes extend shard-local brain bases (`AdvAnimal`, `GroupBrain`, `PineElite`…), so the real surface is larger |
| 11 | `Boss` / `BossBrain` 6 | SP:103 | **true** | 2 + 4 |
| 12 | "Quest glue (3.7k lines)" that a logic system replaces | SP:166 (SP12) | **exaggerated** | 3,798 lines in `quest/` folders, but they include `pine-hollow/quest/npcModels.ts` (144), `ui.ts` (166), `rides.ts` (162), `nightBrain.ts` (105), `Finale.ts` and `TraderStall.ts`. That is meshes, UI, AI and a boss finale, not flag glue |
| 13 | ~110 shard files hold GLSL / `ShaderMaterial`; 46 use `patchShader` | SP:77–78 | **true** (approx.) | 113 files and 47 `patchShader` at base; 116 / 47 at HEAD |
| 14 | `ShardContext` has ~19 members, several not data | SP:99–100 | **true** | `LevelContext` (src/engine/level/context.ts:55–88) has 17, `ShardContext` adds 4 (src/game/shard/context.ts:24–33). `app`, `root: Group`, `piece`, `hud` are not data |
| 15 | Interactables: 10 kinds, pure data | SP:83 | **true** | 10 distinct `kind:` values in src/engine/world/interact/types.ts |
| 16 | "Every manifest already declares a 500 × 500 × 500 cell" | SP:90; MMO-REQ:174 | **false** | `src/shards/_template/manifest.ts:12`: `placement: { grid: [0, 0], size: [200, 200, 200] }`. The one shard that is false is the package-first shard |
| 17 | `placement.grid` / `size` are read by nothing | SP:112 | **true** | Nothing in src/engine, game or kit reads `.placement`. Grid values (Driftwood `[-1, 6]`, Nalati `[4, -2]`, FR `[1, 4]`) fall outside the 5 × 5 grid of W3 anyway |
| 18 | The aim ray comes from the viewmodel camera; hit-stop scales the fixed step | SP:108–109 | **true, and unplanned** | `src/engine/combat/Weapon.ts:56–59` (`this.model.parent` camera); `src/engine/core/Game.ts:592` ("hit-stop slows them with everything else"). **No SP row fixes either** (`rg -n -i "aim\|hit-stop" docs/plans/SHARD-PLATFORM.md` hits only §2). Only §6's done-when needs a headless sim |
| 19 | SP1: `sim-no-render` fixed; quest / event code "passes at 0" | SP:135 | **true as written, hollow as a headless claim** | `lint/wildshard-plugin.js:487–491` is fixed, fixtures exist, and `test/arch-guards.test.ts:43` checks the folders exist. But the rule checks **direct imports only**. `src/engine/ai/reach.ts:2` imports the `app` singleton from `app/runtime`, which imports `App` (the whole client). `src/engine/entities/Animal.ts:2` does `import * as THREE` and imports `app`, yet the core creature entity sits outside `SIM_DIRS`. "0 sites" does not mean "runs in Node" |
| 20 | SP2: the `profile` scope exists, no key uses it | SP:136 | **true** | `src/engine/saves/store.ts:10,12`, `native/saves.ts:25`, tests in `test/engine/saves.test.ts:48–58` |
| 21 | SP2: "the travel handoff names it as its future home" | SP:136 | **false** | `rg -i profile src/game/travel/` → nothing |
| 22 | SP3: `check-row-data.mjs` walks 44 row types; 45 function fields | SP:137 | **true** | ROW_TYPES has 29 + 7 + 8 = 44 (scripts/check-row-data.mjs:18–28); `lint/row-functions.json` has 45 |
| 23 | SP3 "What": "a test round-trips every registered row … through JSON" | SP:137 | **false** | `test/row-data.test.ts:20–23` round-trips one row set, `STARTER_EFFECTS`. The rest is a type walk |
| 24 | SP3 / SP4 / SP5 lists "may only shrink" | SP:137–139, `lint/*.json` | **hollow** | `check-row-data.mjs --update` rewrites the list to whatever exists now, additions included; nothing compares against HEAD. A new row type left out of the hand-kept `ROW_TYPES` escapes completely. `edge-exemptions.json`: the test only checks that the slugs exist (world-contract.test.ts:23), so adding a level passes. `shard-platform.json` `enforced: {}`, so there are no ceilings at all |
| 25 | SP3 misses the most important "row": the manifest | — | **gap** | `ShardManifest` (src/game/shard/manifest.ts:434–580) has ~16 function fields (`load`, `render`, `roster`, `groundColor`, `surfaceAt`, `pondClip`, `ktx2`…) plus `ground.terrain.heightAt`. It is not in ROW_TYPES. It is the root of the future `shard.json` |
| 26 | SP4: `CELL_HEIGHT/BELOW/ABOVE` exported from engine data | SP:138 | **true** | src/engine/core/config.ts:9–11 |
| 27 | SP4: "all seven levels pass" the world contract | SP:138 | **hollow** | The test passes 9/9 (I ran it). But `far-reach` has no height field and returns early (world-contract.test.ts:27). Nine Dragon's `TERRAIN` is `landscape: () => 0`, "neither drawn nor registered as a heightfield" (src/shards/nine-dragon-stack/terrain.ts:4–6), while its real floor is at `Y0 = 125` (layout.ts:6), so its edges pass against a fiction. Driftwood's edges are exempt. Edges are really checked on Pine, Nalati, SD and the template only. Structures are never bounds-checked, so a 500 m-high stack would pass |
| 28 | SP5: `check-chunks` refuses generator code in any chunk | SP:139 | **true, vacuous** | scripts/check-chunks.mjs:39; run in vercel-tree-gate.sh:64. No `generators/` folder exists in any shard (`find src/shards -type d -name generators` → none) |
| 29 | SP5: `wildshard/no-runtime-generator` is hard in `.oxlintrc.json` | SP:139 | **true, vacuous** | .oxlintrc.json:172; fixtures in cases.json:593–614. 0 targets exist |
| 30 | SP5: `sim-no-render` over `src/shards/*/data/` | SP:139 | **true, vacuous** | `SHARD_SIM_DIRS = ['data']`; no shard has `data/` |
| 31 | §1: "`data/` files export serialisable values only (a JSON round-trip test)", enforced from SP5 | SP:45–46 | **false** | No test reads `src/shards/*/data`. A shard can move closure-laden code into `data/` and it counts as data |
| 32 | §1: "A shard born after SP5 (and the template) has no `runtime/` folder" | SP:48 | **false** (unenforced) | `lint/shard-layout.json` `folders` allows `runtime` for every shard, the template included |
| 33 | `scripts/shard-platform.mjs` measures §1's metric | SP:38–40 | **false** | §1: numerator = lines under `runtime/` + "plugin glue" (undefined). Script (L33–44): everything **not** under `generators/` or `data/` counts as runtime, and `runtime/` is never looked at. Raw newline counts, comments and blanks included. The script is stricter, but it's a different metric, and the gate can't fail (`enforced: {}`) |
| 34 | The gate "prints the share; the ceiling only goes down" | SP:43–44, 139 | **hollow** | `node scripts/shard-platform.mjs --check` → exit 0 with **every shard at 100–107 %** (template 588 vs 550 baseline). The shards grew past their baseline within hours of it and nothing noticed |
| 35 | P5 targets 5 / 16 / 15 / 28 / 25 / 28 / 31 % "custom today" | SP:191–198 | **unverifiable** | Copied from #3's C+X column. The only reproducible measurement (#34) says 100 %. They are "after every system exists" figures presented as "today" |
| 36 | SP21 pilot: King's policy ~190 lines | SP:180 | **true** | KingGoals.ts 96 + combatMath.ts 97. But it reads `Animal` (a THREE-bearing object) directly, so the hard part is the state marshalling, not the 190 lines |
| 37 | GAME-NORMALIZATION's 25–34 agent-days ran in ~2 days | SP:227 | **true, misleading** | E357 commits: 142 on 09-30, 773 on 10-01. That work was file moves under a parity gate. P3 is new-system design, a different kind of work |
| 38 | The one-shot is ~86k lines | ONE-SHOT-REVIEW, SPP §2 | **true** | 87,205 non-test src lines at `bb608d4` |
| 39 | "Every shard is 4k–30k lines" | MMO-REQ:43–44 | **exaggerated** (minor) | Nalati is 33.6k |
| 40 | `WeightedTable.when` has 19 uses | SP:95 | **unverifiable** | 41 `when: (` sites in src; the claim's counting rule isn't stated |
| 41 | Glossary: `entryRoadMask` in `src/chunks/terrain.ts` | GLOSSARY:13 | **false** (stale) | It's at `src/engine/world/terrainField.ts:72`; `src/chunks` doesn't exist. SHARD-PLATFORM-PLAN §2/§7 cite `src/chunks/*`, `src/world/*` and four shards: stale (flagged "reference", but still linked as "the thinking") |
| 42 | Q1 "Recommended: Born on the format" | SP:256 | **contradiction** | Jake answered the opposite (Thin Ice starts as code, State line + MMO-REQ T4), and today he picked package-first. The row still reads as the recommendation, and SP31 still plans a 7th shard as code |
| 43 | SHARD-IDEAS 2.1 "the 100 m below ground" | SHARD-IDEAS:45 | **stale** | Now 250 m (O1) |

**Tally of the load-bearing numbers:** the five API-coupling numbers (#5–#9): 2 true, 3 false or exaggerated. The four
percentage families (#3, #4, #34, #35): all unreproducible. The P0 "done" rows: built as code, but #21, #23, #24, #27,
#31 and #32 overstate what they enforce.

## 2. Strategy from first principles

### 2.1 The constraints, and what each one forces

| Constraint | What it forces | Does the plan follow? |
|---|---|---|
| **Untrusted code** | No author JS in the page origin. Behaviour runs as engine-interpreted data or in a capability sandbox (WASM, or a worker / cross-origin iframe with postMessage). Shaders can't be sandboxed, so only allowlisted material building blocks. Assets need hardened parsers (GLB / KTX2 / zip caps) | **Partly.** It names the right end state (MMO-REQ R1, R6, R7), then spends the milestone shrinking *first-party* TS, which is trusted by definition and never was the security problem |
| **Server authority** | Gameplay sim runs headless and deterministically on the server: hits from aim inputs, visual-only hit-stop, stable entity ids, input commands, snapshot / restore. Authored behaviour must run in Node, which favours data or WASM over browser-only code | **No.** The plan lists the blockers (§2 item 3) and schedules none of them. The authority model (full server sim vs. server-validated client) decides what the logic system and plugins must guarantee, and it is listed as "out of scope" (MMO-REQ §8) |
| **Phone budget** (30 fps hot, 1.0 GB) | Interpreters must be cheap per frame, and authored budgets must be checked statically and enforced at runtime. A shard's budget has to leave room for neighbours' impostors, other players' avatars and network buffers, which no current budget accounts for | **Weak.** Budgets are per shard in isolation. Baking procedural code into GLBs and instance lists can raise download and load memory (1.8 GB). SP7 guards `gpuMB` only |
| **API longevity** | Every approved system is a forever API: version it (`requires: logic@1`) and keep it small. A narrow host ABI ages better than a wide component zoo | **Inverted.** P3 grows the surface as fast as possible: 15+ devices, look passes, kit families graduated from **one** shard each (SP19's Sabre / Naizagai / Golden Bow / whip). Each one-user graduation is a permanent compatibility promise |
| **Claude Code as editor** | The authoring medium is text written by an LLM. Claude writes typed code well and large hand-wired JSON node graphs badly (verbose, unreadable diffs, hard to debug). Schema'd rows are great for LLMs. Behaviour is the hard part | **Ignored.** The logic system (SP12) is modelled on Fortnite devices / LittleBigPlanet, which are designed for a *visual* editor. The sandboxed language, the medium Claude Code is actually good at, is demoted to "P4, the way down for the 20 %", with Rust first, which Jake today called "maybe too heavy" (E435 Fork B) |

### 2.2 Is TS line count a meaningful metric? No.

- **It measures location, not trust.** First-party code is trusted whether it sits in `runtime/`, `src/kit` or
  `src/engine`. Moving a one-shard weapon into the kit (SP19) drops the shard's share and changes nothing about
  security, server authority or phone cost. It does grow the API you must keep forever.
- **It's gameable by folder name.** `generators/` and `data/` count as data. Nothing checks that `data/` is
  serialisable (#31), and `generators/` is only checked for not shipping (#28), which with no bake pipeline means
  moving code there breaks the shard. So the honest moves are blocked on P1 and the dishonest move (`data/`) is free.
- **The denominator is frozen while the shards keep growing** (+0–7 % in hours, #34), so the share drifts up
  during feature work and nothing enforces it until a conversion row.
- **It doesn't measure the MMO's real question:** *can a stranger ship a shard of this quality with zero code,
  booted from a package, simulated on a server, inside the phone budget?* Better metrics:
  1. boolean milestones: the template boots from a package with no shard JS chunk; its sim steps in Node; two
     clients agree;
  2. the count of non-data `ShardContext` members and raw `ctx.app` / `ctx.game.runtime` reaches (a real ratchet
     against HEAD);
  3. the gap log a clean-room author hits;
  4. the shard's JS chunk bytes and its package bytes.

### 2.3 Device / logic-graph catalogue vs a sandboxed general-purpose language

Both are needed, at different layers. The plan picks the wrong one as primary:

- **Rows and parameters are data** (items, species params, loot, spawns, quests as steps over flags, look presets,
  budgets). Cheap, LLM-friendly, statically checkable. Keep.
- **Behaviour should be a sandboxed language whose host API *is* the logic system.** Make the effect-returning,
  fuel-metered interpreter contract (the one-shot's `dispatch()` idea) the ABI. Authors write a small typed
  script (TS-subset → WASM, or QuickJS for event-rate code) that receives events and returns effects. The same
  module runs on the server and in the browser for prediction. That keeps "approved systems" small (the verbs,
  not a component per mechanic), keeps Claude Code in its strongest medium, and makes graduation optional
  instead of the only way to get a new mechanic.
- **A graph catalogue on its own forces the engine team to pre-build every mechanic.** That's Roblox's
  pre-Luau problem: every new shard idea becomes engine work. SHARD-IDEAS already lists three shards that "need
  full custom code".
- **Material graphs with our own dual-target compiler (SP18, Q2) is a product in itself.** Start with a library of
  parameterised material presets (the one-shot's approach) and a LUT; add graphs when a preset can't express a
  real request.

### 2.4 Over-built, missing, ordered wrong

**Over-built:**
- P3's nine system rows (18–24 agent-days, built speculatively against six shards).
- The material-graph compiler to two targets (WebGL patches and TSL).
- Look stacks for four bespoke looks.
- Kit families for one-off weapons.
- Four paper ratchets for folders that don't exist.
- Seven MMO docs (1,651 lines) for a draft plan. The one-shot's lesson, "paper trail is not progress"
  (ONE-SHOT-REVIEW), is being repeated.

**Missing (each shapes the format now, so "out of scope" is wrong):**
- **The authority / netcode model.** Full server sim vs. server-checked client decides determinism, what the
  interpreter guarantees, whether physics (Rapier) runs server-side, and fixed-step semantics.
- **The sim/render split for the existing code:** aim ray, hit-stop, stable entity ids, input commands. `Animal`
  is a THREE object holding the app singleton.
- **Persistence and anti-cheat:** the profile scope lives in localStorage. An MMO profile is server-owned; the
  reserved scope proves nothing about that.
- **The security boundary beyond JS:** GLB / KTX2 / audio decoder hardening, zip caps, text and image
  moderation, private-asset URLs (U4).
- **The asset pipeline / CDN:** content addressing, per-shard download caps over cellular, iOS storage quota
  for the service-worker cache, neighbour impostors (W8) in the memory budget.
- **Cost:** a server process per room running physics + brains + interpreter, and its $ per CCU.
- **Versioning / deprecation of approved systems.**
- **Avatars and other players** in the phone budget.

**Ordered wrong (given package-first):**
- The format (SP8 schemas), the package loader (SP29) and the validator (SP10) must come **first**, driven by the
  template. Only the systems the template needs get built: a kit weapon for its whip, a boss phase table for
  Big Blob, an archetype for the grey blob, quest data, a look preset, a baked or heightmap world.
- SP30 ("a shard born on the format") is the milestone and sits last.
- Thin Ice "starts as code" (Q1, SP31) directly contradicts package-first: it manufactures a 7th conversion.
- The six shards' 80/20 should follow and be pulled by demand, not pushed by a percentage.

## 3. Risks the docs don't name

1. **Goodhart on agents.** Rows went "done" with checks that cover 0 sites (#28–#31) and ratchets that accept
   growth (#24). Future agents will meet the % by relocating code (kit, `data/`) unless the metric changes.
2. **Engine API bloat as permanent debt.** Every one-shard graduation is a compatibility promise to strangers'
   shards for years (MMO-REQ P4).
3. **Parity is unrealistic for re-implementations.** "Identical under the parity harness" held for file moves.
   A generic water / brain / look system replacing hand-tuned shard code won't be pixel-identical. Expect waves
   of variant boards to Jake on shipped shards, and taste churn on finished work.
4. **Phone regressions from generic systems.** Generic graph shaders and interpreters replace hand-tuned code on
   a device already at its limit (cf. `docs/audits/nine-dragon-phone-regression.md`). Baked GLBs and instance
   lists can be bigger than the code that generated them (download, loading memory, SW cache).
5. **Moving targets.** SIGNAL-DUNES, SKY-REACH, NINE-DRAGON (E380 re-plan), DRIFTWOOD-REMASTER-V2 and THIN-ICE are
   live. Conversion fights feature work, and baselines drift (#34).
6. **Determinism across devices** for client prediction (JS float, Rapier builds), which nobody has tested.
7. **LLM authoring ergonomics for graphs:** untested. Nobody has asked Claude to author and debug a 200-node
   logic graph.
8. **Shader cost caps don't prevent GPU hangs or context loss** on iOS; there is no recovery path in the docs.
9. **Lint-only boundaries:** first-party code is policed by lint that any agent can `--update`. Fine for trusted
   code, but don't let the docs imply it's a security property.
10. **Estimate optimism:** 45–55 agent-days anchored on a mechanical refactor's two-day wall clock.

## 4. Keep / cut / change

**Keep:**
- SP1's path fix.
- SP2 (cheap).
- The SP3 type walk, as an inventory.
- The CELL constants.
- `shard.json` / `layout.json` / validator / server-owned fields / budgets-in-one-file (good ideas from the
  one-shot).
- The rejection-fixture-per-rule discipline.
- The leak test.
- Seeded RNG.

**Cut:**
- Per-shard % targets as the headline metric and the P5 % table (unreproducible).
- SP18's dual-target compiler (for now).
- SP19's one-shard kit families.
- Look stacks for all four looks before any stranger needs one.
- The 7th code shard (SP31).
- Most new doc pages.

**Change:**
- Make the ratchets real: compare against `git show HEAD:<list>`, and fail on growth and on unlisted row types.
- Add `ShardManifest` and `ground.terrain` to the row walk.
- Make the world-contract test fail on structures-only and flat-datum levels: walk the colliders, or list them as
  exempt.
- Make `sim-no-render` transitive (import-graph closure from the sim dirs must not reach `three`, `app/runtime`
  or the DOM).
- Make the template declare 500³.
- Replace §1's metric with the milestone booleans in 2.2.

## 5. Top 10 recommendations (ranked)

1. **Re-plan around the package-first milestone, concretely:** *the template boots from `shard.json` +
   `layout.json` + `content/` + baked assets with **no shard JS chunk**, passes `wildshard validate`, and its sim
   steps in plain Node.* Build only what the template needs, then SP30 (a clean-room shard). Delete P5's %
   targets as gates.
2. **Decide the behaviour model before building SP12 / SP13 / SP15.** Run a one-week spike: the same template
   mechanic (Big Blob's fight, plus a pressure-plate door) written as (a) a data graph, (b) a TS-subset → WASM
   script, (c) QuickJS. Measure Claude authoring success and debug loops, phone frame cost, Node / browser
   parity and fuel metering. Make the host API the effect-returning interpreter contract in every case.
3. **Fix the netcode blockers now, as rows:** aim from input, not the viewmodel camera; visual-only hit-stop;
   stable entity ids; input commands; snapshot / restore of the template's sim. Make `sim-no-render` transitive.
   These are cheaper today than after more systems are built on top of them.
4. **Pick the authority model (Fork C) before freezing the format**, and prove it with a throwaway two-client
   authoritative prototype of the template (thin Node server, Rapier server-side), so the package format is
   tested against netcode rather than assumed.
5. **Make the guards honest:**
   - real shrink-only ratchets against HEAD;
   - `ShardManifest` in the row walk;
   - a `data/` JSON round-trip test;
   - "no `runtime/`" enforced for the template and new shards;
   - a world-contract test that can't pass a fake datum;
   - fix the stale P0 claims (#21, #23, #27, #31, #32) in the plan.
6. **Kill Q1 / SP31 (Thin Ice as code)** or hold it until the package boots. A new code shard contradicts
   package-first and adds conversion debt (SHARD-PLATFORM-PLAN §9 said exactly this).
7. **Shrink "approved systems" to verbs + presets:** a small versioned host API (`requires: x@1`), a material
   *preset* library with parameters and a LUT, a handful of archetypes. Graduate a system only when ≥ 2 shards
   (or one stranger) need it, with a written compatibility promise.
8. **Put the missing platform pieces on the map** with owners and a one-paragraph decision each:
   - server-owned profile / persistence;
   - asset parser hardening and size caps;
   - CDN / content addressing and the iOS cache quota;
   - neighbours and avatars in the 1.0 GB budget;
   - moderation;
   - server cost per room.
9. **Replace the % with milestone booleans plus the three real ratchets** (non-data `ShardContext` members, raw
   `ctx.app` / `ctx.game.runtime` reaches, shard JS-chunk bytes). Re-measure the coupling numbers with a
   committed script, since the plan's 127 / 86 / 61 are wrong (actual 95 / 103 / 32 for the two newest shards).
10. **Cut the paper:** freeze the MMO docs at one requirements page plus this plan; mark SHARD-PLATFORM-PLAN
    historical (stale paths, four shards, 200 m); don't write more design pages until the template boots from
    a package.

## Appendix: commands (abridged)

```
git archive 06de6df0e src | tar -x -C $SCRATCH/base          # baseline tree
rg -o -g '*.ts' 'ctx\.app\b' src/shards | wc -l              # 95 (base and HEAD)
rg -o -g '*.ts' 'ctx\.game\b' src/shards | wc -l             # 103
git grep -o -E 'game\.runtime' 06de6df0e -- src/shards | cut -d/ -f3 | sort | uniq -c   # SD 20, FR 12, template 12 …
rg -g '*.ts' -o 'class \w+(<[^{]*)? extends \w+' src/shards | awk '{print $NF}' | sort | uniq -c
node scripts/shard-platform.mjs --check                      # every shard 100–107 %, exit 0
pnpm exec vitest run test/world/world-contract.test.ts       # 9/9 pass (ND against `landscape: () => 0`)
python3 -c "…len(json.load(open('lint/row-functions.json'))['fields'])"   # 45
find src/shards -type d \( -name generators -o -name data -o -name runtime \)          # none
```
