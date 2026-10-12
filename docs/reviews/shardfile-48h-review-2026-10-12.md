# Shardfile build review: the last 48 hours (2026-10-12)

Reviewer: ds-review (Opus, read-only). Window: **2026-10-10 22:00 → 2026-10-12 23:00 UTC**, 1,055 commits on
`main` (HEAD `ae7bda975` plus the lanes' newer commits). The design was approved as **G319 at 2026-10-10 19:39 UTC**
(`7939773be`, design `docs/plans/shard-platform/design-system.md`, rows SF79–SF86). The baseline is
`docs/reviews/shardfile-architecture-audit-2026-10-10.md`.

## Verdict

**Partly on track, and drifting where it counts.** The lanes built most of the *platform* half of the design: one-user
platform code is ~89 % gone, `@wildshard/format` and scene synth exist, game exports went from 328 to 103, and the
one-shot test passed its hard gates once. The *shard* half has not moved. Four of the six real shards still ship **0
tiles**. `bake(scene)`, the design's central call, **does not exist**. Driftwood, Pine and Nalati are still at
**98–102 % custom ÷ legacy**. Generators importing the engine/game rose **+42 %** (305 → 433), and since 22:13Z tonight
the coordinator approves those rises automatically. Only the G345 sprint (from 21:30Z) is pointed straight at 80/20.

---

## 1. Hour by hour (UTC)

Commits are split Codex / Claude / automation: Codex counts trailer-less commits from before E476 (10-11 20:30), and
automation is the `SF6b` and `chore(gen)` regeneration commits. "Push" is auto-push ok / red per hour
(`.git/auto-push.log`).
🟥 = push queue red all hour · ⏸ = Opus paused (G329) · ⛔ = machine outage

| Hour | Commits (X/C/auto) | Push | What |
|---|---|---|---|
| 10-10 22 🟥 | 31 (14/12/5) | 0/7 | SF63 pre-draw, SF76 move-back, DS1.3 scene reader; 3 Opus live |
| 23 🟥 | 15 (5/7/3) | 0/8 | SF63, G321 own skies, DS0.1 |
| 10-11 00 ⏸ | 14 (1/11/2) | 2/1 | **G329 00:55: 0 Opus lanes**; SF63 tails |
| 01 ⏸🟥 | 28 (22/6/0) | 0/10 | SF79 DS0.1 move-backs; DS1.1 format |
| 02 ⏸ | 22 (16/3/3) | 0/3 | DS1.1 format, DS1.5 physics bakes to Node |
| 03 ⏸🟥 | 27 (22/2/3) | 0/12 | SF79, DS1.5, DS1.1 |
| 04 ⏸🟥 | 33 (27/3/3) | 0/13 | SF79, DS1.5, DS1.6 packs, SF81 DIR-1/2 |
| 05 ⏸🟥 | 25 (24/0/1) | 0/12 | DS1.5, DS1.6, SF81 DIR-3 |
| 06 ⏸🟥 | 26 (22/0/4) | 0/10 | SF81 DIR-4, SF83 movers |
| 07 ⏸ | 30 (22/3/5) | 0/5 | SF82 BR-1, SF81, SF83 |
| 08 ⏸ | 32 (28/0/4) | 0/5 | SF82, SF81 DIR-5 |
| 09 ⏸🟥 | 30 (26/0/4) | 0/10 | SF82 BR-2, SF85 WP-2, SF84 |
| 10 ⏸🟥 | 28 (27/1/0) | 0/20 | SF82 BR-4, frame floor, SF85 |
| 11 ⏸ | 29 (22/3/4) | 0/5 | Signal/Sky port tails, frame floor, P0 red CI |
| 12 ⏸ | 43 (26/11/6) | 1/5 | **G330 green lane** (sp-x7); ports; floor |
| 13 ⏸🟥 | 37 (29/4/4) | 0/8 | Driftwood / Sky / Pine port tails |
| 14 ⏸ | 33 (27/1/5) | 0/3 | Nalati; **SF86 run 1 FAIL** |
| 15 ⏸ | 29 (21/1/7) | 2/5 | OS-F rows (SDK docs, guards) |
| 16 ⏸ | 20 (12/2/6) | 1/4 | OS-F2 spear, G320 |
| 17 ⏸ | 33 (27/2/4) | 0/3 | G320 author-only jobs, SF74; **run 2 FAIL** |
| 18 ⏸ | 30 (25/0/5) | 0/5 | G320, OS-G rows |
| 19 ⏸ | 38 (33/0/5) | 0/4 | G320, SF74, SF82; **run 3 PASS** hard gates 19:27 |
| 20 ⏸ | 45 (26/16/3) | 0/4 | E476 commit rules, G331 tidy lane, git fixes |
| 21 ⏸ | 32 (24/6/2) | 0/3 | audio, maps, render |
| 22 ⏸ | 41 (24/13/4) | 0/5 | collider rows (Signal/Sky/Nine), audio, perf |
| 23 ⏸ | 28 (10/15/3) | 2/1 | plans, marketing site; queue green |
| 10-12 00–02 ⏸ | 25 (17/2/6) | 5/6 | sp-x7 CI and git; Driftwood bake rows |
| 03–06 ⏸ | 12 (12/0/0) | 12/0 | only sp-x7 (CI); building lanes idle |
| 07–19 ⏸⛔ | 5 | 2/0 | **Outage** (Xcode licence, reboot): no push 06:53–14:59 and 15:17–19:59 |
| 19 | 3 | — | **G335 19:59: 5 Codex + 5 Opus** |
| 20 🟥 | 78 (20/56/2) | 1/4 | fleet back; hero G338–G341, DS1.4 done, floor |
| 21 🟥 | 93 (21/70/2) | 0/3 | **G345 sprint 21:30**; Signal/Sky ports; G342 near tier |
| 22 🟥 | 63 (19/39/5) | 0/6 | ports; **standing debt rule 22:13**; 220 commits not on origin |

**Where the 1,055 commits went** (by subject):

| Bucket | Commits | Share |
|---|---|---|
| Design / 80-20 (SF76–87, DS, G320, ports) | ~410 | 39 % |
| CI, git, push and the regeneration bot | 240 | 23 % |
| Plan, State and docs | 108 | 10 % |
| Proofs, frame floor, perf, loads | 103 | 10 % |
| Looks, hero, near tier, skies, audio | 89 | 8 % |
| Other (tests, saves, AI authority) | ~105 | 10 % |

---

## 2. Alignment with the approved design (10-10 baseline → today)

| Check | 10-10 | Today | Call |
|---|---|---|---|
| SDK facade aliases (`sdk-no-facade`) | 420 aliases; 193 / 229 exports | **195 aliases in 40 of 108** export modules | On track, half done |
| Game exports (target ≤ 20) | 328 | **103** (the coordinator reworded the target, below) | Drifting |
| One-user lines in game/sdk/engine | 22,043 | **~2,400** in the 6 real shards (Pine 1,856) | **On track** |
| `src/game/plugin/*` | none | 19 modules (design: ~12) | Built, growing |
| Guards exist | no | all 3, plus `shard-game-plugins` | Built |
| `generator-imports` debt | 305 | **433 (+42 %)**, rises auto-approved | **Drifting** |
| `shard-engine-imports` debt | 2,569 | 2,638 | Flat (not shrinking) |
| Generator files importing SDK | 0 | 67 of 226 | On track |
| … still importing engine / runtime | — | 83 import `@wildshard/engine`; 79 import runtime/world | Drifting |
| `bake(scene, identity)` | none | **none** (only `bakeProps` / `bakeKinds` / … pieces; 1 call site) | **Not started** |
| `synth` → `scene.json` | none | `synthScene` built (DS1.2); **0 real shards** call it (Nine uses `readScene` in 4 files) | Built, unused |
| `@wildshard/format` (G313) | none | 108 exports, 8.1k lines, JSON Schema | **On track** |
| Tiles per shardfile (G304) | 0 in 4 real shards | Signal 80; **Driftwood, Pine, Nalati, Nine, Sky 0** | **Not started** (big 5) |
| Private binaries (SF77) | many | every real shard still ships them | Not started |
| Commons (G310) | — | 8 packs; **0 real-shard users** (only the one-shot author) | Drifting |
| SF86 one-shot | — | run 1 FAIL, run 2 FAIL, **run 3 PASS hard gates** (10-11 19:27Z); readability ungraded | **On track** |

**Custom ÷ legacy** (`node scripts/shard-platform.mjs`, working tree 22:48Z; ≤ 20 % = done):

| Shard | Audit 10-10 | State 10-11 | Today | Call |
|---|---|---|---|---|
| Signal Dunes | 80 % | 79.7 % | **61.0 %** | On track (sprint) |
| Sky Reach | 52 % | 74.2 % | **64.4 %** | Recovering (sprint) |
| Nine Dragon | 55 % | 53.6 % | 69.5 % | Up: GLSL moved to runtime/looks (G306) |
| Nalati | 96 % | 95.4 % | 97.9 % | Not started |
| Driftwood | 95 % | 97.7 % | 100.7 % | Not started |
| Pine Hollow | 99 % | 100.1 % | 102.3 % | Not started |

The rises after the audit come from honest re-measures: the G303 move-back and G306 GLSL now count. The 10-11 State
table then kept the same numbers for 18 h without a re-measure.

**SF79–SF87 rows:**

| Row | State today | Call |
|---|---|---|
| SF79 base | plugin/, guards and move-backs done; game exports 103; 195 facade aliases; guards approved past | Drifting |
| SF80 core | format, schema, `readScene`, `synthScene`, DS1.4 materials done; **no `bake(scene)`**; commons unused | Partial |
| SF81 directors | DIR-1–5 "done"; shard runtime **+410** net, platform +360: the replaced runtime was **not deleted** | Done-when unmet |
| SF82 brains | BR-1/2/4 landed, BR-3 held; runtime −725, platform +2,090 | Partial |
| SF83 movers | MV-1–4 landed (Sky MV-2 in the sprint); platform +411, runtime +23 | Done-when unmet |
| SF84 modes | X "done"; runtime −501, platform +1,170 | Partial |
| SF85 weapons | WP-2/4 landed, WP-5 in the sprint | Partial |
| SF86 one-shot | 3 runs, hard gates pass | On track |
| SF87 regenerable | many author-only jobs; physics, spots and near bakes still run trusted code | Drifting |

---

## 3. Drift and wasted work

**Built since 10-10 against the design:**

- **Guards neutered.** `.git/generated-approval.json` (untracked, coordinator-owned) holds 9,910 approved increases
  (194 `generator-imports`, 88 `sdk-no-facade`, 875 `shard-engine-imports`). Since 22:13Z a **standing rule** approves
  every rise of the four shard debts without review (`0179bd253`). The design meant these ratchets to fall.
- **Platform rows grew the platform, not the shards.** SF81–SF84 added ~4.0k platform lines and removed ~0.8k net
  shard runtime. Rows were called "done" on the X half (State `41821fcc1`).
- **Physics and spots bakes run the real runtime in Node** (DS1.5: `942fc577c`, `f85208af3`, `9a964804a`,
  `e3ccb1f22`; generator-imports 6 → 8 per shard). This replaces a browser capture with a Node capture of trusted code.
  G320 says no baker may do that.
- **Near tier is per-shard, in `scripts/`, and committed.** `scripts/bake/nearTrees.mjs` carries a Pine species
  table. Four `near.glb` files of 0.6–4.0 MB were committed and rebaked 3× in an hour (`f508e4a83`, `822416aca`,
  `ac87c91fd`), against G298 / G318 (< 2 MB) and G348. Jake caught it; it is routed to sp-o25.
- **game-plugin-exports refusals were answered by moving exports under `game/plugin/`** (`0d8708dac`: coinReward,
  bossView, bakedSpecs). This passes the gate but turns plugin/ into a catch-all (19 modules).

**Time that did not move 80/20.** About 220 lane-hours ran in the window: ~6 Codex lanes × 30 h, plus about 10 lanes ×
3 h tonight. Roughly **100–120 of them (45–55 %)** went to:

| Sink | Evidence | ≈ lane-hours |
|---|---|---|
| Green lane + push / CI repair | sp-x7 full-time; 59 reds in `red-green.md`; 136 red pushes; 6 green pushes in 26 h on 10-11 | 40–45 |
| Frame floor, SF67 loads, SF63 | sp-x1 + sp-x2 full-time on 10-11; 103 commits | 35–40 |
| Git tooling bugs | commit-message lock (`b87365957`) deadlocked 4× (`93ec1c2fc`); push-retry parsers ×3 | 10–15 |
| Tree tidy (G331) and the regeneration bot | sp-tidy lane; 110 automation commits | 10–15 |
| Outage | 13 h of wall clock lost with ~10 lanes idle (not counted above) | — |

The **Opus pause (43 h)** also stopped the ports at the graphical boundary ("ports at non-graphical floor"). The
80/20 movers waited while Codex built platform rows.

---

## 4. Top 5 corrections

| # | Correction | Recommendation |
|---|---|---|
| 1 | **Restore the ratchets** | Delete the standing debt rule and the auto-sweeper for `generator-imports` / `sdk-no-facade` / `shard-engine-imports`. A rise needs a plan row naming the deletion that pays it back. Unstick the queue by fixing reds, not by approving them. |
| 2 | **Build `bake(scene, identity)` now** | Make the sprint's Signal port go generator → real three.js `Scene` → `bake()` → tiles + `scene.json`. "Done" means tiles and 0 private binaries, not only a line count. |
| 3 | **Reopen SF81–SF85 until runtime is deleted** | A platform row lands only with a net-negative shard `runtime/` diff in the same series. Rows with platform up and runtime flat go back to open. |
| 4 | **Stop running trusted code in bakers** | Physics, spots and near bakes read authored collider and placement rows (G320). Near / far placeholders move into the SDK build, go to the cache instead of git, and carry no slug tables (G348). |
| 5 | **Process diet** | One lane on green; every other lane on ports. Freeze new git tooling except for a red. Re-measure 80/20 every 2 h in State, and put the "game exports ≤ 20" target back. |

---

## 5. Audit of autonomous decisions

Lanes are told to "never use the question tool … decide, note the call" (`lanes/common.md`). These are the calls made
without Jake, ranked by risk ("slop that will need fixing later").

| # | Decision (lane, commit) | Matches design? | Risk | Do |
|---|---|---|---|---|
| 1 | Standing approval of all shard debt rises + a 2-min sweeper that merges lane approval requests (wildshard-new; `0179bd253`, `.git/generated-approval.json`) | **No**: SF79 guards, G307; invisible to git | **High**: debt hidden, guards meaningless | **Revert** |
| 2 | Physics / spots bakes "Node-canonical through the real native construction" (sp-x4, DS1.5; `942fc577c` and others) | **No**: G320 | **High**: legacy deletion will break bakes | **Revisit**: bridge with an exit row per shard |
| 3 | SF81 / SF83 / SF84 called done with the native runtime kept (sp-x4, sp-x6; State `41821fcc1`) | **No**: rows' done-when | **High**: two systems per feature | **Revisit**: reopen |
| 4 | DS0.2 target reworded from "game exports ≤ 20" to "≤ 20 beyond the frozen legacy set" (coordinator; `436a5ec38`) | Edits the approved design | **Med**: 103 exports and facades stay until SF73 | **Revisit**: ask Jake (Q3) |
| 5 | Near tier: Pine species table in `scripts/bake`, 4 committed `near.glb` of 0.6–4.0 MB (looks lane; `ac87c91fd`, `f508e4a83`) | **No**: G298, G318, G348 | **Med-high**: per-shard code, repo bloat | **Revert** to the SDK build (in flight) |
| 6 | New game exports moved under `game/plugin/` to pass the gate (sp-o16; `0d8708dac`) | Letter yes, spirit no | **Med**: plugin/ becomes a catch-all | **Revisit** |
| 7 | Sky Roc fight re-recorded from 21,134 to 26,469 ticks (+25 %) as "intended" (sp-x1; `dbcef52f5` → `f0135d33c`) | Gameplay change, no G-row | **Med**: boss feel changed silently | **Revisit**: compare with legacy |
| 8 | Nalati bake-coats keeps the game-page path "for now" (`8d327777f`) | **No**: G320 | Med | **Revisit**: SF87 row |
| 9 | Home-grown git machinery: commit-message lock, deferred ledger, push-retry parsers (sp-x7; `b87365957`, `93ec1c2fc`, `b0e5804e3`, `1e4406f18`) | Neutral (SF74) | **Med**: each fix spawned new reds | **Keep, freeze** |
| 10 | GPU parity re-baselined for Template and Nalati as "decided changes" (sp-o5; `74ee614cf`, `431c648cc`) | Neutral | Low-med: can hide a regression | **Keep** once the 5 attributing cases are named |
| 11 | Stand-in rigs and hulls in `data/standIns.ts` for Sky and Signal (Sky/Signal lanes; `568a543a4`, `ae7304f04`) | Mostly | Low-med: fallback art can ship | **Keep** if never drawn; else revisit |
| 12 | `format` is the bottom layer and the engine may import it (coordinator; `db6d6fe7d`) | Small design edit | Low | **Keep**; record it as a G-row |
| 13 | Nine raw GLSL kept as a fallback until an iPhone reading (`96eccd627`) | Yes (RENDERING.md) | Low | **Keep** |
| 14 | Permissive fallback for a missing pinned JSON (`aaf0854c4`) | No | Low now | Already reverted (`bbccee7ac`) |

### Questions for Jake

| # | Question | Recommendation |
|---|---|---|
| Q1 | May the coordinator approve rises in `generator-imports` / `shard-engine-imports` / `sdk-no-facade` on its own? | **No.** Down-only. A rise needs a plan row naming its pay-back. |
| Q2 | Physics bakes that run the real runtime in Node: accept as a bridge? | **Yes, as a bridge only.** Each shard gets an "authored colliders" row, and no legacy folder is deleted before that row lands. |
| Q3 | Keep the coordinator's DS0.2 rewording (game exports count only beyond legacy imports)? | **Keep it, but report both numbers** (103 total; beyond-legacy) in State, so the facades stay visible. |
| Q4 | Should lanes keep deciding everything without asking? | **Keep, with a log.** Any call that touches a G-row, a done-when, a gate or a recorded gameplay outcome goes into State's "calls for Jake" list. The plan desk shows it to you daily. |
