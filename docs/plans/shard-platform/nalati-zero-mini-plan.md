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
