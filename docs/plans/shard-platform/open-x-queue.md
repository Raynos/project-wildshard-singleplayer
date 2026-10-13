# SHARD-PLATFORM — open engineering (X) queue (coordinator-written)

Source: sp-x6's read-only sweep of SHARD-PLATFORM.md and design-system.md on 2026-10-11, reconciled against the
landing receipts. Graphical / O parts, the readability and looks seats, and Jake's picks are excluded; they wait for Opus.
Sizes: S ≤ half an agent-day, M ≤ 2, L ≤ 5, XL > 5. Rows that share an owner below are one backlog, not separate estimates.

## Part A: open engineering, assigned

| Row | What remains | Size | Lane |
|---|---|---|---|
| SF22 / SF0 milestone gate | Safari / frame-floor main-thread waits, crossing and install cadence; requalify the assembled routes | M–L | sp-x4 (Safari), sp-x1 (floor) |
| SF67 | Responsive cold/warm loads: the remaining > 100 ms work, cold-arrival waits, home exit/return, real progress; per-phase remeasure | L | sp-x2 (all cells), sp-x1 |
| SF74 tails | W12 nightly flakes; W14 lock collisions; W16/W23 CI duration balance; W21 polling census; W24 cached-gate timings; W25 stale-prefix / non-vitest red handling; W27 regeneration census; W28 heavy-proof x64 portability; prove 12 h commit-to-origin and the one-day release | M–L | sp-x7 (between reds) |
| SF86 / OS-1 | Grade run 2 (hard gates, friction delta); fix newly shown gaps; repeat at M3 | S + fixes | sp-x5 |
| SF87 / G320 + G292 / G318 | Producers truly authoring-only; complete cold shard-product jobs; runtime/legacy/cache-deleted clean room green; then per-output cache promotions and removals (cold job, pinned hash, Linux build and boot) | XL | sp-x6 |
| SF82 BR-1, BR-2, BR-4, BR-5 | Automatic row admission with per-body authority; automatic root boss construction; Driftwood Captain and Nalati Qara ownership; Pine's remaining native continuation gaps | L each | sp-x5 after run 2 |
| SF82 BR-3 / SF49-p | Sky Roc flight and finite keeper: KEPT tail unless a fitting shared seam keeps frozen traces | L (feasibility) | held |
| SP3 / SF7c | 83 function/class-valued row fields → serializable data or named admitted bindings (overlaps the port tails) | L, spread | with the ports |
| SF25 | Read-only client presentation for ambient / idle / crowd / particle updates; shared-state writes refused | L | next free |
| SF29 | Native audio, catalogue, bed and score routing through emitted declarations; sound bytes exact | M–L | next free |
| SF57 | Current-catalogue memory qualification and the Developer cells + road soak | M + soak | next free |
| SF60 | Daily pinned build / playtest / feedback receipts (automation only) | S, recurring | sp-x7 |
| SF61 | Retire comparison and director switches after parity; delete dead paths; lower the Debug inventory | S–M | next free |
| SF64 | < 10 % no-owner memory attribution with aligned native / heap / region evidence | L | next free |
| SF66 | The baked map image inside the charged shardfile file closure / schema | M | next free |
| SF77 / SF79 base exit | Content-gate adoption and enforcement as ports qualify; remove private runtime-decoded world binaries | M | next free |
| SF80 / DS1.6 / SF26 | Production adoption of the qualified commons packs with download-once proof (figure textures are O) | M–L | after O inputs |
| SF72 / SF46-p, SF47-p, SF48-p | Driftwood, Pine and Nalati whole-native witness gaps, then shrink the bridges | XL each | after BR rows |
| SF50-p, SF49-p, SF51-p | Signal, Sky and Nine port X tails toward ≤ 20 % | L–XL | after BR rows |
| SF73 | Per-shard legacy deletion and save migration after ≤ 20 % and the gates | S–M each | blocked by ports |

## SF87 / G320 status (2026-10-11, sp-x6)

Author-only, cold clean-room exact: Template and Pastel (terrain, props, behaviour); Nine entries, fronts, floor boxes,
portal floors and deck caps; Sky islets; Driftwood director; Pine night, clock and elites; Nalati raid, ghost, Qara and
weapon hooks; Signal skitterer. Whole-product deletion stays guarded (`e6df68b43`).

Still trusted / blocked:
- **CPU, X:** the physics bakes (Driftwood, Pine, Nalati, Nine, Sky, Signal) and the Driftwood and Pine spots still run
  trusted world, quest and species constructors; their placements are coupled to collider and rig recipes. Driftwood's
  navmesh seeds from the public `navmesh.bin`, not a cold author source.
- **Graphical, O (waits for Opus):** Nine's layout builds Square/Towers/Well meshes and neon/sign geometry; the static jobs
  (Driftwood fixed models; Pine pond, cabins, crags, lookout, props, timbers, streams, undergrowth, wildlife, King
  collision; Nalati bodies and places; Sky rigs and world; Signal rigs, sand and world) and every skin need geometry,
  rig or pixel authoring owners.

## SF87 Pine: the O producers left after sp-x6's author ground (2026-10-12)

sp-x6 owns Pine's author ground (native analytic lattice), the `data/layout` / `behaviour/layout` split and the streams
job. These producers still run trusted constructors and need geometry authored first (Opus subagent work):
- **crags, props:** author forest trunks + GLB kit geometry.
- **lookout, timbers, cabins:** author timber / UV geometry.
- **undergrowth, wildlife:** author forest / rig / spec builders.
- **beaver pool:** author `pondGrid`.
- **King collision:** author rig / pose metadata.
No trusted constructor goes into an allowlist; Pine's product deletion waits for all of them.

## Part B: deferred (not started without Jake's word)

S1 population / LOD-AI · S2 interior / vertical streaming · S3 physics toys and vehicles · S4 climb / drive / author-AS modes ·
S5 restricted shader-source compiler · S8 director stem / reverb zones · S9 sandboxed panel canvas · S10 shared world-state
persistence · S11 sign author metadata · S12 phone QR in wildshard dev · S13 one-click Vercel preview · S14 objective /
stuck-route bot · S15 AI playtester · S16 npm create wildshard · S17 quickstart skill · S18 wildshard upgrade · S19
outside-author battery · S20 grid-wide director events · S22 commons quest / dialogue / encounter generators.

## Part D: Jake's 48-hour review picks (2026-10-13; G349–G352, review `docs/reviews/shardfile-48h-review-2026-10-12.md`)

| Row | What remains | Done when | Lane |
|---|---|---|---|
| G349 ratchets | Standing debt rule deleted and the approval sweeper stopped (02:25Z). Every debt count is shrink-only; a rise needs a plan row naming the deletion that pays it back; the coordinator never approves its own rises | No rise lands without a pay-back row | all lanes |
| G350-DW / -PH / -NA / -SD / -FR / -ND | **Exit row per shard** (Driftwood, Pine, Nalati, Signal, Sky, Nine): physics, spots and near bakes read authored collider / placement rows only (G320), no runtime code in Node | Clean-room rebuild with runtime + legacy deleted reproduces the bakes; that shard's runtime may then be deleted | open (before any SF73 deletion) |
| SF81–SF85 reopened | Directors, brains, movers, modes, weapons stay open until the shard runtime they replace is deleted in the same series (net-negative shard `runtime/` diff) | Platform row + runtime deletion landed together | sprint lanes |
| SF80 `bake(scene, identity)` | Build the design's central call: generator → real three.js `Scene` → `bake()` → tiles + `scene.json`; push Signal's port through it | **Signal done = tiles + 0 private binaries** (not only a line count) | next Opus lane |
| Signal ground on the data client | Presentation-only hybrid mode landed (`d32a32f35`). Switch, after `terrain.bin` (sp-o63), in one commit: `shard.config.ts` drops `terrain` from `runtime.binds`, adds `state` + host field `shared.dusk`, declares `look` (pbr family, `SAND_LOOK.entry`, `SAND_DUSK` curves; terrain family = material id); sand maps `sd:grain/trail/shadow` as KTX2 shardfile files (check wrap/filter vs `loadBakedMaps`); fire pools via `material(id)` uniforms or a row; runtime calls `runtimePresentation(source)` after the world stage (ground, material, skirt, `bindState`); then delete `TintedTileGround`, `duskSand`/`updateGround`. Settle: tiles under the data client root, shadows (Signal had both off), fine ring 5 m vs 8 m; entered-region fallback (no data client) | Signal look parity identical; recapture; road leg | next free Opus |
| Template parity baseline | 4 days stale: program keys, one texture, texture bytes red on HEAD before `d32a32f35` too | Re-baseline with each difference named (review item 10) | next free |
