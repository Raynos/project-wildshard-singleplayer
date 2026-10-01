# GAME-NORMALIZATION v2 · 00 — Traceability

Jake (E357): the plan *"needs to cover everything we've spoken about"*. This file traces each thing that was said,
decided, audited or researched to the row and spec section that carries it, or says why it is out and where it went.
Council seat B (12 §1) checks this file first. §7 lists the gaps and conflicts the first trace found, and where each
is now covered (all 21 are resolved).

**How to read it**
- **IDX** = [GAME-NORMALIZATION.md](../GAME-NORMALIZATION.md), the index. **01…13** = the files in this folder. A `§`
  is a heading of that file (`01 §12` = "12. Scheduler", `02 §F7` = "F7 — Delete the dead", `10 X1`, `11 Z3`,
  `05 §6.5` = "6.5 S1.5 …"). Line numbers are never used: the files are still being edited.
- **Rows** are the plan's rows (F0–F12, S1.1–S4.4, M1–M4, X1–X9, Z1–Z4).
- **Status:**
  - `covered`: I read the cited section, and it does what the row says.
  - `partial`: part of it is carried, and the rest is a Gap (§7, `G<n>`).
  - `superseded`: a later decision replaced it (the row names the successor).
  - `out`: deliberately not in this plan (why, and where it went).
  - `conflict`: two specs disagree, or a spec contradicts a decision (§7 has the detail).
  - `gap`: neither in the plan nor dispositioned as out (§7).
  - `honoured` (the "don't copy" rows only): the plan does not copy it; the cited section shows how.
- **Snapshot.** First traced against commit `b9e9670f` plus the consistency pass (committed in `0ca31c48`). Every row
  was then re-checked after the gap closure, which applied 13-lead-resolutions' last four tables (04, the still-open
  spec questions, G1–G21, C1–C10) to the index, 02, 03, 05–08, 10 and 12 on 2026-09-30. Every `02` / `03` / `05`–`08`
  section cited below exists under that name. If a later pass changes a cited section, the council re-checks that row
  instead of trusting it.

## 1. Jake's aims

E127 (2026-09-25) is five sentences (A1–A5). E357 (2026-09-30) is Jake's context (C1–C7) and his bar for the plan (P1).

| ID | Aim | Covered by | Status |
|---|---|---|---|
| A1 | "I want one implementation of a thing" | IDX §6 done-when "every group in the audit has one implementation"; the dedupe rows S1.2, S2.2–S2.4, S3.4–S3.5, S4.2, X5 (table 3 maps each duplicate group) | covered |
| A2 | "the three shards to be built on a shared baseline" (four shards now) | IDX §2.1 four layers; 01 §0; S1–S4 put each of the 4 shards on it | covered |
| A3 | "the shards to be standalone things on top of the core gameplay features" | 01 §6 (manifest) and §7 (plugin + `ShardContext` verbs); every shard spec §3–§4; 11 Z1 (template), Z3 (shard 5) | covered |
| A4 | "I don't want 100s of if statements" | 01 §24 `wildshard/no-shard-branch` (starts at 269); 02 §F4 (the ratchet from day one); 08 §6.4 S4.4 (0 in engine / game / kit); IDX §6 | covered |
| A5 | "pure refactor and removing duplicate code and normalizing the shards to share one core game thing" | IDX §3 refactor bar (identical under the harness: 02 §F2, 03); 12 §5 (a red result is reverted). Jake's own later decisions add features on top: 9, 38–40, 44, 47, 55′, 78–80 | covered. The extras are his decisions, and each one ships on a board or a milestone |
| C1 | A base, flexible engine with interfaces; anyone (Jake included) can add a 5th, 6th or 7th shard | 01 (the whole contract); 11 Z1–Z3 (template, docs, a fresh agent builds shard 5 with zero engine edits); decision 51 | covered |
| C2 | A shard is a directory that implements an interface, like a plugin. It is "almost dynamically loaded", but static for performance, baking and optimization | 01 §6 (node-safe manifest the bakers read), §7 (lazy `load()`, generated registry); 02 §F9; 10 X3 steps 7–10 (the chunk layout, the main-chunk check, the iOS 27 retry re-test) | covered (G1 resolved) |
| C3 | Code the shards share that isn't engine goes into a shared library | 01 §0 layers, §21 `#kit`; 04 §1.2 rules; 13 (04 #9: 5 files go to the kit at F6) | covered |
| C4 | No shard `if` in `main.ts`; the base game boots straight into whatever makes sense | 13 (04 #12: `main.ts` is the composition root, ≤ 20 lines); 08 §6.4 S4.4 (`engine/boot.ts` ≤ 150, ratchet 0); 08 §7 D4 (the default shard comes from the registry order) | covered |
| C5 | Move as much as possible into the shared baseline, and everything shard-specific into its shard directory | 02 §F6 + 04 (all 906 `src/` files mapped: layer + destination); S1.1 / S2.1 / S3.1 / S4.1 inventories (05–08 §1) | covered |
| C6 | This session holds a lock on the whole repository | 02 §F0; 12 §2 (decisions 33, 52) | covered |
| C7 | "We're touching everything related to the engine now, we may as well do it properly" (AAA and mobile practice set the bar) | IDX §0, §1 (8 research docs); tables 4–5 below | covered |
| P1 | The plan isn't ready until independent clean-room reviewers (Codex included) find no holes, and it "covers everything we've spoken about" | 12 §1 (council, decisions 81–83, 90′); this file | covered |

## 2. Jake's decisions (E357 decision table)

The numbers are E357's. A revision sits right after the decision it replaces.

| # | Decision (short) | Covered by (row · spec §) | Status |
|---|---|---|---|
| 1 | Layout: `src/engine/` + `src/kit/` + `src/shards/<slug>/` | 01 §0 Layers, Aliases; IDX §2.1; F6 (02 §F6, 04 §1) | covered |
| 2 | Lazy per shard: defs static, each shard's code one lazy import, prefetched and cached offline | 01 §7 load order (`manifest.load()` prefetched in parallel), §8 (SW precache); F9 (02 §F9); IDX §2.2 Loading; 10 X3 steps 7–10 (`codeSplitting.groups`, `check-chunks.mjs` in the pre-push gate, the shard chunk through `retried()`, the iOS 27 re-test) | covered (G1 resolved) |
| 3 | Rule of two; mechanism vs content | IDX §2.1 layer rules; 01 §0, §21; 04 §1.2 | covered |
| 4 | Small differences may merge (before/after board); found bugs fixed inline | IDX §3, §7; 12 §6; 03 §8; each shard spec §7; 09 §3.4 | covered |
| 5 | Boundary = mechanism vs content; melee + ranged combat is engine | 01 §18 (`#engine/combat`: Equipment, Weapon, Tool, the public blocks, GAS-lite, pipeline); the families are kit by 25 | covered |
| 6 | One board per wave; identical steps and bug fixes ship on a green harness | 12 §5, §6; IDX §5 | covered |
| 7 | All four extras: 5th-shard proof, input actions, delete dead + dev copies, a permanent parity gate | 11 Z1–Z3; 10 X1 (+ S1.4); 02 §F7; 02 §F2 / §F3.2, 03 §16, 11 Z4 | covered |
| 8 | Order: Nine Dragon → Pine Hollow → Nalati → Driftwood | IDX §4 S1–S4; 12 §9 | covered |
| 9 | Scope expanded: fold ENGINE-FIT in, research AAA and mobile practice | IDX §0, §1, §8; 02 §F0 step 3 (ENGINE-FIT archived); tables 4–6 | covered |
| 10 | Weapons = archetypes + profiles | 01 §18 (the ladder); 09 §1.3–§1.4; S1.2, S2.2, S3.3 | covered |
| 11 | Engine AI; species by the rule of two | 01 §19, §21; 09 §5.1–§5.2 | covered |
| 12 | Feel converges per archetype | — | superseded by 12′ |
| 12′ | Every weapon keeps its own behaviour; each difference is profile data; nothing converges | 01 §18 ("Every weapon keeps its own behaviour"); 09 §1.3, §1.4 (every tuning number, today's values), §1.8 (parity tests before any weapon moves); 12 §8 risk row; IDX §6 | covered |
| 13 | One versioned store; a reset now is fine; every later change gets a version + migration | 01 §9; F10 (02 §F10) | covered |
| 14 | Shard shape: data first, code where needed (typed manifest + fixed plugin verbs) | 01 §6, §7; each shard spec §3 (manifest in full), §4 (plugin) | covered |
| 15 | GAS-lite: attributes, effects, moves as data with tags, one damage pipeline with occlusion, cues per shard | 01 §18; 09 §2, §3 | covered |
| 16 | HFSM + utility + boss phases; StrikeSpec; fightRules → director; one weighted table for loot + spawns | 01 §19 (`CreatureBrain`, `BossBrain`, `StrikeSpec`, `WeightedTable`); 09 §5.1, §5.3–§5.6; S2.3 (06 §6.3) | covered |
| 17 | Typed TS rows with parents; contract tests check ids; valibot only for outside data | 01 §0 Behaviour vs tuning, §6 (`defineShard` checks ids), §9 (valibot for saves); 02 §F10 step 1 | covered |
| 18 | Engine-wide aggression director at today's numbers (Driftwood 2, others unlimited) | 01 §18 (director); 09 §5.5; 08 §3 (`fight.attackers`) | covered |
| 19 | Jian keeps 12 (a real profile field) | 09 §1.4; 05 §6.2 (S1.2) | covered |
| 20 | One pipeline with tagged sources; hit cap + dodge guard for creature and boss hits, not falls or lightning | 01 §18 (pipeline, tags); 09 §3.1–§3.3, B3; 05 §6.3 (S1.3); 07 §7 (§7.3) | covered |
| 21 | Retire the resident host; switching stays a page reload; each plugin keeps its own scope | F11 (02 §F11 step 2); 01 §4, §7 Unload. The `addEventListener` patch is kept under a ratchet until X1 / X2 (13, 02/03 #4) | covered |
| 22 | WebGPU contained, no switch | 01 §13.2; 10 X6 | covered |
| 23 | Genshin-style tick rates now (AI 30 Hz near, half far, paused beyond) | refined into 85 | superseded by 85 |
| 24 | Weapon model: profile → extend → custom; one Weapon contract + public blocks | 01 §18 ladder, `blocks`; 11 Z1 (`TemplateWhip`), Z3 | covered |
| 25 | Families are kit, built on the public engine API | 01 §18, §21; 09 §1.3, §1.5 | covered |
| 26 | Public API only; lint blocks deep imports | 01 §0 Public API, §24 `wildshard/layer`; F4 (02 §F4) | covered |
| 27 | A Tool contract on the same blocks; Weapon + Tool share an Equipment base | 01 §18; 09 §1.7; 05 §6.4 (S1.4, the Fei Zhua); 13 (09 #7: the hoverboard becomes a kit Tool in X1) | covered |
| 28 | "Can we get a GitHub Actions Mac machine with GPU?" → research | ci-gpu-options.md | superseded by 28′ |
| 28′ | Gate on free GitHub `macos-15` every push (one job per shard, Metal-or-fail, runner baselines); timing + GPU bytes nightly on Jake's Mac via launchd | F3.2 (02 §F3.2); 03 §0, §11, §14 | covered (G8, since resolved) |
| 29 | All shards' code downloads up front (SW); lazy only saves parse and memory | 01 §8 rules; IDX §2.2 | covered |
| 30 | Over budget fails the gate; numbers are derived, not magic | 01 §13.4; 05 §6.6 (S1.6); 10 X7; 03 §15 | covered |
| 31 | Only Jake's iPhone 17 Pro; keep 1.8 / 1.0 GB; nightly = Simulator; physical readings manual | 01 §13.4 (limits); 02 §F12, §F10 (manual iPhone readings); 03 §14.1 (the nightly Simulator memory run, `sim-lane.sh`, WebContent footprint against 1.8 / 1.0 GB); 12 §8 | covered (G2 resolved) |
| 32 | Deploys at shard milestones only; production on a frozen release | F3.1 (02 §F3.1); 03 §13; 12 §3; 05–08 §9 (every milestone moves `.github/deploy-pin.json` with `deploy-pin.mjs set`) | covered (G7 resolved: one pin file everywhere) |
| 33 | The lock: nothing else until the plan is archived | F0 (02 §F0); 12 §2 | covered |
| 34 | Lead + short subagents (E352 caps) | 12 §4 | covered |
| 35 | 30 fps on the hot phone now, 60-ready; desktop 60 | 01 §13.4; 10 X7; budget-design §2 | covered |
| 36 | Min desktop = RTX 3060 class at 60; laptops below get the phone tier | 01 §13.4 (stated); 10 X7 step 5 (tier selection: renderer-string table, else a 2 s GPU micro-benchmark, cached as a `device` key), step 6 (desktop budgets = M5 calibration × the documented M5 : 3060 ratio; the nightly's projected 3060 frame) | covered (G3 resolved) |
| 37 | Keep 1.0 GB in world | 01 §13.4 | covered (a rule; the evidence is the manual iPhone reading, 31) |
| 38 | Input: context stack + key rebinding; no gamepad now | 01 §10; 10 X1 steps 1–5 | covered |
| 39 | Touch: context relabels and reserved verb slots | 01 §11 (`relabel`, `verb`); 10 X1 steps 3–4 | covered |
| 40 | Buffer 120 ms + coyote 100 ms, per shard, on everywhere, on the board | 01 §10; 10 X1 step 6 + board | covered |
| 41 | Foundations, then shard by shard (each pulls in what it first needs), then input + UI sweeps, then the template | IDX §4; 12 §9; 10 intro (S1.4 builds the input service first) | covered |
| 42 | Milestones: summary + boards + play; Jake says go | 12 §6, §7; 03 §13.4; each shard spec §9 | covered |
| 43 | Template: every plugin verb, hidden in Debug, a contract test boots it every push | 11 Z1 | covered |
| 44 | Nine Dragon's own ambience + score + SFX in this plan | 05 §6.5 (S1.5) | covered |
| 45 | Rapier 0.21 in the foundations phase (walk + trails 0 stuck, one iPhone reading) | F12 (02 §F12) | covered (reaffirmed by 89) |
| 46 | Scripts: keep the live ones (named anywhere, or run in 14 days), delete the rest | — | superseded by 88 |
| 47 | Save safety (`persist()` + export / import) and session health join; auto-rollback + heat governor stay after | 02 §F10 steps 7–8; 10 X8 step 1; IDX §8 "After this plan"; 11 Z4 | covered |
| 48 | Kit folder `src/kit/` (`#kit/*`) | 01 §0 | covered |
| 49 | One plan; ENGINE-FIT archived as folded in; FINISH-LINE stays live with S1 / S3 / S5 / S6 / S7 marked moved | 02 §F0 step 3 (ENGINE-FIT archived; FINISH-LINE `blocked` with the moved rows named); IDX §8 | covered |
| 50 | `docs/ENGINE.md` + `docs/SHARDS.md` rewrite + a README per shard | 11 Z2 | covered |
| 51 | A fresh agent builds a small real 5th shard; every engine edit becomes a public-API fix first | 11 Z3 | covered |
| 52 | Each shard folder reopens at its milestone; engine + kit locked until the end | 02 §F0; 12 §2 | covered |
| 53 | Hotfixes land on main and ship with the next milestone | 12 §3; 02 §F0 step 1 | covered |
| 54 | Mechanisms are opt-in through the manifest (`uses`); the template lists all of them | 01 §6 `uses` and the closed `Mechanism` list (15 names); 11 Z1 | covered (G11 resolved in 01 §6) |
| 55 | Effects: only what the game uses today | — | superseded by 55′ |
| 55′ | Plus a starter set (poison, burn, bleed, slow, stun) as kit rows with cues + HUD icons, tuned on the creatures board | 01 §18, §21; 09 §2.2, §2.4; S2.5 (IDX, 06 §6.5) | covered |
| 56 | Multiplayer maybe: simulation state apart from visuals + input; gameplay randomness seeded | 01 §0 "Simulation apart from visuals", §2 (seeded streams), §24 `wildshard/sim-no-render`; 02 §F4 step 1 (the rule, count 0 from day one), §F5 step 5 (actor tests in node: the proof); IDX §2.8 | covered (G12 resolved) |
| 57 | Shards by Jake, agents and PRs; the public API is documented and linted, and may change with every in-repo shard | 01 §7 (`api` version rule), §24; 11 Z2 | covered |
| 58 | Extractable, not extracted: the engine never imports kit, shards or Wildshard words | 01 §0 Extractable engine, §24 word list; F4 | covered |
| 59 | Seamless travel someday: what does it mean now? | answered by 60 and 61; 01 §20 Travel (the type + a page-reload implementation); 10 X9 step 2 (`TravelRequest` / `TravelHandoff`, `travel()` replaces `requestShard`) | covered (G10 resolved) |
| 60 | Own every resource; unload frees all; a load → unload → baseline leak test | 01 §4; 02 §F8 step 6; 03 §2.4, §5.5 | covered |
| 61 | Own origin + a map position | 01 §6 `placement` | covered |
| 62 | A thin `src/game/` layer | 01 §20; 04 (the `#game` rows); 13 (04 #11) | covered |
| 63 | Fold PHYSICS-POLISH F3 in; its F7 goes with `src/dev`; F1 / F2 / F4 / F5 / F6 stay there | F11 (02 §F11 step 1); F7 (02 §F7 step 1); 02 §F0 step 3 | covered |
| 64 | Animation: the engine part here; ANIMATION-REMASTER keeps the art | 01 §16; 10 X4 | covered |
| 65 | Fold DEPLOYMENT_ASSET_TRIM T3 in (+ the unused-assets KTX2 fix) | 10 X3 steps 4–5 | covered |
| 66 | Re-plan NINE-DRAGON-STACK after the refactor | 02 §F0 step 3; 05 §9; 11 Z4 | covered |
| 67 | Subclasses for behaviour; tuning stays typed rows | 01 §0, §18, §19; 09 §0, §1.5 | covered |
| 68 | Fake Game + contract tests + a coverage gate on `src/engine/` | F5 (02 §F5) | covered |
| 69 | A plugin load failure shows a full-screen error with the stack, reported to Sentry | 01 §7 (load failure), §11 (`error` layer); F9 (02 §F9) | covered |
| 70 | Dot-case typed names, parent matching, shards extend the unions | 01 §0 Names, §3; 09 §2.5 | covered |
| 71 | Nine Dragon's sound: the neon night market brief | 05 §6.5 | covered |
| 72 | The template is grey-box | 11 Z1 Look | covered |
| 73 | The fresh agent proposes 3 portrait mockups; Jake picks; it ships behind Experimental | 11 Z3 steps 2–3 | covered |
| 74 | Coins per shard | 01 §9 Scopes, §20 | covered |
| 75 | Items self-contained, travel-ready: a `travels` flag (default off) | 01 §20; 10 X9 step 1 (every item row carries it, `false`) | covered (G10 resolved) |
| 76 | Progress per shard + a read-only Wildshard summary on the title deck | 01 §9, §20; feats per shard in 06 §1.3 (S2.1), 07 §1.4 (S3.1); 10 X9 step 3 (the `global` key `summary`, built from the per-shard saves; the title-deck strip on the Look board) | covered (G10 resolved) |
| 77 | Abilities per shard (`uses` + tools; rule of two) | 01 §6 `uses`, §18 Tool | covered |
| 78 | String tables, English only (engine + one per shard) | 01 §0 Strings; 10 X8 step 4; each shard's `strings.ts` (e.g. 05 §4) | covered |
| 79 | Analytics from the event bus (`death.cause`, `quest.step`, `weapon.used`, `shard.time`) | 01 §23; 10 X8 step 2; 08 §6.2 (B step 4) and §7 D2 (`boss.attempt` for the Captain, a fix) | covered |
| 80 | A capture mode on the engine clock | 01 §2; 02 §F8 step 1; 10 X8 step 3; 03 §6 | covered |
| — | "Go?" → keep grilling first | IDX State `draft`; 12 §1 (ready only after the council) | covered |
| — | Accessibility (unanswered at first) | answered by 84 | covered by 84 |
| — | Plan bar: clean-room review + audit + battery, no holes | 12 §1 (81–83) | covered |
| 81 | Stop rule: two clean rounds in a row | 12 §1 | covered |
| 82 | Council: 3 clean-room seats per round | 12 §1 | covered |
| 83 | Jake sees only what needs him + one status line per round; the review log lives in the repo | 12 §1 (`reviews/round-<n>.md`) | covered |
| 84 | No accessibility in this plan | IDX §2.7 | out (Jake's decision) |
| 85 | Three AI bands (20 Hz / 10 Hz / paused; interrupts; pins; 10 Hz until S2.6) | 01 §12; 06 §6.6 (S2.6); 09 §5.7; IDX §2.3, S2.6, §5 | covered (G5, since resolved) |
| 86 | Big crab: 14 damage | 09 §3.4 B6, §5.3; 08 §7 D1 (S4.2) | covered |
| 87 | Javelins: keep 3; the camp-upgrade promise is removed | 09 §1 (Q12); 07 §7 N1 (S3.3) | covered |
| 88 | Scripts (revises 46): one-offs of finished asks go, and anything not run in 5 days goes, unless referenced | 02 §F7 step 4 (liveness by decision 88; a `--dry-run` list the lead reads first); IDX F7 row; 13 (02/03 #3) | covered (G4, since resolved) |
| 89 | Rapier 0.21 anyway (+~413 KB gz accepted) | 02 §F12 risks; 13 (02/03 #8); IDX F12 | covered |
| 90 | Codex model GPT 6 Sol | — | superseded by 90′ |
| 90′ | Codex back on GPT 6.1 Sol (CLI ≥ 0.159.2) | 12 §1 seat A | covered |
| 91 | The Drowned Captain gets the shared BossBar (look board, S4.2) | 08 §6.2 (S4.2); IDX S4.2, §5 Look; 12 §6 Look row | covered (G21 resolved) |
| 92 | The council's convergence protocol (frozen ledger, one bar, a cross-round register, diff-scoped rounds, a growing battery, plan-lint, minimal fixes, falling counts or stop) | 12 §1; reviews/register.md; reviews/battery.md; scripts/plan-lint.mjs | covered |
| 93 | At most 4 rounds, then Jake decides what's open | 12 §1 item 8; reviews/register.md | covered |
| 94 | Creature strikes on the body clock, incl. Driftwood's self-thinking creatures at S4.2, on the M4 board | 01 §12; 09 §5.7; 08 §6.2 / §8; 13 R1-32 | covered |
| 95 | A rollback past F10 may reset saves a second time (stated on the rollback) | 03 §13; 12 §8; 13 R1-16 | covered |
| 96 | A "no" at a milestone pauses: the next phase waits, the reasons become rows in this milestone, the live build stays unless broken | 12 §3; 05–08 §9; 13 R2-29 | covered |
| 97 | The round cap stays 4: round 4 is the last review, then the open items go to Jake as decisions | 12 §1 item 8; reviews/register.md | covered |

## 3. The audit (`docs/audits/game-normalization-2026-09-30.md`) and the bugs found later

### 3.1 The duplicate groups (audit §4)

| ID | Group | Covered by | Status |
|---|---|---|---|
| D1 | FP weapon shell (~380: look-lag springs, `aimRay`, input handlers, `fovForAspect`, `sstep`) | 01 §18 `blocks.viewmodel` / `aimRay`; 09 §1.2–§1.3; S1.2 (05 §6.2), S2.2 (06 §6.2) | covered |
| D2 | Projectiles (+ `DropArc` ×2, brass ×2, Pine's `BoltMod`) | 01 §18 `blocks.projectile` / `brass` / `ammo`; 09 §1.4, §2.3 (`AmmoRow`); S2.2 | covered |
| D3 | Melee (Pine's `feel.ts` re-wires Sword's hit-stop) | S1.2; 09 §1.4 (Melee family), `blocks.hitStop` per profile | covered |
| D4 | ADS (3 `solveAds`, 2 bow zooms) | 01 §18 `blocks.ads`; S2.2 | covered |
| D5 | Weapon interfaces + kit choice (`instanceof Crossbow` ×6, kit by slug, weapon-id sets in UI) | 01 §18 contracts; 09 §1.2, §1.6 (`WeaponUi`); `manifest.loadout` (07 §7 §7.5, S3.3); 10 X1 step 3 | covered |
| D6 | Enemy strike timing (`LaneCharge` seed) | 01 §19 `StrikeSpec`; 09 §5.3 (S1–S40); S2.3 | covered |
| D7 | Boss wiring (3 near-identical `bind`s, 5 `retire()`) | 01 §19 `BossBrain`, `EncounterService`; 09 §5.4; S2.3 (King), S3.4 (Kurgan, Titan), S4.2 (Captain) | covered |
| D8 | Spawning (+ night thralls, rolled elites) | 01 §19 `WeightedTable`; 09 §5.6; S2.3 | covered |
| D9 | NPC idle (4 rigs) | 01 §21 `#kit/npc`; S2.5, S3.3, S4.3 (13, 05/06 #14) | covered |
| D10 | Quest runtime (Pine hand-rolls around `quest/core`) | S2.5 (06 §6.5) | covered |
| D11 | FX pools, telegraphs (7 pools, two `Puffs`) | 10 X5 (Particle pools, Telegraphs) | covered |
| D12 | Zoned ambience (Island / Steppe / Forest) | 01 §15 `AmbienceZones`; S1.5 (beds), S3.5 (07 §6.5), S4.3 | covered |
| D13 | Music source (steppe, Pine scenes, shard → bed ×7) | 01 §15 `MusicEngine`; S1.5, S3.5 | covered |
| D14 | SFX routing, positional voices, pan-from-yaw, smoothstep | 01 §15; S3.5 (07 §6.5 step 4); 10 X5 Helpers | covered |
| D15 | Grass streaming (~20 lines, moot) | none needed: `GrassPainterly` was deleted (E136), and Nalati's GPU ring is a different algorithm. The `Grass.ts` style branch leaves in S3.1 (13, 04 #4) | out (moot) |
| D16 | Model kit + AO (3 voxel AO bakers) | 10 X5 Geometry kit + AO | covered |
| D17 | Painted panorama (4 techniques) | 01 §13.1 `backdrop`, §17 Sky; 10 X5 Sky: each technique becomes its shard's backdrop strategy (content, rule of two) | covered |
| D18 | Sky (`Sky.ts` 3 setup paths; painterly sky + clouds built then hidden) | 10 X5 Sky; 07 §7 N3 (S3.2) | covered |
| D19 | Day cycle (3 clocks + 2 half-adapters) | S2.4 (06 §6.4); 01 §17 | covered |
| D20 | Terrain, placement, post, culling, fog (4 writers), wind, water (6 bodies) | 01 §17 (Terrain, Placement, Wind `WindField`, Culling, Fog), §13.1–§13.2; S4.1 `WaterBody`; 10 X5 Fog / Water | covered |
| D21 | HUD, skins ×3, raw `localStorage` in 28 files, `lin()` ×6 | 10 X5 Skin lockers, Helpers; F10 (saves); X2 (HUD) | covered |

### 3.2 The new duplicate families, and the dead code (audit §4)

| ID | Item | Covered by | Status |
|---|---|---|---|
| N-W | Weather stacks ×2 (~1,000) | S2.4 (06 §6.4); 01 §17 Weather; the rain curtain in `#kit/weather` (01 §21) | covered |
| N-L | Longbow = a fork of Bow (~450) | S2.2; 09 §1.4 (a Longbow profile row on the Bow family) | covered |
| N-R | LeverRifle ⊂ Rifle + Crossbow (~150) | S2.2; 13 (04 #3: a Firearm subclass in Pine's folder) | covered |
| N-E | Elite script base ×2 | S2.3 (one elite runtime); 07 §6.4 (S3.4) | covered |
| N-T | Slash trail ×2 | 10 X5 Slash trail | covered |
| N-U | LUT loader ×2 | 10 X5 LUT loader | covered |
| N-G | RNG ×3 | 02 §F8 step 1 (the one `Rng` class; Nine Dragon's `util.ts` `Rng` and `world/facade/rng.ts` deleted, the old sequences pinned by a test); 01 §2; 10 X5 RNG (a re-check only) | covered (G18 resolved) |
| X-1 | Dead: Nine Dragon lab copies (`src/dev/nd-lab/`) and all of `src/dev/` + `dev/*.html` | F7 (02 §F7 step 1) | covered |
| X-2 | Dead: Nine Dragon `look/post.ts` | F7 step 3 | covered |
| X-3 | Dead: `meleeGeo.ts`'s dead half | F7 step 3; 10 X5 | covered |
| X-4 | Dead, found later: `chunks/_template.ts`, 7 unreferenced images, `world/hero/paifang.ts`, `spruceMask.ts`, `interact/validate.ts` | 02 §F7 step 3, the one reviewed dead list (13, 04 #7 and still-open 05#7 / 07#8 / 08#8): `_template.ts`, the 7 images, `paifang.ts` and `spruceMask.ts` are deleted there (05 §1.1, 07 §1.4 point to it); `validate.ts` is reviewed there and kept, because `test/interact.test.ts` and `test/pine-quest.test.ts` import it (08 §1.2, §10 Q8) | covered (G20 resolved) |

### 3.3 The audit's measures (audit §3) and gaps in the old plan (audit §2)

| ID | Finding | Covered by | Status |
|---|---|---|---|
| M-1 | 269 shard branch sites in 70 files (+128 engine → shard imports) | F4 `no-shard-branch` + `wildshard/layer`; 0 at S4.4 | covered |
| M-2 | `main.ts` 1,336 lines, ~140 gated | S4.4 (08 §6.4: every line range → module + system id) | covered |
| M-3 | 48 hand-merged hook assignments, 29 hand chains, 8 `ws:*` events | 01 §3; F8 step 4 (`no-hook-chain` ratchet); 09 §4.3 and each shard spec §4 map every hook | covered |
| M-4 | 32 hand-ordered updates in the `'main'` updater | 01 §1; F8 step 2 (ids + rename map); S4.4 (split in order) | covered |
| M-5 | ~160 closure locals in `buildShard` | 01 §5 (typed services) | covered |
| M-6 | `ShardRender` used only by Nine Dragon; `Game.ts` / `Sky.ts` / `Terrain.ts` / `Grass.ts` / `Atmosphere.ts` branch | 01 §13.1; S1.1, S2.1, S3.2, S4.3 (each shard's `ShardRender`) | covered |
| M-7 | No safety net in CI; `scorecard.mjs` ~70 % of a harness | F2 (02 §F2, 03); F3.2 | covered |
| M-8 | Determinism: 254 `Math.random`, 242 `performance.now` | F4 `no-raw-random-time`; F8 step 1; 09 §3.5 | covered |
| M-9 | The freeze never happened | the lock (F0) replaces it | covered |
| G-a | Old plan: no shared-library layer | `#kit` (01 §21) + `#game` (01 §20) | covered |
| G-b | Old plan: no 5th-shard test | 11 Z1–Z3 | covered |
| G-c | Old plan: a second plugin concept (`ShardModule`) beside `ChunkDef`'s lazy hooks | 01 §6: the manifest grows from `ChunkDef` (all 48 fields mapped, 02 §F6) | covered |
| G-d | Old plan: branch count unenforced | F4 (a ratchet from day one) | covered |
| G-e | Old plan: moving the Captain onto `Boss` changed his feel | S4.2 (08 §6.2: frame-for-frame `captain` harness block) | covered |
| G-f | "Almost dynamic loading" needs Jake's call again | decisions 2 and 29; 10 X3 steps 7–10 (the layout and its check) | covered (G1 resolved) |

### 3.4 Bugs (audit §5, the combat audit, and the shard specs)

| ID | Bug | Covered by (row, test) | Status |
|---|---|---|---|
| §5.1 | Spear thrust never checks occlusion | S1.2; 09 §3.4 B1; IDX §7 item 1; 05 §7 | covered |
| §5.2 | Explore preloaded offline only when `def.ocean` | 01 §8 `boot.explore`; S4.1 reads it (08 §7); X3 step 2 + the offline-boot test on 4 shards | covered |
| §5.3 | `ChunkDef.weapon: 'nalati'` ignored; kit picked by slug | S3.3 (07 §7 §7.5); `level.loadout` (authored in `manifest.loadout`) | covered |
| §5.4 | `ws.elites.v1` is one global store | F10 (the `elites` key, shard scope); 06 §7, 07 §7 | covered |
| §5.5 | `Game.ts:290` decides Nine Dragon's phone AO | S1.1 (`tiers.phone.ao: false`, 01 §13.1); 05 §7 §7.7 | covered |
| 09 B1 | Spear thrust / brace / couched lance through walls | S1.2 (weapons board) | covered |
| 09 B2 | Naizagai's crescent and arcs through walls | S3.3 (weapons board) | covered |
| 09 B3 | Storm Titan skips the hit cap and the dodge guard | S3.4 (07 §7; creatures board) | covered |
| 09 B4 | `canReach` only on melee shards (Pine charges, both elite sets, 4 bosses, thralls) | S2.3 (06 §7), S3.4 (07 §7, Nalati half) | covered |
| 09 B5 | `damageFor` uses `Math.random()` | S1.3 (seeded `gameplay` stream) | covered |
| 09 B6 / 08 D1 | Big crab's `chargeDamage 14` is dead data | S4.2 (decision 86) | covered |
| 05 B1 | Nine Dragon plays Pine's theme and bed; its phone boot decodes Pine's slot | S1.5 | covered |
| 05 B2 | Nine Dragon's footsteps are pine litter | S1.5 (surface → cue map) | covered |
| 05 B3 | Nine Dragon downloads Driftwood's island slot and all Nalati SFX | S1.5 (`boot.audio`) | covered |
| 05 B4 | Death card says "the south gate" | S1.3 (`strings['respawn.default']`) | covered |
| 06 P1 | Pine's clock is outside `WorldClock` (no light presets in the Model Explorer, no day glyph) | S2.4 | covered |
| 06 P2 | Skin toss uses `Math.random()` | S2.2 (`loot` stream) | covered |
| 07 N1 | Javelin "camp upgrade → 5" never implemented | S3.3 (decision 87) | covered |
| 07 N2 | Engine `game/Elite.ts` imports Nalati's dungeon FX | S3.1 step 0 (`#engine/fx/groundFx.ts`) | covered |
| 07 N3 | Painterly clouds built then hidden | S3.2 | covered |
| 07 N4 | Nalati SFX live in the shared set | S3.5 (Nalati's own set folder) | covered |
| 07 N5 | Six `Math.random()` rolls in bosses / elites / night enemies | S3.4 (`ai` stream) | covered |
| 08 D2 | The Captain is outside the boss runtime (no `boss.attempt`) | S4.2 (08 §6.2 B step 4, §7 D2: a fix, 13 still-open 08#6; `captain-attempt.test.ts`) | covered (G20 resolved) |
| 08 D3 | Coin burst, keepsake angle, Ecology respawn use `Math.random()` | S4.2 (seeded streams) | covered |
| 08 D4 | Default shard is a literal in `gpuFiles.ts:42` | S4.1 (the registry's first manifest by `order`) | covered |
| 06 (quest) | Pine's porch fast-forward writes the sky phase every frame | S2.4 (06 §6.4) | covered |

## 4. Research rows: EI, TP, MW

### 4.1 engine-internals-audit (EI1–EI25)

| ID | Row (short) | Covered by | Status |
|---|---|---|---|
| EI1 | `engine/app` systems with order, run conditions, frame cost; split the `'main'` updater | 01 §1; F8 step 2; S4.4 | covered |
| EI2 | `AppState` with enter / exit replaces mode flags | 01 §1; F8 step 3; X1 / X2 remove the flags | covered |
| EI3 | Staged load; `SHARD_STEPS` goes | 01 §8; 10 X3 step 1 | covered |
| EI4 | Boot files from the manifest (fixes bug §5.2) | 01 §8; 10 X3 step 2 | covered |
| EI5 | De-shard `Game.ts` (Nalati fog + composer, ND AO + phone cuts, Driftwood chain, generic boot trace) | 01 §13.1, §8 (`boot.phone.trace`); S1.1, S3.2, S4.3 | covered |
| EI6 | Retire the resident host (+ `disposeListeners`, the `addEventListener` patch) | F11 step 2; the patch goes in X1 / X2 (13, 02/03 #4; IDX X1) | covered |
| EI7 | `buildShard` → `engine/boot.ts` ≤ 150; 0 branches in `main.ts` | S4.4 (08 §6.4); 13 (04 #12) | covered |
| EI8 | Generated `shards.generated.ts` | F9 (02 §F9); 01 §7 | covered |
| EI9 | `engine/input`: actions, bindings, context stack, dev overlay | S1.4 (05 §6.4); 10 X1 steps 1, 7 | covered |
| EI10 | Move every consumer onto actions; delete `inputAllowed()` ×7 and the fake `KeyE` | 10 X1 steps 1–2 | covered |
| EI11 | `TouchControls` draws the top context's discs; `touchHint` → `grapple` context (announce over herdr) | 10 X1 step 3; 01 §11 (the herdr notice is moot under the lock) | covered |
| EI12 | Engine-owned crouch action | 01 §10 (`ask('player.crouch', { want, via }) → { allowed, latched }`, R1-F9 / R2-08); 07 §6.3 C (Nalati's stealth answers it); 10 X1 step 1 (stealth.ts) | covered |
| EI13 | `engine/ui/layers` for the ~10 overlays | 01 §11; 10 X2 step 1 | covered |
| EI14 | `app.ui.slot` numbered bands; `ui.mount`; a lint rule | 10 X2 step 3 (`wildshard/no-raw-hud`) | covered |
| EI15 | Registered Bag tabs + item fragments | 01 §11, §20; 10 X2 step 4 | covered |
| EI16 | Shard data out of `src/ui` and Explore | 10 X2 step 5 | covered |
| EI17 | Service registry; the `active*()` singletons, then `getActiveChunk()` | 01 §5; F8 step 5 (`no-active-singleton`); 01 §24 `no-active-chunk` (0 at S4.4) | covered |
| EI18 | `window.__ws` probe from the services + plugin debug; `__world` alias | 01 §5, §7 (`ctx.debug.expose`); F2, F7 step 5, F8 step 7 | covered |
| EI19 | `SaveStore` (decision 13) | F10 | covered |
| EI20 | Typed event bus replaces `ws:*`, hand chains, hook assignments | 01 §3; F8 step 4; 09 §4 | covered |
| EI21 | Explore → `engine/explore`; art from the manifest, compare pairs from the manifest | 01 §22; 04 (`Compare.ts` → `level.explore.compare`, 05 §2.4) | covered |
| EI22 | Playgrounds registered by shards / kit | 01 §7 (`ctx.playground`), §22; S1.4 (grapple), 07 §1.4 (horse) | covered |
| EI23 | Practice arena + models → engine; `BOSS_NAMES` → a content registry; `TargetHit` → engine combat types | 01 §22; F6 (04: `practice/*` → engine); S2.3 (06 §6.3 step 7: boss display names from rows; step 8: `TargetHit` / `Targets` / `TargetAnimal` in `src/engine/combat/types.ts`); IDX S2.3 | covered (G17 resolved) |
| EI24 | Tier as data; delete `PINE_HOLLOW_PHONE`, `*Cuts()`, `Game.ts:290` | 01 §13.3; S1.1, S2.1; 10 X7 step 1 | covered |
| EI25 | Budgets in the manifest, read by the gate | 01 §6, §13.4; 10 X7; 03 §15 | covered |

### 4.2 tooling-pipeline-audit (TP1–TP18)

| ID | Row (short) | Covered by | Status |
|---|---|---|---|
| TP1 | Alias spike (`#engine/*` subpath imports) against tsc, Vite 8, vitest, oxlint, bake-loader | F1 (02 §F1) | covered |
| TP2 | `#` branch in `bake-loader.mjs` and in the lint plugin's resolution | F1 | covered |
| TP3 | `scripts/check-paths.mjs` in `pnpm test`; non-empty globs | F1 | covered |
| TP4 | Typed probe `window.__wildshard` + `.d.ts` | F2 (03 §2.0) | covered |
| TP5 | Parity harness v1 `scripts/parity.mjs` | F2; 03 §1–§10 | covered |
| TP6 | GPU gate + commit status; deploy the newest gpu-green SHA | F3.2 (03 §11). The deploy rule is replaced by the pin during the plan (decision 32) and returns afterwards (03 §16) | covered |
| TP7 | Move codemod from one mapping table | F6; 04 §7; 13 (04 #2: the reviewed JSON is the only input) | covered |
| TP8 | Node-safe manifests read by game and bakers; status replaces `PROTOTYPES` | F9; 01 §6, §7; S1.1 (Nine Dragon becomes a full shard) | covered |
| TP9 | The shard declares its assets | 01 §8; 10 X3; each shard's `boot` data | covered |
| TP10 | `check-models.mjs` folder rules → layers; generalised into `wildshard/layer` | F6 (04 §5, §7.3); F4 | covered |
| TP11 | Tests move with the code; no vacuous globs | F6 (34 tests, 13 04 #6); F1 (non-empty asserts) | covered |
| TP12 | Generated files to `src/engine/boot/` | F6; 04 §6 | covered |
| TP13 | Delete `src/dev/` + `dev/*.html` | F7 steps 1–2 | covered |
| TP14 | SW precache per shard: at install or on first play? | decision 29 answers it: at install, as today (01 §8); X3's offline-boot test | covered (by decision) |
| TP15 | Actor-test layer (fake `Game`) | F5 | covered |
| TP16 | Script cleanup + `scripts/README.md` | F7 steps 4–6 (decision 88) | covered |
| TP17 | `unused-assets` counts `gpu.generated.ts` | 10 X3 step 5 | covered |
| TP18 | Optional per-shard `public/assets/<slug>/` re-layout | IDX §8 "After this plan"; 11 Z4 leftovers | out (after the plan, as an ask) |

### 4.3 mobile-web-practice (MW1–MW22)

| ID | Row (short) | Covered by | Status |
|---|---|---|---|
| MW1 | Parity harness v1 | F2; 03 | covered |
| MW2 | Lint ratchets on day one | F4; 01 §24 | covered |
| MW3 | A GPU gate that decides green; re-run once; quarantine with owners | F3.2; 03 §11–§12; lane moved to GitHub by 28′ | covered |
| MW4 | Actor-test layer | F5 | covered |
| MW5 | The shard contract carries budgets, a precompile list, tier knobs | 01 §6 (`budgets`, `tiers`), §13.3–§13.4; 10 X6 step 3 (`boot.shaders`), X7 | covered |
| MW6 | Update-LOD scheduler (near / mid / far, paused) | 01 §12; S2.6 (06 §6.6) | covered |
| MW7 | One `SaveStore`: namespaces, versions, migrations, unknown fields kept, a fixture corpus | 01 §9; F10 steps 2 + tests | covered |
| MW8 | Thermal governor | IDX §8 "After this plan"; decision 47 | out (after, Jake's decision) |
| MW9 | Tethered-iPhone nightly + buy a min-spec iPhone | decision 31 (only Jake's iPhone; nightly = Simulator; physical readings manual); the Simulator nightly it implies is 03 §14.1 | out (by 31); the Simulator lane covered (G2 resolved) |
| MW10 | Session health per build | 10 X8 step 1; 01 §23 | covered |
| MW11 | Budgets from a min-spec device | decisions 31 and 37 keep 1.8 / 1.0 GB; budget-design §6.5 derives 1.8 from the 17 Pro's limit | out (by 31 / 37) |
| MW12 | KTX2 on phone for every shard (close E248's Nine Dragon fallback) | 05 §2.3 keeps the fallback as `tiers.phone.textures: 'img'`; IDX §8 "After this plan" lists MW12 as an ask (it needs physical-iPhone evidence) | out (after, an ask; G13 resolved) |
| MW13 | Per-shard bundle manifest; a build check that `main-*.js` holds no shard code | 01 §8; 10 X3 (declared assets), steps 7–8 (`codeSplitting.groups`, `check-chunks.mjs` over Vite's manifest) | covered (G1 resolved) |
| MW14 | Measure the Rapier wasm high-water across shard switches | IDX §8 "Out, with the reason": moot by decision 21 (a switch is a page reload, so the heap never outlives its shard) | out (G13 resolved) |
| MW15 | `storage.persist()`, `estimate()` readout, save export / import | F10 steps 7–8 | covered |
| MW16 | Flag hygiene: ask id + review-by date per Debug row, an overdue list | 10 X8 step 5 (required `ask` + `reviewBy`, the overdue list in the test output and the session brief, the `debugRows` count ratchet) | covered (G13 resolved) |
| MW17 | Asset audit per shard plugin | 10 X3 step 3 | covered |
| MW18 | Renderer portability rule (shader code only through the engine) | 01 §13.2; 10 X6 | covered |
| MW19 | Soak bot (navmesh wanderer, 20–30 min nightly) | 03 §14.2 (20 min per shard on the Mac: stuck states, errors, heap and GPU-byte growth, fps trend; the `soak-leak` plant must turn it red); 02 §F3.2 step 5 | covered (G13 resolved) |
| MW20 | Engine API version + template shard | 01 §6 `api`, §7; F9; 11 Z1 | covered |
| MW21 | Health-based auto-rollback | IDX §8; 11 Z4 | out (after, decision 47) |
| MW22 | Record / replay over the seeded RNG and fixed step | the door is open (01 §2 seeded streams, capture mode); IDX §8 "After this plan" lists it as an ask | out (after, an ask; G13 resolved) |

## 5. The rest of the research

### 5.1 engine-fit.md

The file has no numbered top 10. EF1–EF10 are its verdict (5 points) and the §2–§5 recommendations the verdict depends on.

| ID | Recommendation | Covered by | Status |
|---|---|---|---|
| EF1 | No engine switch; three.js + Rapier stay | IDX §8; the whole plan builds on them | covered |
| EF2 | Borrow Bevy's App / Plugin / Schedule / State / Resource / Event shape; own it | 01 §1–§5, §7; F8 | covered |
| EF3 | Entities stay classes; structure-of-arrays pools only for projectiles, particles and the far crowd | 01 §0, §18–§19 (classes); 10 X5 (one `ParticlePool`); IDX §8 "After this plan" (pooled projectiles and a far crowd, an ask) | covered for particles; the other pools out (after; G14 resolved) |
| EF4 | Adopt valibot, at trust boundaries only | F10 step 1; 01 §9 | covered |
| EF5 | Keep the Rapier 0.20.0 pin until a phone measurement pays for 0.21 | Jake overrode it: decisions 45 and 89 → F12 | conflict, resolved by Jake (0.21, +413 KB accepted) |
| EF6 | Keep navcat and adopt its crowd module for herds and thralls | navcat stays (today's baked navmesh and its query, `src/physics/navmesh.ts`); the crowd module is in IDX §8 "After this plan" as an ask | out (after; G14 resolved) |
| EF7 | Own a typed FSM (skip xstate); borrow yuka's steering pattern; no behaviour-tree library | 01 §19 (`Hfsm`, owned); steering behaviours in IDX §8 "After this plan" | covered; steering out (after; G14 resolved) |
| EF8 | WebGPU containment: the renderer type in `engine/render`, one shader-patch registry, post behind `ShardRender`, one `precompile()`, no TSL | 01 §13.1–§13.2; 10 X6 | covered |
| EF9 | No OffscreenCanvas; a kit worker pool for procedural generation (Pine's 150 ms long task); physics stays on the main thread | 01 §14 (main thread); the worker pool in IDX §8 "After this plan" as an ask | covered; the worker pool out (after; G14 resolved) |
| EF10 | Build: one lazy chunk per shard started at entry through `retried()`; few big chunks (`codeSplitting.groups`); subpath imports; `wildshard/layer` + slug counter; folders, not packages; re-test E188's retry on iOS 27 | F1 (aliases); F4 (lint); 01 §0 (folders); 01 §7 (lazy load); IDX §2.2; 10 X3 steps 7–10 (chunk groups, the main-chunk check, the shard chunk through `retried()`, the iOS 27 re-test) | covered (G1 resolved) |

### 5.2 aaa-architecture.md: the patterns (AA) and the "don't copy" list (DC)

The file has no numbered top 12. AA1–AA12 are the patterns its one-paragraph answer and §2 recommend.

| ID | Pattern | Covered by | Status |
|---|---|---|---|
| AA1 | The core never knows the content (Game Features rule) | 01 §0 Extractable engine; §24 `wildshard/layer`; S4.4 (0 branches) | covered |
| AA2 | A shard is a data asset listing what it turns on (Lyra Experience) | 01 §6 (`uses`, `loadout`, `species`, …) | covered |
| AA3 | Experience lifecycle: load order with early / normal / late ready hooks | 01 §8 stages (`shard.data` → `shard.world` → `shard.kit` → `shard.play` → `finish`) | covered (adapted: stages instead of priorities) |
| AA4 | Action Sets = the kit; Game Feature Actions = a fixed list of plugin verbs | 01 §7 `ShardContext`; 01 §21 | covered |
| AA5 | Subsystems with lifetimes; everything registered is scope-owned | 01 §4, §5; F8 steps 5–6 | covered |
| AA6 | States with enter / exit, schedules, system sets, run conditions | 01 §1; F8 steps 2–3 | covered |
| AA7 | Queued messages + synchronous observers; tags with parent matching; event-queue cautions | 01 §3 (`emit` queued per phase, bounded at 1,000 per frame; `ask` synchronous; `hasTag`) | covered |
| AA8 | Type objects with parents; param tables as typed TS rows | 01 §0; 09 §1.4 (profiles with parents), §2.2, §5.2 | covered (ids are dot-case by decision 70, not `kind:name`) |
| AA9 | GAS-lite: attributes, effects (3 durations, add / multiply, stacking), moves as data (windup / active / recovery / cancel), attack rows, one pipeline, cues | 01 §18; 09 §2–§3 | covered |
| AA10 | AI: species rows, HFSM + utility pick + interrupts, group brains, boss = row + HP phases + goal stack, encounters, spawn director on weighted tables, aggression tokens; a brain debug overlay | 01 §12 (interrupts), §19; 09 §5; S2.3 (06 §6.3 step 9: the AI debug overlay under Debug ▸ Developer tools; IDX S2.3) | covered (G16 resolved) |
| AA11 | Input contexts (Enhanced Input), four UI layers (CommonUI), HUD slots, inventory fragments | 01 §10–§11; 10 X1, X2 | covered |
| AA12 | Versioned saves with migrations recorded in the save; contract tests (ids, `uses`, save keys, cue maps); layer lint | 01 §9 (a save failing its schema: set aside, defaulted, reported, never a crash); 02 §F10 step 2 + tests; F5; 01 §6 `defineShard`; 08 §6.3 (CueMap covers every cue) | covered (G16 resolved) |
| DC1 | Don't copy full GAS (prediction, replication, magnitude kinds, AbilityTask trees) | 01 §18 keeps add / mul / override modifiers, 3 kinds, tags, cues. Nothing else | honoured |
| DC2 | Don't copy runtime plugin install / uninstall states | 01 §7: one generated static registry + lazy import; a switch is a page reload (21). `unload` exists only as scope disposal for the leak test | honoured |
| DC3 | Don't copy reflection-based component injection | 01 §7: a fixed verb list | honoured |
| DC4 | No ECS / DOTS rewrite | 01 §0, §19: classes; pools only for particles (X5) | honoured |
| DC5 | No planners (HTN, GOAP) | 01 §19: HFSM + utility | honoured |
| DC6 | No visual editors | Rows are TS; Jake picks through Debug rows and boards (12 §6) | honoured |
| DC7 | No JSON data parsed at runtime | Decision 17: typed TS rows; valibot only for saves (01 §9) | honoured |
| DC8 | No World Partition, HLOD pipelines or remote catalogs | One shard per page, SW precache (01 §8); seamless travel only prepared (60, 61) | honoured |
| DC9 | No Enhanced Input trigger zoo; no CommonUI gamepad focus | 01 §10: actions + contexts + one buffer; no gamepad (38) | honoured |
| DC10 | No tag query language | 01 §3 `hasTag(tags, pattern \| 'x.*')` | honoured |

### 5.3 budget-design.md

| ID | Item | Covered by | Status |
|---|---|---|---|
| BD1 | Target: 30 fps on the hot phone; 60 as a goal column; desktop 60 | 01 §13.4; decision 35 | covered |
| BD2 | Derivation: unit costs → frame budget → CPU / GPU lanes → M5 ruler | 01 §13.4; 05 §6.6 step 4 (`budgets.ts`); 10 X7 step 2 | covered |
| BD3 | Calibration scene: 8 sweeps, one tap from Debug, posts to the inbox; M5 headless twin; Low Power Mode flagged | 05 §6.6 (S1.6) steps 1–3, 7 | covered |
| BD4 | What gates where: counts per push; GPU ms on the M5; memory nightly on the Simulator | 03 §15; 03 §14.1 (the Simulator memory run) | covered (G2 resolved) |
| BD5 | Provisional numbers; delete the three unrelated phone draw budgets; bytes derived from Jake's time caps | 10 X7 step 2; 01 §13.4 (download MB); 13 (05/06 #7: Nine Dragon's load cap) | covered |
| BD6 | GPU MB stays a ratchet until a jetsam reading names the limit | 01 §13.4 rollout; 03 §15 | covered |
| BD7 | Rollout: a shard over a P number keeps its current worst as a ceiling; one calibration by Jake; a shard still over gets cut rows | 01 §13.4; 05 §6.6 step 5; 10 X7 step 3 | covered (the cut-rows rule is AGENTS.md's perf-cut rule) |
| BD8 | Measure CPU / GPU overlap first (sweep 6) | 05 §6.6 step 1 (the overlap sweep) | covered |

### 5.4 ci-gpu-options.md

| ID | Item | Covered by | Status |
|---|---|---|---|
| CG1 | Blocking gate on `macos-15`, full Chromium (`channel: 'chromium'`), renderer assert, phone tier, counts, one job per shard, one pending run | F3.2; 03 §11.1–§11.4 | covered |
| CG2 | Pin the image label; re-baseline on an image bump | 03 §8; 12 §8 risk row | covered |
| CG3 | Deploy the newest gpu-green SHA | replaced by the pin during the plan (32); back after it (03 §16) | covered |
| CG4 | Linux lane: node gates + a case-sensitive asset-URL check; SwiftShader only as a fallback | node gates exist in `deploy.yml`; 03 §11.6 (the `asset-case` job on `ubuntu-latest`, part of `gpu-gate`, with the `asset-case` plant); 02 §F3.2 step 2 | covered (G15 resolved) |
| CG5 | Nightly on Jake's M5 through launchd, never a runner; a `gpu-perf` status | 03 §14 | covered |
| CG6 | Memory and stability truth stays the iPhone | 03 §15; 12 §8 | covered |
| CG7 | First step: a free `workflow_dispatch` probe on `macos-15` | 02 §F3.2 step 1 (`gpu-probe.yml`) | covered |

### 5.5 combat-ai-audit.md

| ID | Finding or board item | Covered by | Status |
|---|---|---|---|
| CA1 | Melee is already archetype + profile; the Spear is the outlier | S1.2; 09 §1.4 (W6 `SPEAR`: `class Spear extends Melee`, composing the javelin), §6 step 4 | covered |
| CA2 | Two weapon contracts + an adapter that guesses; kit by slug; weapon-id sets in UI | 01 §18; 09 §1.2, §1.6; X1 step 3 | covered |
| CA3 | Feel differs by shard, not weapon (hit-stop via Sword + Pine's `feel.ts` patch) | 09 §1.4 (hit-stop as per-weapon profile data, identical today); 12′ | covered |
| CA4 | Occlusion patchy both ways | 09 §3.4 B1, B2, B4 | covered |
| CA5 | Five hand-written hurt blocks; health a `let` in `main.ts` | 01 §18 (player health in the engine); S1.3 (05 §6.3); 09 §3.3 | covered |
| CA6 | Three damage models | 09 §3.1–§3.2 (one `DamageRequest`, each path keeps its numbers) | covered |
| CA7 | 24 hand-rolled strike blocks; `LaneCharge` + `AttackTokens` are the seeds | 01 §19; 09 §5.3, §5.5 | covered |
| CB-M | Board list M1–M8 (melee: hit-stop, speed, combo, occlusion, shell, lunge, damage, FOV) | 12′: every "converge" becomes "keep" as profile data (09 §1.4); M4's occlusion is B1; M7 jian 12 is decision 19; M8 FOV → `camera.portraitFov` (01 §6) | covered |
| CB-B | Board list B1–B7 (bows: zoom, flight, sway, hit-stop, damage, look, wind) | 12′ (09 §1.4 Bow / Longbow rows); B7 → `WindField` (01 §17; 13, 07/08 #3) | covered |
| CB-F | Board list F1–F5 (firearms) | 12′ (09 §1.4 W12 AR15 + the LeverRifle subclass) | covered |
| CB-X | X1: one shell for every weapon | `blocks.viewmodel` (01 §18), per-weapon feel numbers kept (09 §1.4) | covered |

## 6. The plans folded in

| ID | Row | Covered by | Status |
|---|---|---|---|
| ENGINE-FIT E1 | `WorldRegistry` + `ColliderDesc` | built by PHYSICS (P2); F11 finishes it (no `player.colliders`) | covered (built; finished in F11) |
| ENGINE-FIT E2 | Frame phases on `Game` | built by PHYSICS; F8 adds ids, ordering, states | covered |
| ENGINE-FIT E3 | Shared `CharacterMotor` | built by PHYSICS; kept (01 §14) | covered (built) |
| ENGINE-FIT E4 | Input actions + contexts | S1.4 + X1 (01 §10); gamepad left out by 38 | covered |
| ENGINE-FIT E5 | Shard module interface | the whole plan: 01 §6–§7, F9, S1.1 / S2.1 / S3.1 / S4.1, S4.4 | covered |
| ENGINE-FIT L-a | three-mesh-bvh | engine-fit §3: "borrow later, tools only"; gameplay collision stays Rapier; IDX §8 "After this plan" (for Explore, an ask at Z4) | out (after; G14 resolved) |
| ENGINE-FIT L-b | Needle Inspector | engine-fit §3: "borrow later, dev only"; IDX §8 "After this plan" | out (after; G14 resolved) |
| ENGINE-FIT L-c | ECS for crowds | engine-fit §3: skip whole-game ECS; SoA pools; koota only if a crowd library is ever needed; IDX §8 "After this plan" (the SoA pools) | out (after; G14 resolved) |
| ENGINE-FIT L-d | three.quarks | engine-fit §3: skip now; X5 builds one `ParticlePool` first | out |
| ENGINE-FIT L-e | @three.ez/instanced-mesh | engine-fit §3: skip (E271 evidence rule) | out |
| ENGINE-FIT L-f | gltf-progressive | engine-fit §3: skip | out |
| ENGINE-FIT (plan) | archived as folded in | 02 §F0 step 3 | covered |
| FINISH-LINE S1 | A golden-path play test gates every deploy (desktop + touch; walk, swing, shot, pause + resume, p95, screenshot) | F2, F3.2, Z4 (03 §16); pause → resume → state identical in the scripted run (03 §5.6, both tiers); the desktop tier in the nightly and the lead's pre-milestone run (13, 02/03 #7); p95 information only (28′); IDX §8 | covered (G19 resolved) |
| FINISH-LINE S3 | Shard modules (ENGINE-FIT E5) | this plan | covered |
| FINISH-LINE S5 | Input actions: contexts, buffer, coyote, rebinding, gamepad | X1; gamepad after the plan (38; 11 Z4) | covered (gamepad out) |
| FINISH-LINE S6 | Tests where the bugs are (boss, elite, quest, weather, AI, weapon timing) | F5; 09 §1.8, §3.6, §5.8; 06 §6.4 tests | covered |
| FINISH-LINE S7 | Budgets that run (nightly `bench:ci`, committed `latest.md`) | S1.6, X7; 03 §14 (the nightly report); IDX §8 and 03 §14: the committed `latest.md` is replaced by the gate's budget report artifact | covered (G19 resolved) |
| FINISH-LINE (plan) | stays live, S1 / S3 / S5 / S6 / S7 marked moved | 02 §F0 step 3 (`blocked`, a live state) | covered |
| PHYSICS-POLISH F3 | Retire `player.colliders` | F11 step 1 (every user mapped) | covered |
| PHYSICS-POLISH F7 | Dev scenes on the registry | goes with `src/dev` (F7) | covered (by deletion) |
| PHYSICS-POLISH F1, F2, F4, F5, F6 | stay in PHYSICS-POLISH | 02 §F0 step 3 (`blocked` until the lock ends) | out (stays there, decision 63) |
| ANIMATION-REMASTER, engine half | One rig loader, clip naming, an animation state machine, the rig contract | 01 §16; 10 X4 | covered |
| ANIMATION-REMASTER A3–A7 (+ A8, A9) | The art | 02 §F0 step 3; X4 step 5; 11 Z4 leftovers | out (stays there, decision 64) |
| DEPLOYMENT_ASSET_TRIM T3 | Map original textures against KTX2 variants | 10 X3 step 4 (a report; nothing deleted without Jake's pick) | covered |
| DEPLOYMENT_ASSET_TRIM T2, T4, T5 | stay there | 02 §F0 step 3 | out (stays there, decision 65) |
| NINE-DRAGON-STACK | paused until M1, then re-planned | 02 §F0 step 3; 05 §9; 11 Z4 | covered |

## 7. Gaps (findings for the lead)

Each gap names what was missing, and the row that now covers it. **All 21 are resolved:** 13-lead-resolutions answers
each one ("From 00-traceability §7 (gaps)"), and the gap closure applied those answers to the index, 02, 03, 05–08, 10
and 12. The rows above point at the same homes. Nothing in this section is open.

**Missing work (no row or step carried it)**
- **G1: the chunk layout (decision 2, MW13, EF10, audit G-f).** Only IDX §2.2 named "three.js, engine + game + kit,
  then one per shard (Vite 8 `codeSplitting.groups`)". **Resolved → 10 X3 steps 7–10:** the `codeSplitting.groups`
  config with each manifest's closure in the engine chunk; `scripts/check-chunks.mjs` (Vite's manifest +
  `chunk-modules.json`) in the pre-push gate and CI, failing on any shard plugin module in the main chunk set; the
  shard chunk through `retried()`; the E188 re-test on iOS 27 in the Simulator (`ios-retry-check.mjs`, sim-lane).
  Rows: decision 2, C2, G-f, MW13, EF10.
- **G2: the nightly Simulator memory lane (decision 31, budget-design §5).** **Resolved → 03 §14.1:** each night
  `scripts/sim-memory.mjs` boots every shard in iOS Safari through `sim-lane.sh` and records the WebContent footprint
  (loading, play, Explorer) against 1.8 / 1.0 GB, red over a limit or on a > 10 % night-over-night rise; a
  regression check, never phone evidence. Rows: decision 31, MW9, BD4.
- **G3: decision 36.** **Resolved → 10 X7 steps 5–6:** `tierSelect.ts` (harness `tier` → mobile UA → the cached
  `device` key `render.tierPick` → the renderer-string table at RTX 3060's 12.7 TFLOPS → a 2 s GPU micro-benchmark
  against `desktopFloor`); desktop budgets from the M5 calibration × a documented `k3060` in budget-design, and the
  nightly's projected 3060 frame per desktop pose. Row: decision 36.
- **G10: decisions 75, 76, 59.** **Resolved → a new row X9 (IDX §4 X; 10 X9):** the `travels` flag on every item row
  (default `false`), the travel type (`TravelRequest` / `TravelHandoff`) with the page reload as its one
  implementation (replacing `requestShard`), and the read-only Wildshard summary on the title deck (a `global` key
  built from the per-shard saves; its look on the Look board), with tests. Rows: decisions 59, 75, 76.
- **G13: MW rows with no disposition.** **Resolved:** MW12 → an after ask (IDX §8); MW14 → out, moot because a switch
  is a page reload (IDX §8 "Out, with the reason"); MW16 → 10 X8 step 5 (ask id + review-by date per Debug row, the
  overdue list, a count ratchet); MW19 → 03 §14.2 (the soak bot, 20 min per shard, a planted leak caught); MW22 → an
  after ask (IDX §8).
- **G14: engine-fit rows with no disposition.** **Resolved → IDX §8 "After this plan":** the navcat crowd module,
  pooled projectiles and a far crowd, a kit worker pool, steering, and the "borrow later" libraries (three-mesh-bvh
  for Explore, the Needle Inspector), each an ask at Z4. Rows: EF3, EF6, EF7, EF9, L-a, L-b, L-c.
- **G15: ci-gpu-options §6.2.** **Resolved → 03 §11.6:** the Linux `asset-case` job in `gpu-gate.yml`
  (`scripts/check-asset-case.mjs` on `ubuntu-latest`, part of the aggregate status, proved by the `asset-case` plant);
  02 §F3.2 step 2. Row: CG4.
- **G16: two aaa items.** **Resolved:** the AI debug overlay → S2.3 (06 §6.3 step 9; IDX S2.3); a save failing its
  schema → 01 §9 and 02 §F10 step 2 (set aside to `<key>.corrupt.<time>`, reset to `initial()`, reported, never a
  crash; listed in Settings). Rows: AA10, AA12.
- **G17: EI23.** **Resolved → S2.3 (06 §6.3 steps 7–8; IDX S2.3):** boss display names come from the boss rows (a
  content registry; `BOSS_NAMES` deleted), and `TargetHit` / `Targets` / `TargetAnimal` move to
  `src/engine/combat/types.ts`. Row: EI23.
- **G18: the RNG merge.** **Resolved → 02 §F8 step 1:** F8 lands the one `Rng` class and deletes Nine Dragon's
  `util.ts` `Rng` and `world/facade/rng.ts` (`Rng.scrambled` keeps the facade's sequence, pinned by a test); 10 X5's
  RNG item is only a re-check; 05 §1.1 follows. Row: N-G. (01 §2's last line still says "(X5)"; F8 is the row.)
- **G19: FINISH-LINE S1 and S7.** **Resolved:** the pause → resume → state identical step joins the scripted run
  (03 §5.6, both tiers); the desktop tier runs nightly (13, 02/03 #7); S7's committed `latest.md` is replaced by the
  gate's budget report artifact and the nightly report, said in IDX §8 and 03 §14. Rows: FINISH-LINE S1, S7.

**Conflicts (specs disagreed with a decision or with each other)**
- **G6: 01 contradicted itself** on the horse and the weather FX. **Resolved in 01 §17, §19** (the horse stays in
  Nalati; the kit gets only the rain curtain).
- **G7: the deploy pin's file.** **Resolved:** `.github/deploy-pin.json` everywhere. 12 §3 and 05–08 §9 now move it
  with `deploy-pin.mjs set`, and 12 §3 says F3.1. Row: decision 32.
- **G21 (nit).** **Resolved:** 12 §6's Look row names the Captain's shared BossBar (decision 91); 10 X5's pan-from-yaw
  count is 8 (01 §15). Row: decision 91.

**Resolved while this file was written** (by the consistency pass, committed in `0ca31c48`; re-checked after the gap
closure)
- **G4: decision 88.** 02 §F7 step 4 applies 88: a 5-day window, finished asks' one-offs go, a `--dry-run` list first.
- **G5: decision 85.** 06 §6.6 (S2.6) has 20 / 10 / paused, brain / body clocks, interrupts and pins; 08 §6.2 A step 5
  now names the same bands.
- **G8: the nightly's token.** 03 §14 uses the Mac's `gh` login, like 13 (02/03 #8).
- **G9: the listener-patch ratchet's name.** 02 §F11 says `wildshard/no-global-listener-patch`, like 01 §24.

**Ambiguities**
- **G11: decision 54's `Mechanism` union.** **Resolved in 01 §6:** a closed list of 15 names (engine and game); a
  shard's own verbs (riding, stealth, the grapple) are not on it. Row: decision 54.
- **G12: decision 56.** **Resolved:** 01 §0 and §24 state the rule, `wildshard/sim-no-render` enforces it from F4 (02
  §F4 step 1: count 0, every simulation module born under it), and the node-only actor tests are the proof (02 §F5
  step 5). Row: decision 56.
- **G20: spec questions 13 didn't answer.** **Resolved → 13-lead-resolutions "Still-open spec questions":** 07 Q7 (the
  camp rig, 05/06 #14), Q9 (`ask('player.crouch', { want, via }) → { allowed, latched }`, R1-F9 / R2-08, 07 §6.3 C), Q10
  (`ctx.rows.creatureLook`); 08 Q2 (`{ chain: c.engineChain('clean') }`, C6), Q6 (`boss.attempt`, a fix: 08 §6.2 B
  step 4), Q8 (`validate.ts` reviewed on F7's one list and kept: two tests import it); 05 / 06 / 07 / 08 Q1 (every
  sub-field a declared manifest field). Every spec's "Questions for the lead" now reads resolved. Rows: X-4, 08 D2.

**Left for the lead outside this file's reach** (the gap closure edited only the index, 00, 02, 03, 05–08, 10 and 12):
01 §2 still says the RNGs merge "(X5)" (F8 does it); 01 §6's declared sub-field list does not yet name Pine's
`atmosphere.edgeHaze` / `wetSurfaces`, `loadout.grants[].by`, `loadout.ammo`, `bag.pack.keeps`, `boot.bytes` /
`lateReads` / `bakedUnread` (06 §10 Q1 declares them by 13's rule); 01 §24's `sim-no-render` globs need 02 §F4's
`src/engine/combat/view/**` carve-out for the drawing blocks; 01 §13.3 gains the engine tier knob `msaa` (07 §6.2
step 2); `move-map.json` needs F6's `src/entry.ts` amendment (02 §F6 step 1); 09 §10 Q1 / Q2 / Q11 still say "open" for
items 13 C4 / C5 answered.

**Counts.** Table 1: 13 rows (13 covered). Table 2: 98 rows (91 decisions, 4 revisions, 3 unnumbered). Table 3: 21 +
11 + 15 + 26 = 73 rows. Table 4: 25 + 18 + 22 = 65 rows. Table 5: 10 + 22 + 8 + 7 + 11 = 58 rows. Table 6: 26 rows.
Gaps: 21 (G1–G21), all resolved (G4, G5, G8, G9 while this was written; the other 17 by 13 and the gap closure). No row
is `partial`, `gap` or an unresolved `conflict`.
