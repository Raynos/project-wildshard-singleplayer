# 04 · The WorldClaw build techniques

The **how** behind the flow in [06](06-shard-flow.md). This doc defines nothing on its own:
- **06** owns the order, the gates, the contracts (§10: paths, the stage-entry table, invalidation, ladders, the slop
  score, image engines) and who decides;
- the **plan** ([WORLDCLAW-SHARD](../../plans/WORLDCLAW-SHARD.md)) owns the rows and the ledger (D1–D56, R1–R33).

This doc explains each technique those reference. If anything here ever disagrees with them, they win. Paths target
the normalized engine (`src/shards/<slug>/…`) and are re-grounded by row N0.

Rewritten after council round 2 (R2-A1, A2, A4, B1, C18): round 1's fixes had reached the plan and 06 but not this doc.

## 0. What we keep from WorldClaw, and what we add

**Kept** (01-paper):
- the schema-first plan, the user's words apart from the system's choices;
- the layout map → Eq. 6 height field;
- prototypes + masked samplers for scatter;
- paint-then-lift with a recorded camera;
- ray placement with a contact fix;
- check-function loops with budgets;
- re-render after every edit;
- explicit, editable, instanced assets.

**Added**, because a shard is a fun level on a phone:
- the design first (`design.md`: places with beats, content with the world, D37);
- the shard contract as hard constraints;
- the model contract (models, Sets, World as data, D17);
- phone budgets per pose;
- judging in the real game at iPhone portrait, by strips along the routes;
- the shard's own look with a style bible.

## 1. Files

All paths: [06 §10.1](06-shard-flow.md#101-paths). Nothing lives under `src/chunks/` after normalization.

## 2. The design (`design.md`, P2 / P5)

`design.md` is the human twin (R15). Write it in this order:
1. fantasy and three pillars (moment, session, return as a note);
2. the verb (existing in `#engine` / `#kit`, a toy moved from another shard + N days, or new + N days);
3. the weapon;
4. the enemy roster;
5. the boss and the antagonist;
6. **8–12 places**, each with a role (06 §3.2's list; required: spawn, hub, landmark, arena, boss, secret, vista,
   traversal), its beat, radius and ground, seen-from, its content (enemy zones, NPCs, quest anchors, loot) and its
   `catalogMode` (`kit`, `generated`, `mixed`);
7. 2–4 happenings with their signals and `seenFrom`;
8. the critical path as a gated loop with walk times at 5 m/s;
9. routes as typed legs (walk, swim, ride, zipline, glide, grapple; R25);
10. sightlines (a landmark from spawn; the boss site seen early);
11. pacing (open and tight alternate; no enemy zone within 40 m of spawn);
12. 1–3 secrets with hints;
13. the session slice (10–15 min, its route and its payoff);
14. §run (R23);
15. the verdict log;
16. the machine block.

## 3. The spec (`spec.json`, the machine twin)

```jsonc
{
  "slug": "…", "seed": 0, "intent": { "explicit": ["…Jake's words…"] },
  "heightRange": [-10, 40],                         // from the shard's extent (E1)
  "regions": [ { "id": "ice", "color": "#d8ecf4", "walkable": true,
                 "terrain": { "base": 0.5, "noise": [{ "type": "fbm", "freq": 0.02, "amp": 1.2, "oct": 4 }],
                              "ops": [{ "op": "terrace", "step": 3, "sharp": 0.6 }], "edgeRamp": 30 },
                 "ground": "snow" } ],
  "places": [ { "id": "hub", "role": "hub", "x": -40, "z": 110, "r": 40, "region": "village", "catalogMode": "kit",
                "beats": ["…"], "content": { "npcs": [], "enemyZones": [], "questAnchors": [] },
                "cam": "design/cams/hub.json" } ],
  "routes": [ { "id": "main", "legs": [ { "mode": "walk", "pts": [[0,250],[0,215]] } ] } ],
  "happenings": [ { "id": "…", "spot": [0,0], "r": 20, "trigger": "arrival", "objective": "race",
                    "signal": "<slug>/smoke-column", "seenFrom": ["main"] } ],
  "scatter": [ { "model": "<slug>/ice-boulder", "region": "ice", "sampler": "poisson", "minDist": 6,
                 "maxDensity": 0.004, "slope": [0, 30], "exclude": ["routes", "pads", "clearZones", "sets"], "margin": 2 } ],
  "water": [ { "kind": "pond", "x": 0, "z": 0, "r": 40 } ],
  "budgets": { "gate": "derived-or-D9", "texture": { "hero": 1024, "building": 1024, "prop": 512, "scatter": 1024 } }
}
```

spec-check's rules: 06 §10.2. The twin rule: R15.

## 4. The layout map (P5; T2, T3)

1. **The schematic** (exact, code): the square, the four entry roads, places as labelled circles at their spec
   coordinates, routes, sightlines, happening spots. The places are placed by the agent; it iterates until the loop,
   the gates and the sightlines read in plan.
2. **The painted map** (codex, organic): codex **edits the schematic** into flat colours with the exact palette, no
   text, the places and roads kept. 3 variants in parallel (~110 s each, plan §10 PA).
3. **The gate** (T3): places-in-region 100 %, every route on walkable ground, the roads untouched.
   - Palette fidelity below 94 % is a warning only (anti-aliased edges measured 94.9–97.9 %).
   - If all three maps fail, stamp each place's region disc (radius + 10 m) from the schematic over the best variant,
     and log it.
4. **The bake** quantises to the palette, merges specks under ~600 m² into their neighbour, and blurs each category
   into soft weights (σ ≈ 6 m). It writes the region weights as world data. **Freshness is the normalized bake's
   output-byte comparison**: a changed region cell or pad makes `--check` name the stale output. There is no source
   hash.

## 5. Terrain and water (P8; T4, T5)

Eq. 6 over the region weights, within `heightRange`:

```
H(x,z) = Σ_r w_r(x,z) · ramp_r(x,z) · [ base_r + Σ_k amp_k · N_k(x,z) + Σ_j α_j · G_j(x,z) ]
N: fbm · ridged · billow · voronoi(F1/F2) · warped        G: peak · crater · ridge · dune · terrace · mesa · basin · carve
```

- `ramp_r` (plan §10 PB1) brings a high-base region in by **distance to its edge** (`edgeRamp`, 20–40 m), so a small
  rock blob in a snowfield rises a few metres, not 70.
- **Shaping, in order:**
  1. the graded routes, **one `maxGrade` 0.5** for all, with benches across slopes (R31);
  2. water bodies (`WaterBody` rows);
  3. **place pads** (R5): ≤ 15° inside the place's radius. The cut / fill is ≤ 4 m (PB1's worst places needed this).
     Beyond that, raise the place's region `edgeRamp`; while P8 is open, move the place inside its region by ≤ 20 m
     (logged); else 06 §10.4's rung 3. From P9 on a place moves only by Jake's note (06 §10.3);
  4. object pads later, at P12 (R5's ≤ 1.5 m rule);
  5. the entry roads.

  A pad never overlaps a route corridor; where it must, it takes the route's shelf height.
- **Hard gates:**
  - every place ≥ 80 % under 30°;
  - **walk legs** (T5 writes them from the routes' `walk` legs; an empty set is an error) at 0 stuck;
  - every non-walk leg's mechanical test passes (the kit zipline, E9; other modes by their verb's test);
  - reach = the baked navmesh + those tested links, for every place, slot and happening;
  - sightlines clear.

## 6. The look (P3 front, P10 build)

- **The front (P3):** three directions on the pitch's key views, the judges' buildability screen, Jake's pick, then
  the style bible. The bible includes the **kit look** (E6) and the model post recipe.
- **The build (P10):** the bible as shard data. LOOK-LOOP (`docs/design/LOOK-LOOP.md`) against the **P9b targets** on
  every seen band, the close band first (D60), with two domes per hero view and a 12-frame orbit strip. The judges are its owner (R29). Done at
  worst ΔE00 ≤ 6, or after 3 rounds (a soft gap).

## 7. The catalog (P11; mockup-to-model §2–§7 per model, without its "ask Jake" steps, R29)

1. **The anchors first** (the bible's 2–3 models).
2. **Per place by `catalogMode`** (D18):
   - kit: code / Blender pieces with variants, instanced, in the bible's materials;
   - generated: codex references (alone on white, three-quarter view, in the bible) → TRELLIS **and** Hunyuan3D-2
     turbo → the better take → the post recipe. Hunyuan3D-2 turbo measured ~23 s per object after a 30 s load,
     40k faces (plan §10 PC4).
3. **Scatter** by `scripts/worldclaw/scatter-sources.json` (X1).
4. **CODE** for everything a player walks on, climbs or fights around (D19), and for **every walk-inside building, shell
   and interior** (R26).
5. **Reuse before you generate.**
6. Post to LOD0 + `.phone` + `-lod1`. Triangle targets by size class: hero 8–20 k, building 4–10 k, prop 0.5–3 k,
   scatter 0.2–1.5 k. Texture caps (R28): hero / building 1K, prop 512, scatter a 1K shared atlas. KTX2.
7. **The style check** (T12, D48) against the bible's anchors, with its ladder (06 §10.4: an asset that can't pass is
   **not placed**). Then T7 emits the `defineModel` with provenance (E3).

## 8. Places: paint it, lift it, check it (P12)

For each place in critical-path order, and for each **route leg** at its crests and turns, on **every seen band, the close band first** (R11, D60; in `worldclaw-interactive`, a checkpoint board per place,
D63):
1. **Frame.** T6 captures the player view at the place's planned camera, or the leg's camera (T5), at eye height on
   the route or vista (R27): `design/cams/<place>.json` or `design/cams/leg-<id>.json`, with position, yaw, pitch,
   vertical FOV and aspect.
2. **Compose.** Codex edits the capture with **the P9b target as the second input**: dressing + buildings (D19),
   clear zones kept (arena rings, routes, happening spots, traversal approach cones). Make 2 variants; the judges pick
   (R6).
3. **List.** `design/objects/<place>.json`: per object, label, bbox, **ground-contact pixel**, facing, size class, `on`
   (`terrain` or a Set member id), and its reuse id or "new".
4. **New objects** are re-drawn by codex **isolated on white, the same view**, with the crop and the whole composition
   as inputs (R2; §10 PC3), then catalogued (§7).
5. **Place** (T8, R3):
   - **position:** a ray from the recorded camera through the contact pixel, through the physics query layer (the
     first registered collider it hits, then the baked terrain sampler);
   - no hit, an obscured contact, or a support other than `on` → the object is flagged, never dropped onto the ground
     below;
   - **size from the size class.** The implied size from the bbox is only a check: more than 30 % off is flagged
     (§10 PC2 measured ±20–30 %);
   - **yaw** from the facing target, then a render check at ±15°.
6. **Write** the placements, the Set and its `target` (E4) and the **object pads** (R5: ≤ 1.5 m and off routes, else
   move along the ray to the nearest ≤ 15° spot) into the world data (E2).
7. **Check** (T9):
   - footprint spread ≤ 0.3 m after pads;
   - overlap ≤ 5 % unless declared;
   - the scale table;
   - colliders;
   - clear zones;
   - **traversal approach and activation views** (R25);
   - signals seen from `seenFrom`;
   - scatter against its exclusions;
   - sketch pieces replaced by final code models of the same footprint and colliders (a required slot's logged
     rung-5 stand-in is exempt);
   - the D25 musts.

   Then the bakes, the walk legs and reach.
8. **Compare** target vs built at the same camera, with two domes. The judges list must-fixes (≤ 3 rounds a place;
   then 06 §10.4's ladder).

## 9. The judges

R6 and 06 §6: who sits, what they read (strips and numbers, never video), the merge, the pass mark, ties, J3, the
rubrics (pitch, direction, concept, map, mockup / target, level L1–L9, look and slop).

## 10. Budgets (P14)

- **The gate** (R28) is the stricter of D9 (≤ 2.0 M triangles, ≤ 150 draws per pose) and the normalized derived
  budget, plus GPU MB.
- **Measured** by T10 at every place's 9 cameras and every 10 m of every route.
- **The levers**, in order, which are also the budget gate's fallback (06 §10.4), ≤ 4 rounds:
  1. instance;
  2. per-copy cull;
  3. LOD distance;
  4. phone copies;
  5. merge small props per cell;
  6. density;
  7. a lighter hero.

  Never render scale, never facade multi-draw.
- A Simulator reading is a **pre-check**. The memory gate closes on Jake's physical iPhone (Done-when 1; the method in
  06 §7).

## 11. Content with the world (P8 grey, P13 final)

- **Grey (P8)**, on the sketch kit's stand-ins (E8a):
  - enemies and elites as rows with brains and strikes under the fight rules;
  - the boss with its phases;
  - quest steps as data;
  - happenings.
- **Happenings (E7, R12):**
  - the world data holds the spot, radius and signal placement (`level.world`);
  - `rows.happening` holds the trigger, objective, timer, outcomes and reward, and is registered at `level.kit`,
    keyed by the spot's id;
  - activation binds them at `level.play`;
  - fights go to `EncounterService.spawn` / `elite`.
- **The boss "beaten headless"** (T16, R2-B13 / C15), when the run scope holds the boss (06 §4.1): with `bossGod` on, the runner sends the player's **real strike
  inputs** aimed at the boss. Every phase transition is logged, defeat fires the quest step and the reward, all within
  8 min. A debug kill doesn't count.
- **Final (P13):**
  - creature, NPC and boss models (mockup-to-model, rigs);
  - the weapon's final model and moves;
  - arena and happening dressing and signals;
  - quest props;
  - **the score (MiniMax Music 3), ambience, SFX (MOSS + Stable Audio 3, the better take, `sfx_merge.py`), the in-game
    credits**;
  - the card art.

## 12. Loops and caps

All in 06 §10.3 (answers and caps) and §10.4 (hard gates, soft gaps, ladders). A capped **hard** failure is never
marked done.

## 13. The tools (`scripts/worldclaw/`, plan rows T1–T18, E9)

| Tool | Row |
|---|---|
| `design.md` template, `spec.schema.json`, `spec-check.mjs`, `twin-check.mjs` | T1 |
| `schematic.mjs`, the illustrated map's label compositor | T2 |
| `mask.mjs` (score, stamp, bake) | T3 |
| `terrain-ops.ts` (Eq. 6 + edge ramps) | T4 |
| `reach.mjs` (reach, sightlines, polish bands, walk legs) | T5 |
| `capture.mjs` (player views, Explorer views, `cam.json`, strips) | T6 |
| `emit-models.mjs` | T7 |
| `place-solve.mjs` | T8 |
| `check.mjs` | T9 |
| `budget.mjs` | T10 |
| `board.mjs` (boards ≤ 4, clips, strips) | T11 |
| `judge/` (J1–J3 briefs, the J2 runner, merge, rubrics, style check) | T12 |
| `record.mjs` (frames, milestone clips, the daily summary, the time-lapse) | T13 |
| visdev runners (`run_codex.py --max-parallel`, Qwen with a neutral ref, grids) | T14 |
| the live page (Artifact, `db` + `assets`) | T15 |
| `slice-run.mjs` (the slice, the golden path, the boss) | T16 |
| `grey-build.mjs` (spec → a grey world in the sketch kit) | T17 |
| `zero-shot.sh` (the zero-shot launcher and relaunch loop) | T18 |
| `leg-test.mjs` (the non-walk leg contract's runner) | E9 |

The prototypes (tag `worldclaw-archive`, `prototypes/worldclaw/`; their images in `art/worldclaw/round-1-prototypes/`) are the references: `schematic.py`, `terrain_vis.py`, `place_solve.py`
(plan §10 cites the commit).

## 14. Cost

Plan §5 (the estimate) and 06 §10.6 (images per kind).

## 15. Failure modes we expect

| Failure | Answer |
|---|---|
| Codex paints a map that moves the places | the schematic is the reference; T3 rejects it; three fail → stamp the discs |
| Pretty terrain that isn't walkable | §5's gates: walk legs, reach, slope map; graded routes; pads |
| A composition puts a house on a 35° slope | the object pad (≤ 1.5 m) or a move along the ray; T9 |
| A generated building faces the wrong way | yaw from the facing target + a render check |
| Image-to-3D gives holes or a bad base | the review; the other engine; then a code model (the style ladder) |
| A walk-inside building | CODE whole (R26) |
| Over budget at the hub | §10's levers in order |
| The style doesn't survive image-to-3D | the buildability screen at P3; the post recipe in the bible; the style check |
| Codex quota out mid-run | Qwen for explorations only; the run records the reset time and stops (R23) |
| The model lock is held for long | queued batches; the main agent waits in the background |
| Repetition reads as generated | scatter variants + tint jitter; the judges' repetition defect |
| It looks like a diorama | the design's routes, pacing and sightlines; the slice gate; judged by playing |
