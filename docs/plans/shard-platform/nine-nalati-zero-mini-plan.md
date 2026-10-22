# Nine and Nalati to zero: inventory and rows (G592)

Jake, 2026-10-22: *"Getting Nine Dragon and Nalati to 0 is the highest priority."* Measured at HEAD `cabd9be96d` with
`sourceProgressInventory()` by the plan agent's subagent (spans in its scratch `nine-nalati/spans-classified.tsv`, 916 spans;
buckets are a reading of each span, not computed). **Nine 1,519** (1,114 shard files, 405 charged platform code), **Nalati
4,159** (1,028 shard files, 3,131 charged). Rules: G571 (data / AS / WASM or a proper host; no cheating), G572 (done bar),
G594 (one-user hosts the ruler can't see count against the shard once the ruler is fixed: expect these numbers to rise).
Component spikes C1/C5/C6 run inside this plan: [c1-c5-c6-zero-mini-plan.md](c1-c5-c6-zero-mini-plan.md) (G593).

## Where the lines are

| Bucket | Nine | Nalati | What |
|---|---|---|---|
| **A** cuttable now (data/AS, a Pine/Driftwood host fits, dead) | 828 | 1,790 | Nine world/build 203, graphArms 177, plugin 64, course 52, facadeMaterial 50, state 45; Nalati state 190, pageGroups 165, eliteRosterPage 127, mounted 99, figureRows 95, balbal 87 |
| **B** needs a new host | 276 | 85 | a declared render-strategy host (Nine look/render 155, style 30, specimenLight 29, renderEvents 27, light 22, fogBands 13; Nalati painterly look 85) |
| **L** existing one-user host to fix to HOST-BAR 2–6 and list | 118 | 1,507 | Nine scaledPost; Nalati arenaScript 510, eliteEncounters 220, nativeManager 109, groupRuntime 108, riding/binding 96, arenaField 93, crowdRuntime 72 |
| **C** per-frame view → WASM view lane | 0 | 660 (16 %) | Nalati encounterView 251, elitePage 200, nightView 64, rider 44, crowdPage 38, clientTrails 33, reins 30 |
| **E** Jake's call: hand-written GLSL | 297 | 117 | Nine compositeProgram 146, compositeFog 136, compositeLight 14; Nalati staticCapture 52, gradeProgram 36, nightGeometry 29 |

Nalati's C4 creatures (1,758) is mostly the boss/elite stack in L and C; C9 boot glue (1,031) is A once Nalati enters through the
compiled no-TS entry (after O27). Trample is not legacy-only (primary population code imports it).

## New hosts

- **Declared render strategy** (generalising Pine's keyedSky): post chain, programs, LUT, fog bands, light uniforms as rows.
  Two real users from the start: Nine 371, Nalati painterly 96.
- **Specimen studio light rows** in the Model Explorer: Nine 29.
- Reused from Pine/Driftwood: declaredEntry, worldAssembly, worldUpdates, fixedDraws, productCreatures, hull look book,
  socketRigCreature, kitFigureCard, quest figures, nativeBake, pageGroups, clientForestPage, declaredMelee (each re-checked by
  the HOST-AUDIT scoring before more shards lean on it; G594 found some of these borderline).

## Rows (disjoint files)

**Nine first**

| Row | Lane | What | Lines |
|---|---|---|---|
| NA | Opus | render-strategy host + Nine look files + scaledPost | 371 |
| NB | Opus | facadeMaterial onto lent graph looks + specimenLight (after NA) | 79 |
| NC | Opus (O28, sp-o5) | world/build, casts, layoutBake, kit files, signs, modelLook, place.ts onto worldAssembly / fixedDraws / generator bakes | 380 |
| ND | Codex (sp-x8) | compiled-entry flip (plugin, state, index, stub, gear), graphArms + declaredMelee host entries, one-user shardfile bindings | 340 |
| N-E2 | — | composite GLSL, after Jake's E2 pick | 297 |

**Shared:** G591 C5/C6 rows (Codex): course, eliteRosterPage, carriedProp, mounted, bowVariant, heldLauncher, loadout (Nine 52,
Nalati 476).

**Nalati next**

| Row | Lane | What | Lines |
|---|---|---|---|
| LA | Opus | adopt NA's host for the painterly look; painterlyLook, trample, engine render bindings | 180 |
| LB | Codex (X41) | compiled no-TS entry: state, index, manifest, roster, forest weather (after O27) | 338 |
| LC | Opus | species and specimens onto creature / hull-book / specimen hosts | 419 |
| LD | Opus (O27) | POIs, spruce, geography, code-built models, heightPatch, water body | 282 |
| LE1 / LE2 | Codex (after E1) | arenaScript; eliteEncounters + arenaField | 510 / 313 |
| LF | Codex | population hosts: pageGroups, nativeManager, groupRuntime, homeKeeper, crowdRuntime … | 617 |
| LG | Opus (after E3) | the per-frame code in bucket C, onto the WASM view lane | 660 |
| LH | Codex | taming binding + figureRows / figureSkins onto Driftwood's figure hosts | 247 |

## Decisions for Jake

- **E1:** extend G571's one-user-host terms to Nine and Nalati (existing G474/G478 hosts reshaped to pass tests 2–6, each scored
  by the host audit before listing). Governs ~1,625 lines.
- **E2:** the 414 lines of hand-written GLSL: port to look-graph nodes (Z2 measured +64 KB sections, +40–115 MB memory on Nine), or
  rule that GLSL emitted by a build-time generator is data.
- **E3:** widen WASM-HOST's view lane (H9/H13) from Pine/Driftwood to Nine and Nalati.
