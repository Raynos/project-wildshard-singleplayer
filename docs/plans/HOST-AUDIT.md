# Plan: HOST-AUDIT — score every engine and game host, fix the ruler, put shard code back in the shard

**State:** `draft` 2026-10-22 — an off-shoot of [SHARD-PLATFORM](SHARD-PLATFORM.md); nothing is worked until Jake says go.
It takes over the audit half of [SHARD-PLATFORM-NEXT](SHARD-PLATFORM-NEXT.md) N4 (if Jake agrees, pick 1). Decisions
stay in [shard-platform/decisions.md](shard-platform/decisions.md); the bar is [docs/HOST-BAR.md](../HOST-BAR.md).

Jake, 2026-10-22, after the G594 audit found Pine/Driftwood code hidden in one-user TypeScript hosts: *"Tell me of
those TypeScript hosts in the engine. Do they even live in the engine? Do they live in a game workspace? Where do they
live? Are they good, stable, borderline, silly? What is our ranking and scoring for those hosts? And how do we fix the
ruler? … a new off-shoot platform plan: audit, review the hosts … borderline hosts, broken rulers, stuff that shouldn't
be in the engine or in the game workspace and should be in the shard file, chargebacks, all that stuff. We have a whole
bunch of hosts. I don't know where they live, but they need to be scored and ranked. Stuff that clearly does not belong
in the engine or the game needs to go into the shard files as data or WASM. Various hosts need to either be deleted or
made generic. That is a new draft plan that needs to be done across the entire engine, entire game."*

## Where the hosts live (first pass, HEAD a03bd35a8a + the in-flight tree, 2026-10-22)

Platform code: engine 668 files / 100.8k lines; game 613 / 94.6k; format 261 / 19.2k; sdk 155 / 12.1k; commons 3 / 0.2k.

**250 modules are named as hosts** by at least one of today's five lists (35 by more than one): game **201**, engine 28,
format 18, sdk 3, commons 0. Inside game: shardfile 51, quest 18, looks 14, population 13, plugin 13, boss 12, models 11,
loadout 10, riding 10, animation 7, systems 6, grapple 5, weapons 5, the rest 1–3 each. HA1 also finds the unnamed ones
(a one-user module no list mentions).

How a host is identified today (five lists, no single register):

| List | Where | Size |
|---|---|---|
| Section hosts (G294 roots) | `scripts/shard-platform-hosts.mjs` | 62 modules for 63 section kinds |
| Approved features G473–G484 | `lint/platform-pending-users.json` `approvedFeature` | 147 entries, 63 with no shard and no recheck |
| Pending users | same file, `shard` + `rechecked-by` | 136 entries, all "end of W3" (122 name Nalati) |
| G571 day-one hosts | `- G571` prose lines in HOST-BAR, parsed by `scripts/g571-hosts.mjs` | 31 lines, 48 modules / 78 selectors at HEAD |
| Chargebacks | `scripts/platform-chargebacks.mjs` | 26 modules; 42 commits touched it, 18 removed charges |

Scores so far are scattered snapshots: the 10-16 audit (92 pending hosts: 77 good, 14 borderline, 1 silly), the Sky and
Signal deep dives, the 10-17 rescore (31 self-scored hosts, 14 too high), the 10-21 Pine charge audit. There is no
standing score per host, no rank and no recheck date.

## Why the ruler is blind (found in this pass)

1. **Synthetic import** (G594): every product with `client/plan` imports `clientPlan#installClientPhase`
   (`scripts/shard-platform-hosts.mjs:11`).
2. **Static fan-in, even without (1):** `clientPlan.ts`'s `CLIENT_FEATURES` registry imports every client host, and
   `clientPlan.ts` is itself statically reached from the shell (`session.ts`, `mainMenu.ts`, `session/loadout.ts`) and
   from 10 other section hosts (`explorerCatalogue`, `declaredEntry`, `productNavigation`, `loadout/claims`, `held`,
   `heldGear`, `plugin/heldEquipment`, `plugin/ui`, `worldScenes`, `complete/declared`). Every client host gets every
   user. Deleting line 11 alone fixes nothing.
3. **Kind-level is still too coarse:** a two-user kind with a one-user optional part (Pine's views inside
   `quest.composition`) stays free.
4. **Shell exemption:** any module under `game/shard/`, `game/grid/`, `game/session/`, `game/travel/` that the shell
   reaches is never charged (`SHELL_CONTROL_PREFIXES`, `shard-platform.mjs:648`, `:824`); two G571 hosts live there.
5. **Format is skipped:** `src/format/` modules are never charged unless a chargeback names them (`:821`), so a
   one-user host's schema is free.
6. **Self-approval:** a lane that writes a `- G571` line in HOST-BAR grants its own module credit; `questPageViews`
   (the G594 cheat) and `ropeDeckSite` are listed that way. The prose parser is fragile: today's working-tree
   HOST-BAR has a duplicate line that makes `g571-hosts.mjs` throw.

**First-pass sizing** (regex import graph, registry fan-in cut, kind-level attribution by the kinds each shard
declares, before any G571/approved exception): of 45 client-plan kinds, **25 have one user**; ~**4,570 lines in 49
modules** are reachable only through one shard's kinds: **Pine 2,781 / 25, Driftwood 924 / 12, Nalati 869 / 12**.
Exceptions will cut that; the ruler gives the honest figure (HA0).

## Example verdicts (tentative; HA2 scores them properly)

| Host | Lines | Lives | Users | Tentative verdict |
|---|---|---|---|---|
| `game/quest/questPageViews` | 112 | game | Pine | **Silly**: Pine's views renamed (G594); back to Pine as rows + H9 view lane |
| `game/shardfile/clientForestPage` + `weather/forest`, `shardfile/forestPage`, `format/forestPage`/`forestWeather`, `looks/forest*`, `audio/forestPage` | ~810 | game, format | Pine | **Borderline**: kinds named after Pine (`world.forest-page`, `weather.forest`, `page.life`); generic page rows or back to Pine |
| `game/shardfile/worldAssembly` | 100 (+283 overnight) | game | Driftwood | **Borderline**: Driftwood's build order as stage rows |
| `game/models/ropeDeckSite` | 134 | game | Driftwood | **Borderline**; `engine/physics/ropeChain` (230) is a real engine feature |
| `game/models/islandLibrary` | 87 | game | Driftwood | **Good under G586**, but G586 says engine host and it lives in game |
| `game/population/shelter` | 134 | game | Pine | Good under G571 if tests 2–6 hold; recheck |
| `game/riding/*` | 3,042 | game | Nalati (+ Pine's `page.life` reaches `riding/native*`) | **Game host** (G478); confirm the real second user |
| `game/grapple/*` | 1,022 | game | Nine | Game host on a fixture only (G478); recheck date needed |
| `game/shardfile/sceneDressing` + `sceneInstances` | 289 | game | Nalati | Borderline: generic shape, one user (G483) |
| `game/loadout/cosmeticFinishes` | 184 | game | Nalati | Borderline: one user (G474) |
| `game/plugin/*` (HybridRuntimePlugin 1/6) | 13,405 | game | all, via 7 section kinds | **Silly scaffolding**; still a root for data products (movers, sim, brains, held equipment, UI) |
| `engine/player/nalatiArms` | 20 | engine | Nalati generators, legacy | **Layer violation**: shard name in the engine; move to Nalati's generators |
| `engine/world/steppeWind` | 211 | engine | every shard | **Engine feature, misnamed**: rename to wind, drop the Nalati/Pine prose |
| `engine/ui/HUD.ts:371` | 1 | engine | — | **Layer violation**: item labels (`'Bolts'`, `'Broadheads'`) in engine code; an item row flag |
| `engine/models/hoverboard`, `player/hoverSpeed`, `ui/hoverBoost` | 81 | engine | every shard's kit | **Misplaced**: a Wildshard kit tool, so a game host |
| `engine/world/waterSurface` | 252 | engine | Pine legacy | **Dead at N5** (G500): goes with `pine-hollow-legacy` |
| `engine/explore/img/mockups/nalati-*`, `nine-*` | 10 JPEGs | engine | — | **Layer violation**: shard mockups in the engine |
| `game/models/explorerCatalogue#ProductExplorerDispatch`, `looks/posedInstances#PosedLibrary` | ~60 | game | Pine | **Chargeback re-check** (96b965a60f, 74ffcac600 were self-scored) |

148 engine files name a shard (mostly provenance comments); HA2 sorts comment from code.

## Rules

- G571 still holds: a new generic host is allowed with one user when it passes tests 2–6, **if Jake approves it**.
  Builders never approve their own host.
- **Fresh scorers**: HA2 and HA3 scores come from up to three fresh Opus seats, never the lane that built the host
  (the 10-17 rescore found 14 of 31 self-scores too high).
- **Simplify, don't add**: HA5 replaces three lists with one; no receipt folders, proof docs or witness files. The only
  page is HA2's score table.
- **The correct way** (G571): silly code goes back to its shard as data rows, generators or AssemblyScript/WASM
  (per-frame views on WASM-HOST's H9 lane), never a renamed TS file.
- Lanes keep working while this runs (never pause); a fix lands at a lane's task boundary.

## Rows

| Row | What | Effort |
|---|---|---|
| **HA0** | **Fix the ruler first.** (a) Drop the `client/plan` synthetic import; the ruler reads each product's declared client-plan kinds (and every other dispatch table: section hosts, Explorer dispatch, chapter facets, headless capabilities) and follows only those entries' modules. (b) Treat `CLIENT_FEATURES` as a dispatch table, so a static registry edge is not a user. (c) Charge optional sub-rows by the products whose rows reach them (declaration level, as G294 does for exports). (d) Narrow the shell exemption to the shell's own control code by name, not by folder. (e) Charge `src/format` modules like any host. (f) A host counts as platform only with ≥ 2 real shard users, or as a listed Jake-approved G571/G586-style host passing tests 2–6. Verify: a made-up two-product fixture where one product declares one kind charges exactly that kind's closure; Pine and Driftwood rise from 0 % by at least the ~807 lines G594 named; Sky and Signal (shared kinds) barely move; the four G594 hosts show as charged | 1–2 days |
| **HA1** | **Full inventory, generated, not by hand.** A ruler mode prints every module in engine / game / format / sdk / commons: workspace, the host it belongs to, lines, real users (from HA0), and which list names it (section, kind, approved, pending, G571, chargeback, none). Taken at one SHA | 0.5–1 day |
| **HA2** | **Score and rank every host** (~250 named plus HA1's unnamed one-user modules): the six tests 1/0 with file:line for every fail, verdict (engine feature / game host / borderline / silly / dead / layer violation), where it should live, and rank (lowest score first, then most lines). One table, `docs/reviews/host-audit.md`, also an artifact for Jake | 2–3 days (3 seats) |
| **HA3** | **Chargebacks and approvals re-check.** Every one of the 18 charge removals (74ffcac600 and 96b965a60f first) and every G571 line (48 modules / 78 selectors) re-scored by a fresh seat; a failed one is charged back at once | 1 day |
| **HA4a** | **Silly → back to the shard** as data, generators or AS/WASM: `questPageViews` first (H9 view lane), then HA2's list in rank order | per host |
| **HA4b** | **Borderline → a named fix**: genuinely generic (no one-shard fields, tests 2–6) or back to the shard. The forest family, `worldAssembly`, `ropeDeckSite`, `sceneDressing`, `cosmeticFinishes` first | per host |
| **HA4c** | **Dead → delete** with its `package.json` export, schema and tests in one commit | small |
| **HA4d** | **Layer violations → move**: shard names, content strings and mockups out of the engine; game concepts (the kit hoverboard) from engine to game; `islandLibrary` to where G586 put it; one-shard logic out of `game/shard/` | per host |
| **HA4e** | **Plugin scaffolding**: list which data products still route through `game/plugin/` and hand each route to SHARD-PLATFORM-NEXT N2/N5 (deleted there, not here) | 0.5 day |
| **HA5** | **One host register so it can't drift.** One JSON row per host (module or binding, verdict, score, deciding G row, recheck date) replaces `platform-pending-users.json`, the HOST-BAR G571 prose parse and `platform-chargebacks.mjs`. The ruler fails on a one-user host with no row; a row past its recheck charges back; a platform verdict needs a G row Jake made. HOST-BAR keeps the bar, not the list | 1–2 days |
| **HA6** | **Re-measure every shard honestly** after HA0 and again after HA4: custom % and net platform lines per shard, written into SHARD-PLATFORM's numbers | 0.5 day |

## Order

HA0 → HA1 → HA2 (HA3 alongside) → HA4 in HA2's rank order → HA5 → HA6. HA0 alone answers G594's ruler ruling and
unblocks the held Pine/Driftwood grid-ready latches; it will also move Nalati and Nine's numbers. This draft decides
nothing about SHARD-PLATFORM's G592 order (Nine and Nalati to zero first); it starts on Jake's word.

## Picks for Jake (when he starts it)

1. Does HOST-AUDIT take over NEXT N4's audit now? Recommended: **yes**; N4 keeps only the net-lines report.
2. ~~Do the existing self-written G571 listings keep credit until HA3?~~ **Decided by G595** (Jake, 2026-10-22): every one-user host, new or
   already listed, is approved by Jake himself, host by host; HA2/HA3 results reach him per host with the tests 2–6 scores and file:line
   evidence; rejected hosts fold back into the shard (HA4a). The four G594 hosts lose credit at HA0.
