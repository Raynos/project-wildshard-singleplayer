# Nalati to zero: C6, C4, C9 spike (G613, G604)

Ruler db9896c70 (22:27 Cancun): Nalati 1,877 = C4 1,118 + C9 751 + C6 8. C1/C2/C3/C5/C7/C8 closed and locked.
Grid-ready 9/10 (Nalati: memory, oneFrameLooks and frame floor still unknown).

**How the spans were found.** I could not re-run `sourceProgressInventory()` without regenerating (the ruler mirror
slot had its generated discovery cleared). The spans come from sp-o4's `tmp/c4/spans-nalati-grasslands.json`
(22:14, HEAD 0ea6fb46f0). Its C4 (1,118) and C6 (8) match the ruler exactly. Its C9 read 826 because of the
census-harness error that 1a3261f4ba fixed: `game/shard/manifest#defineShard/ShardManifestRows/declaredTreeSet`
(74) and `engine/ui/Settings#SFX_SETS` (1) looked Nalati-only. Taking those 75 out gives exactly 751. The C1 47,
C2 186 and C8 156 in that file come from the same error.

## 1. Inventory

### C4 Creatures: 1,118

| Feature | Span (path: lines charged) | Lines | Where |
|---|---|---:|---|
| Storm Titan (L2/L3) | game/boss/arenaScript.ts (540 lines; module charged by G520) 483, game/boss/arenaField.ts 19 | 502 | platform |
| Night views, helper types | game/boss/encounterView.ts: SlotViewActor, SlotSiteChange, Awake, PatrolViewActor, PatrolHit, Rider, PatrolActor, PatrolActorRoster | 9 | platform |
| Elites, headless (L4) | game/shardfile/eliteEncounters.ts: installEliteEncounters 142, HerdEliteProjection 20, Ports 15, types 36 | 213 | platform |
| Elites, page (L4/L7) | game/quest/elitePage.ts: ExternalElitePage 117, ExternalEliteRow/Effect 5 | 122 | platform |
| Wildlife page groups (L5) | game/population/pageGroups.ts 134 (PagePopulationPlanner, PageWildEnvironment/wildEnv, bindPageGroups, rendered*, PageGroups); game/shardfile/crowdRuntime.ts 36 (CrowdPrey, CrowdTargets, prey joins); game/ambient/crowdPage.ts#readCrowdBody 10 | 180 | platform |
| Balbal (L8) | species/balbal.ts:1-70 | 59 | Nalati |
| Species controls (L8) | species/goldenKing.ts 14, presentation.ts 6, definitions.ts 4, game/looks/speciesBook#productSpeciesCatalogue 3 | 27 | mixed |
| Entry glue | runtime/state.ts 4, runtime/index.ts 2 | 6 | Nalati |

### C9 Boot glue: 751

| Feature | Span | Lines | Where |
|---|---|---:|---|
| Entry (LB) | runtime/state.ts 145 (stealth threat loop, ray/aim chain, audio frame, skins sync, update ids), runtime/index.ts 80, manifest.ts 25 (dev poses, load, trustedRuntime), game/shard/plugin#ShardPlugin 2 | 252 | Nalati (+2) |
| Wildlife, native (L5) | game/population/nativeManager.ts#NativePopulationDriver/NativeDriverRows 109, game/shardfile/groupRuntime.ts (NativeGroupCollection 43, installNativeGroupRows 42, other 7) 92, game/shardfile/homeKeeper.ts#NativeDeferredRoster 39, game/population/environment.ts#NativePopulationField 26, game/population/nativeBake.ts (populationMetadata, readPopulationBake …) 14 | 280 | platform |
| Taming binding (L9) | game/riding/binding.ts#TamingBinding 96, game/riding/bindingTypes.ts 29, game/riding/seatedFigure#GESTURES/Mount 2 | 127 | platform |
| Titan install | game/shardfile/worldAssembly#installAssemblyArenaScript | ~22 | platform |
| Weather clock | game/weather/forest#clockOwners/installWeatherClock 13, game/shardfile/worldAssembly#installAssemblyWeather ~20 | ~33 | platform |
| Chapter-facet dependencies | game/systems/npc/figureSkins#atlasFigureSkin 27, game/loadout/actors#equipmentActorOwner 5, engine/physics/heightPatch.ts:11-15 (import lines) 5 | 37 | platform |

The worldAssembly 42 splits as 20 + 22; which declaration is 20 and which 22 is unconfirmed.

### C6 Items and combat: 8

balbal.ts 6 (strike contact), state.ts 1 (bow sneak multiplier), index.ts 1 (HeldClaims slots). A separate audit covers
these in detail.

## 2. Landed today, and who is on what

- **Titan:** 4c997ce062 dual-port v2 projections, e40915bfa4 v2 projections selected, f32f496e31 joint
  schedules, cda600a803 full clock bank, 18a967b63e and 60ccb7a6c9 dead roles and queries, a672369245 King attack
  program.
- **WASM hosts:** H4 dismount/ignite/impulse, L3 cellField and L4 eliteEntry are approved and on HOST-BAR. H5
  queries: c98a74e6e5 native rosters and sight, 0b5d02f011 actor query continuations. View adapter: 9ecda64734
  (instanced/bone/look), e99502318f (cell/tell). 83cf27394b entered page observations; 22057f702a dead v1 view
  deleted.
- **Elites:** f82a81d817 native entries from rows, 4092e0d2cd and 498edb4a47 models out of rows, 041327006f retained
  group state projected, f84c97e85e eight script instances restored.
- **Wildlife (L5):** 5633474d45 the page and native group copies merged (WildSenses, sharedGroupPorts), 14481bae02
  shared raster decoding, 1b8d746255 Pine re-scored as the second user of the crowd target.
- **Riding:** 235d61340b and beae056f90, 72e83202f5 taming service order. **Script:** 502d55f73b shared Nalati
  projection (balbal and the 8 scripts).

**Lanes, from STATE (22:21) and tmp/:**
- sp-x9: H4 actor binding for balbal and C6 (format/actorProjectionV2 draft), then the L5 group step.
- sp-x6: Titan life/tell snapshot.
- sp-o4: Titan view, then the L5 pack AS sim (pack first, herd with sp-x8; its spec is in tmp/c4/l5-group-spec.txt).
- sp-x8: taming to AS (tamingCoordinator.as on worldActionsV2).
- sp-x1: census fix (done, 1a3261f4ba).
- Off Nalati: sp-x2 (CI), sp-o1, sp-o2, sp-o3, sp-o5, sp-x7.
- Elites: no lane. Two routes were measured and both came out net-0.

## 3. Rows (each row's files are its own; order C6, then the unblocked C4 rows, then C9 with the entry last)

| Row | What | Route | Lines | Lane | Size | Done when | Depends on |
|---|---|---|---:|---|---|---|---|
| R1 C6 | state.ts and index.ts C6 lines: the bow sneak multiplier becomes a stealth row on the held-slot bow; slots come from the `held.claims.install` feature | data / existing host | 2 (+6 in R2) | Codex | S, 1 h | C6 reads 0 and is locked in the same commit as R2's last cut | R2 |
| R2 | species/balbal.ts onto format/actorProjectionV2 rows + balbal.as | WASM | 59 C4 + 6 C6 | Codex sp-x9 (in flight) | M, 3 h | balbal.ts deleted; the balbal fixture is similar (G415) | none |
| R3 | species/goldenKing, definitions, presentation, speciesBook#productSpeciesCatalogue: the King's arena-room brain is chosen by a species row; the entry prepares the catalogue | data (L8) | 27 | Codex | S, 2 h | species/ holds no TS | R2 |
| R4 | encounterView's 8 helper types named under the G601 C6 HOST-BAR line (G615); chargeback rows and test updated | approved host (G615) | 9 | Codex | S, 0.5 h | encounterView charges 0 | coordinator says it is G615, not a relabel |
| R5 | Titan sim decisions (life, clocks, support, spear, riders, fire) into titan*.as on the v2 commands and cellField | WASM (L2/L3) | (enables R7) | Codex sp-x6 | M, 6 h | the AS drives the fight; the TS only projects | landed hosts |
| R6 | Titan view module: pose/alpha/flash, chain tells, whirls, fire/scorch through the view-target adapter (instanced, bone, look, cell, tell) | WASM view (L7) | (enables R7) | Opus sp-o4 | M, 5 h | per-frame Titan code lives only in the view module | R5 schema |
| R7 | delete arenaScript.ts, arenaField.ts, worldAssembly#installAssemblyArenaScript; the shell becomes rows per D1 | WASM + D1 | 502 C4 + 22 C9 | Codex | M, 4 h | the Titan fights from AS + rows; physics walk 0 stuck | R5, R6, D1 |
| R8 | eliteEncounters.ts: keeper decisions into Nalati AS (elite.rules); keeper kinds as rows; pouncer/howler/herd/stallion nouns removed; the rest is the L4 engine elite feature | WASM + L4 host | 213 | Codex | L, 5 h | eliteEncounters charges 0 | D2; herd keeper with R10c |
| R9 | elitePage.ts ExternalElitePage becomes an elite view module + eliteEntry rows | WASM view (L7) | 122 | Opus | M, 4 h | elitePage charges 0 | R8 |
| R10a | L5 group step: the ABI v2 group-bank transport (same-tick claim, cross-group refs, path flag, JSON-to-bank codec) | WASM host | (enables) | Codex sp-x9 | M, 4 h | pack/herd banks round-trip a save | R2 boundary |
| R10b | pack AS sim (one module, page + native) | WASM (L5) | (enables) | Opus sp-o4 | M, 6 h | packs run from AS on both sides | R10a |
| R10c | herd AS sim incl. the elite stallion and the taming boundary | WASM (L5) | (enables) | Codex sp-x8 | M, 6 h | herds run from AS | R10a, R11 |
| R10d | delete the page copies: pageGroups 134, crowdRuntime prey joins 36, crowdPage 10 | delete | 180 C4 | Codex | S, 3 h | files gone or 0 charged | R10b, R10c |
| R10e | delete the native copies: nativeManager, groupRuntime, homeKeeper, environment, nativeBake | delete | 280 C9 | Codex | M, 4 h | 0 charged | R10b, R10c |
| R11 | taming: binding.ts, bindingTypes.ts, seatedFigure#GESTURES/Mount become tamingCoordinator.as | WASM (L9) | 127 | Codex sp-x8 (in flight) | M, 5 h | binding.ts deleted | none |
| R12 | weather clock: forest#installWeatherClock + worldAssembly#installAssemblyWeather | D3 | ~33 | Codex | S, 2 h | 0 charged | D3 |
| R13 | chapter-facet dependencies (atlasFigureSkin, equipmentActorOwner, heightPatch import lines): selectors Jake already approved (G478 merged figure groups, G601 C9, G601 C3); the chapterViewNativeOwners rows retire | approved hosts | 37 | Codex | S, 1 h | 0 charged | D4 (ruling) |
| R14 | before the entry: the state.ts stealth threat loop as L6 stealth rows (threat sources = group rosters); the ray/aim target chain as declared rows (Pine's page life is the second user); audio frame inputs and skins sync as rows | host rows (L6, existing) | (enables R15) | Codex | M, 4 h | state.ts holds no feature logic | R7, R9, R10 |
| R15 LB | entry flip: runtime/state.ts, runtime/index.ts, manifest.ts, plugin#ShardPlugin to a compiled no-TS entry (nativePlan features, as Nine in 86af73733d) | data | 252 C9 + 6 C4 | Codex | M, 6 h | Nalati 0; C4 and C9 locked in this commit | everything |

Line check: C4 59+27+9+502+213+122+180+6 = 1,118. C9 22+280+127+33+37+252 = 751. C6 2+6 = 8.

## 4. Blockers and decisions for Jake

- **D1, Titan shell (about 150–200 lines of composition left after R5/R6).**
  - (a) The approved arena-room boss host (the King's) takes an AS-driven open-arena variant as rows. Titan and King
    then share it: a real second user inside an approved host, and no new host. **Recommended.**
  - (b) A new one-user "script arena" host, for Jake's G597 pick.
  - (c) Approve arenaScript as it stands. This is a relabel and goes against his L2 pick.
- **D2, elites.** The lanes measured both routes net-0, so nobody is building them. L4 is Jake's own pick (a generic
  engine elite feature). **Recommended:** R8 counts as honest under L4 if the species nouns go and the keeper
  decisions move to AS, even when the remaining noun-free binder in eliteEntry makes the cut smaller than the lines
  moved. The other route is everything into Nalati AS, which is about 6 h more and still has the
  synchronous-physics limit (the leap kernels stay engine).
- **D3, weather clock (33).** Only Nalati uses it.
  - (a) Pine's day clock adopts installWeatherClock, if it really duplicates it (an honest re-score like 1b8d746255).
    **Recommended**, checked first.
  - (b) A one-user host, for Jake's pick.
  - (c) The clock owners as weather.as rows.
- **D4, ruling, not a pick:** R13's 37 lines are selectors Jake already approved by name. The plan agent or
  coordinator confirms that crediting them is not a G571 relabel.
- **The one technical risk:** R10a's same-tick claim and cross-group writes. G415 allows the claim to land on the
  next tick.
- No new WASM-HOST piece is needed beyond R10a. H4, H5, the commands and the view adapter have all landed.

## 5. Estimate

- **Work:** about 72 lane-hours of rows, about 93 with ~30 % for reds and rework. Roughly 75 % Codex; about 15 h of
  Opus (R6, R9, R10b), which fits even at G605's 3-Opus step.
- **Critical path:** R10a → R10b, with R11 alongside → R10c → R10e → R14 → R15. About 30 h of rows, about 36 h with
  overhead.
- **Finish at 5 Opus + 5 Codex, if D1/D2/D3 are answered by Friday morning:**
  - Realistic: Saturday 10-24 around 12:00 Cancun.
  - Best case: Friday 10-23 around 22:00.
  - If D2 stays unanswered, the elites alone can hold Nalati above zero.

## Speed review (2026-10-23)

Ruler at 07:38: Nalati 1,246 = C4 671 + C9 575 (was 1,877 at 22:27, 1,646 at 01:53). Both windows cut about
**69 lines an hour**. Done since this plan was written: R1, R2 (balbal), R3, R4, R6, R8 and R9 (elites to 0), R11
(taming), R13, part of R14 (-14), and R10a (group banks). R5/R7, R10b/c (landed, fallbacks kept), R10d/e, R12 and
R15 are open.

### Why it is slow

1. **Few lanes on Nalati.** After Jake's G639 (02:20: "the priorities are still Nalati to zero and grid readiness")
   Nalati commits fell from 10–20 an hour (18:00–01:00) to 5–8 (04:00–07:00), while tile, tooling and CI commits rose
   to 25–33 an hour. Of 561 commits since 18:00, about 150 were Nalati. Right now only sp-x8 (herd hot path) builds
   Nalati code; sp-x6 is stuck on the Titan; sp-x9, sp-x1, sp-x2 and three Opus lanes are on extras or grid.
2. **The Titan waits on a second pick.** D1 was ruled at 23:20 (arena-room host variant). sp-x6's 846653fabf shared
   the lifecycle (+95 platform lines, 0 credit) and two sized routes failed, so STATE now asks Jake again. 355 C4
   lines (plus 24 C9 and 17 borrowed) sit behind that question: about 30 % of what is left.
3. **Work done twice.** The herd and pack landed at 03:17 and 03:55, were rolled back at 04:28 (-1,024 lines, live
   Nalati at 20–30 fps) and re-landed at 06:09 and 06:52: about 3.5 h of two lanes. They were re-landed with the TS
   fallbacks kept, so they cut nothing, and C9 barely moved (582 to 575).
4. **The deletions wait on one Simulator sample.** R10d and R10e (about 400 lines) are held until sp-x8's fix passes
   sp-o3's combined sample, which needs the one Simulator and a green HEAD build. G415 says not to gate a port on
   Simulator ms; the 217 ms frames are real, but deleting the fallbacks does not need to wait for the sample.
5. **Red main most of the night.** The CI run on main was red about 10.7 of the 13.3 h from 18:05 to 07:25, in nine
   windows; the longest were 00:00–02:40, 02:50–04:01 and 04:10–05:28. G620's 30-minute fix-forward-then-revert did
   not hold. The causes were product-build hook timeouts, stale fixtures, and a generated-inputs reader landing before
   its producer. Each red delays the HEAD preview that the next measurement needs.
6. **Small slices on one lane, the entry left for last.** The elites took 10 commits of 6–69 lines over 4.7 h (fine,
   but serial). The entry (R15, about 230 C9) is one 6 h row at the very end, though some pieces of it (the elites
   bind block, the weather hook) already have hosts.
7. **Rows with no owner.** R12 (weather clock, 33) has had Jake's D3 fallback since 23:58 and nobody on it. No lane
   holds an up-to-date span list: the newest is sp-o4's from 22:14, and roughly 150 C4 and 85 C9 lines are not
   attributed below.

### What is left (estimates from the chargeback table and commit messages; R19 makes them exact)

- **C4 671:** the Titan's OpenArenaProjection in game/boss/arenaRoom.ts 355; wildlife page copies about 160
  (game/population/pageGroups.ts about 150, game/ambient/crowdPage.ts#readCrowdBody 10); entry 6; about 150 not
  attributed (probably Nalati-only Titan fire and wildlife code the re-lands grew).
- **C9 575:** entry about 230 (runtime/state.ts, runtime/index.ts, manifest.ts, plugin#ShardPlugin); wildlife
  native copies about 235 (nativeManager, groupRuntime, homeKeeper, environment, nativeBake); the Titan install
  arenaRoom#buildOpenArenaEncounter 24; about 85 not attributed.
- **Borrowed, skipped by the ruler but still to go:** crowdRuntime prey joins 36, riding/client ArenaBoundary 17,
  weather forest#installWeatherClock + worldAssembly#installAssemblyWeather 33.

### Critical path

| Step | Lines | Owner | Size | Waits on |
|---|---:|---|---|---|
| Herd hot-path fix (in flight) | 0 | Codex sp-x8 | ~2 h | nothing |
| R10e: delete the native copies | ~235 C9 | Codex lane B | 4 h | the hot-path fix |
| R10d: delete the page copies and crowd joins | ~200 C4 | Codex lane A | 3 h | the hot-path fix |
| R16: Titan credited or ported | ~395 | Codex | 0.5 h after the pick, or 10–15 h for a full WASM route | Jake |
| R15a–c entry slices and R12 weather | ~230 | Codex lane C | 5 h | nothing |
| R20: unattributed remainder | ~235 | Codex | 3 h | R19 |
| R15d: the final entry flip | ~40 | Codex | 2 h | all of the above |

The path is the hot-path fix, then R10e, then R15d: about 8 h of rows, about 10–11 h with reds. The Titan is off the
path only if Jake picks the one-user host.

### New and changed rows

| Row | What | Lines | Lane | Size | Done when | Depends on |
|---|---|---:|---|---|---|---|
| R16 (replaces R7) | Jake's pick on the Titan, from STATE: (a) list OpenArenaProjection, buildOpenArenaEncounter and ArenaBoundary as one one-user host for HOST-AUDIT (the G596 route, made after G597 withdrew lane-added hosts), credited in one chargeback commit; (b) a full WASM route; (c) leave it charged. **Recommended (a).** | ~395 | Codex sp-x6 | 0.5 h (a) | arenaRoom charges 0 to Nalati | Jake |
| R10d (amended) | Delete the page copies and the crowdRuntime prey joins as soon as the hot-path fix lands. Land on types, lint and `vitest related` (G612); git is the fallback, a regression is fixed forward or reverted under G620. | ~200 | Codex lane A | 3 h | pageGroups, crowdPage, crowd joins charge 0 | hot-path fix |
| R10e (amended) | The same for the native copies, in parallel with R10d (separate files). | ~235 | Codex lane B | 4 h | the five native files charge 0 | hot-path fix |
| R17 | One combined Simulator sample on HEAD after R10d and R10e, not before. | 0 | Opus sp-o3 | 0.5 h | median and the 100 ms rule read on one preview | R10d, R10e |
| R15a | Entry slice: the elites bind block in runtime/index.ts becomes a manifest feature row (the elites are already the engine feature). | ~25 | Codex lane C | 1.5 h | index.ts has no elite code | nothing |
| R15b | Entry slice: the King, Titan and ride binds and their publishEntryOwner calls become arena-room and taming feature rows. | ~60 | Codex lane C | 2 h | index.ts has no boss or ride code | R16 for the Titan part |
| R15c | Entry slice: the state.ts update loop and weapon handlers become declared world-update and stealth rows (rest of R14). | ~110 | Codex lane C | 2 h | state.ts holds wiring only | R10d/e for the wildlife reads |
| R12 (owner now) | Weather clock: D3's fallback, the clock owners as Nalati AS rows. | 33 | Codex lane C | 2 h | forest and worldAssembly charge 0 | nothing |
| R19 | The ruler run also writes each shard's span list (path, symbol, component, lines) next to ruler.json, so rows target real lines without a mirror run. | 0 | Codex sp-x1 | 0.5 h | the next ruler run has the list | nothing |
| R20 | Cut the spans R19 shows that no row above covers. | ~235 | Codex | 3 h | none left outside R15d | R19 |
| R15d (was R15) | The final flip to a compiled no-TS entry, as Nine did in 86af73733d. | ~40 | Codex | 2 h | Nalati 0; C4 and C9 locked | everything |

### Stall audit, 10-23 14:50 (ask E493)

Jake, 14:45: *"Zero progress has been made on [Nalati] in 4 hours, like something is wrong."* A read-only subagent
audit found that Nalati sat at 225 from 10:20 because **nobody worked on the only code that still counts**. All 225
lines are the three entry files plus 4 platform lines: `manifest.ts` 25, `runtime/index.ts` 57,
`runtime/state.ts` 139 C9 + 3 C4, `plugin#ShardPlugin` 2 and `seatedFigure#GESTURES/Mount` 2. The 16 Nalati commits
since 10:00 were no-binaries work (base64 out of JSON), which the census doesn't count. sp-x2 left the entry slices
for G610 at 10:09, and no lane replaced it. R15c/R15d had no owner and were missing from `lanes/ready-queue.md`. Pine,
Driftwood and Nine got to zero with the same two steps: `manifest.json` (a5e53cc7d7) and a deleted runtime entry
with `entry: {platform: "client-plan"}` (86af73733d). Nalati can copy them. These rows replace R15c/R15d and R20.

| Row | What | Lines | Owner | Effort | Done when | After |
|---|---|---:|---|---|---|---|
| R21 (S1) | `manifest.ts` → `manifest.json`: poses baked with terrain heights at generation time; keep `entry: {native}` for now (copy a5e53cc7d7) | -25 | Codex | 1.5 h | no manifest.ts | now |
| R22 (S6) | `GESTURES`/`Mount` join the riding `SeatedFigure` host listing (census fix) | -2 | Codex | 0.25 h | not charged | now |
| R23 (S2) | `runtime/index.ts` world/kit/play onto the existing features: `species.program`, `held.claims.*`, `state.adventure`, `weather.forest` → HUD, `debug.expose` | ~-30 | Codex lane C | 2.5 h | index.ts holds only the host guard | now |
| R24 (S3) | `state.ts` assembly (prefix, trophies, dressing anchors) as `world.assembly` rows; the King as an `arena-room` stage (worldAssembly.ts:325 gains the room variant) | ~-32 | lane C | 3 h | no WorldAssembly or buildArenaRoomEncounter calls in state.ts | R23 |
| R25 (S4) | Weather loan, update-id loop, Titan bind, combat targets (Pine is the second user, pageLife.ts:146) and debug as `world.updates` / targets / `debug.expose` rows | ~-35 | lane C | 3 h | those blocks gone | R24 |
| R26 (S5) | Stealth, riding, night and elite construction plus weapon handlers as features over the approved hosts (HOST-BAR.md:175, :205, :291); the Nalati-only adapters become hosts listed for HOST-AUDIT, credited in one chargeback commit (G677) | ~-70 shard, ~+40–60 listed platform | Codex lane D | 4–5 h | state.ts holds no glue | now |
| R27 (S7) | Final flip: delete `runtime/index.ts` and `state.ts`, `entry: {platform: "client-plan"}` (copy 86af73733d); `ShardPlugin` drops out; boot smoke and physics walk | rest (~-30, -2 platform) | Codex | 2 h | Nalati 0, C4 and C9 locked | all above + the JSON-node red fixed |

Blockers: Nalati's shard file sits at 100,041 JSON nodes against the 100,000 limit (sp-x9 is fixing it; previews refuse
to build until then); the pick on the Nalati-only adapters (answered: G677, HOST-AUDIT). About 17 lane-hours: zero is about 10–12 h after two
Codex lanes start (one on R21/R22 then R27, one on R23–R25), with R26 on a third lane.

**Lanes:** G639's order applied: three Codex lanes on Nalati (A, B, C) plus sp-x8 and sp-x6 until zero, taken from the
extras (B5 no-binaries, T4, tile streaming). Every row left is non-graphical, so the Opus step-down (G605) is not the
limit: only sp-o3's single sample needs an Opus lane. sp-x7 reverts any red older than 30 minutes (G620).

### Estimate

- **At today's rate** (about 69 lines an hour, one or two lanes, deletions held for the sample): the wildlife copies
  are gone around 20:00 Friday, the entry around 02:00–04:00 Saturday, and Nalati stops at about 400 until the Titan
  pick. With route (b), zero comes around Saturday 18:00–22:00 Cancun.
- **With the rows above** and Jake's (a) this morning: about 150–200 lines an hour on the parallel rows; zero around
  Friday 10-23 19:00 Cancun (best case 16:00).

### R10d / R10e sized (2026-10-23 13:40–14:00Z, sp-x1 and sp-x8; replaces the blanket estimates above)

After the herd hot-path fix (dc8dbcafcc) the page and native copies are **not dead duplicates**: the herd and pack
decisions already run in AS, and what stays charged is live wiring (placement and spawn, environment, effects,
construction and member wiring, prey references, native driver, deferred roster, field). First cuts: 18c6dbc17f
(initializer, net -4), 7485f396d1 (shared Stalker roster, net -4), aaa2baf0c7 (stock bake reader, -3).

| Row | Piece → existing 2+-user owner | TS removed | TS added (est.) | Hours | Lane |
|---|---|---:|---:|---:|---|
| R10d-1 | Crowd body / prey refs (page 36 + native 10) → FlockBrain loans + one stable reference codec | 46 | 35–55 | 4–6 | sp-x1 |
| R10d-2 | Group factories / rendered joins (page 45 + native 46) → GroupBrain row construction | 91 | 80–115 | 5–7 | sp-x1 (+ sp-x8 native diff) |
| R10d-3 | Environment (page 27 + native 20) → WildSenses / field rows | 47 | 40–60 | 4–6 | sp-x1 |
| R10d-4 | Crowd geometry → fixedDraws named geometry (+ animated sphere override) | 10 | 12–18 | 2–3 | sp-x2 |
| R10d-5 | Page effects / damage → AS cooldown/result rows (+ 20–35 AS) | 25 | 30–45 | 3–4 | sp-x2 (first) |
| R10d-6 | Placement / spawn → admission AS with a GroupStepNativeV2 spawn result op (+ 70–110 AS) | 41 | 90–140 | 8–12 | after its own sizing |
| R10e-1 | Population reader → named Product.json metadata + assembly.merge | 9 | 12–20 (producer) | 2–3 | sp-x8 |
| R10e-2 | Deferred roster → createNativeCreatureRoster deferred row | 39 | 42–60 | 4–6 | sp-x8 |
| R10e-3 | Field → GrassField + scalar readers, pure prepare kernel first | 22 | 35–55 | 4–6 | sp-x8 |
| R10e-4 | Driver → finite native profile in StalkerBrain.bindRoster + ActorProjectionV2 | 98 | 150–220 | 8–12 | sp-x8 |
| R10e-5 | Collection / install → GroupBrain / SimHost setup (with R10d-2) | ~98 | 90–140 | 6–10 | sp-x8 |

**Ruling (wildshard-new, G621 D2 / G571):** each row deletes the Nalati sections outright and adopts an owner two or
more shards already use; total TS growth is reported in the commit, never hidden by a move or relabel. Order is the
table order per lane. R17 (one Simulator sample) stays after R10d and R10e.

**Second-user check (14:10Z):** before a row is written, its owner must have a second non-empty shipped user (a
real shard's data or code). R10d-1 failed it (FlockBrain's only crowd data is Nalati's: -33 C4 / +17 total, draft
dropped), so rows like it join the Titan (R16) on Jake's HOST-AUDIT pick list instead of landing as credit. Also on that list: R10d-5's
signal/knockdown → HUD toast/dash effect adapter (only Nalati would use it; sp-x2's census, 14:15Z). R10d-4 passes:
fixedDraws ships Driftwood's fixed layouts.

**Estimate:** about 520 charged lines go for roughly 530–880 TS added, **50–75 lane-hours** across sp-x1 and sp-x8
(not ~7). With R15/R20 on lane C and the Titan pick, Nalati zero moves from Friday 19:00 to about **Sunday–Monday**
Cancun at two wildlife lanes, about Sunday with sp-x2 as the third (from 14:05Z, after R15a/R15b).
