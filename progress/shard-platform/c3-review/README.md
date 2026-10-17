# C3 effects, ambient life, water, AS: close review (G466, G454 host bar)

R3, short Opus review lane of SHARD-PLATFORM, 2026-10-16, at `3d26e4535`
(no reviewed file changed between it and `28658ef98`). Read-only: no code
changed. The owner reported **Pine 104 / DW 0** C3 lines at `c280fbe49`
(`c3-building-channels-2026-10-17/`); `3d26e4535` returned the door hinge to
Pine, which moved 5 door lines from C3 to C7.

**Verdict: C3 NOT CLOSED.** DW is 0 on the ruler, and 80 of Pine's 99
tagged lines are view code (listed below). Three things keep C3 open:

- 19 tagged lines in `buildingLife.ts` are door state or audio loans, not
  drawing.
- Three hosts C3 relies on fail G454: the flock's scavenge/visit modes,
  `SiteLights`' `lit` callbacks, and the weather install/subclass.
- Three more hosts pass every test except "tested": the flock, the forager
  and the water surface have no host test at HEAD.

The ruler's C3 tag also leaves out most of C3's own scope. Pine's
ambient-life orchestration (`runtime/life/ambientLife.ts`, 256 lines, owner
unknown) is counted under C9.

## Ruler at HEAD

Source-basis inventory (`sourceProgressInventory`, the G458 law the other
lanes use) in the build mirror:
`node scripts/build-mirror.mjs run 3d26e4535 --slot check -- node <inv.mjs>`.
It ran without built products, so section-host imports were not counted
(the same basis as sp-x4's receipt).

| Shard | C1 | C2 | **C3** | C4 | C5 | C6 | C7 | C8 | C9 | unknown owners |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Pine | 3,400 | 1,180 | **99** | 2,709 | 1,763 | 1,025 | 26 | 72 | 1,805 | 57 |
| Driftwood | 2,693 | 859 | **0** | 1,159 | 983 | 749 | 0 | 25 | 1,031 | 45 |

Pine C3 per file: `runtime/combat/fxKit.ts` 36, `runtime/props/buildingLife.ts`
62, `runtime/props/bakedBuilding.ts` 1. `componentWave` can't call any
component closed while either shard has unknown owners.

## 1. The 99 Pine C3 lines

### Accepted: listed view code (80 lines)

| File | Lines | What it draws |
|---|---|---|
| `runtime/combat/fxKit.ts` | 1-2, 12, 15, 17, 19-29, 31-38, 40-51 (36) | `Puffs`: a pool of shimmer-sphere meshes on `fxMaterial(FX.dome)`. Each burst's scale and `uAlpha` / `uTime` uniforms swell and fade. Callers: elites, `nightThralls`, `stagLead`, `antlerKing`. Nothing reads its state. |
| `runtime/props/bakedBuilding.ts` | 4 (1) | `instancedQuad` import (`sdk/looks/cardField`), a geometry helper. |
| `runtime/props/buildingLife.ts` | 1, 5, 25, 29, 32, 36-38, 40-41, 43, 46, 48-49, 52-53, 56, 58, 64, 67-70, 97-99, 101-109, 120, 122, 124, 128, 132, 134, 136-137 (43) | The `SiteLights` look row and owner, fire/lamp gains by night, lamp-glass `emissiveIntensity`, seeded lantern swings (pivot rotation), mill-wheel spin, and the `_fire` / `_lamp` / `_swing` / `_wheel` / `addSite` / `addSharedLight` / `addLampSite` registrations. |

### Rejected: tagged C3, but not view code (19 lines)

| Lines (`buildingLife.ts`) | By function | Why |
|---|---|---|
| 3, 4, 17-18, 20, 22-23, 34, 50, 77, 85 (11) | C7 door sim | The `BuildingDoor` state interface (open / t / collider / interactable / slab / use), the door look's seconds and angle, the prompt list, door colliders, and the door look read in `stepDoors`. They're tagged C3 only because interface and `look` declarations fall back to the file owner. They go with the C7 door fix (C7 review, fix 2). |
| 2, 27, 51, 60, 65, 81, 126, 130 (8) | C8 audio loans | Floor rectangles and `floorHeightAt` (only `engine/audio` surface and ambience read them), fire-pit positions, and the door-sound listener set. These are audio presentation, not drawing. |

Ruler mis-tags (non-blocking): the `item` / `swings` name regexes put
`fxKit.ts:16,39` and `buildingLife.ts:59` in C6.

## 2. Hosts against the G454 bar

Tests: (a) a real second user, (b) no shard callbacks across the host, (c)
documented in source and ENGINE.md, (d) tested, (e) both users in shipped
code.

| Host | a | b | c | d | e | Verdict |
|---|---|---|---|---|---|---|
| H6 `AmbientFlock` core (perch / wheel / guide), `engine/ai` + `sdk/looks/ambientFlock` | yes (DW gulls + reef school, Pine guide ravens) | yes¹ | yes (ENGINE.md flock section) | **no** | yes | **FAIL (untested)** |
| H6 flock `scavenge` + `visit` sections | **no** (Pine ravens, owl, woodpecker only) | yes¹ | yes | **no** | no | **FAIL** |
| H6 `ForagerPopulation` (`engine/ai/ambientForager`) | yes (Pine hares, Nalati marmots, `28ff6629a`) | yes¹ | yes (ENGINE.md forager section) | **no** (Nalati headless only, indirect) | yes | **FAIL (untested)** |
| H4 `installChannelPrograms` | yes (Pine weather + rain, Nalati weather, `graphDaySky` for DW + Pine) | yes | yes (ENGINE.md channel-programs section) | yes (`test/channel-programs.test.ts`, `rain-fall`) | yes | **PASS** |
| H7 `WaterSurface` (`sdk/looks/waterSurface`) | yes (DW ocean, Pine creek / falls / pools) | yes | yes (ENGINE.md water-surface section) | **no** (host untested; `pine-water-owner` tests Pine's dresser) | yes | **FAIL (untested)**² |
| Weather continuation (`engine/world/weatherContinuation`) | yes (Pine page, Nalati `SteppeStorm`) | **no**: `SteppeStorm` overrides `update`, `entered`, `afterForce`, `outputs` (`nalati/world/Weather.ts:177-195`) | yes (ENGINE.md weather-continuation section) | yes (`weather-continuation.test.ts`) | yes | **FAIL** |
| `installWeatherContinuation` (`game/plugin/weather.ts`) | **no**: Pine headless only; the ruler charges it to Pine as a sole module (14 lines) | yes | partial | yes (indirect) | no | **FAIL** |
| `SiteLights` (`engine/fx/SiteLights`) | yes (Pine buildings, Sunscar waymarks) | **no**: `lit: () => boolean` on `addLamp` / `LightSite` (Pine `runtime/world/landmarks.ts:178`, Sunscar `world/build.ts:101`) | thin (one ENGINE.md table row) | **no** | yes | **FAIL** |
| `fxMaterial` / `FX` (`engine/fx/groundFx`) | yes (Pine `fxKit`, Nalati, game `Elite`) | yes | yes | n/a (material factory) | yes | **PASS** |
| `cardField.instancedQuad` | yes (Pine, Sunscar, Far Reach) | yes | yes | n/a | yes | **PASS** |

¹ The port objects (`AmbientFlockPlayer`, Pine's `reader` in
`ambientLife.ts`) use getters, so `toward` runs `guide.target()` inside the
host. This isn't blocking; a plain per-frame value would be cleaner.
² The DW-only parts of H7 are `waterSurfaceLook` (5 lines, charged to DW)
and the floor / foam / dry draw options. `engine/world/water/body.ts#swellBody`
(8 lines) is DW-only, and `engine/world/water/ripples.ts` (102 lines) is
Pine-only.

The flock, forager and water tests went with `819a36b8d` (G416 deleted the
fragile port proofs). G454 still asks for a host test.

## 3. C3 by function, tagged elsewhere (honest total, not the gate)

- Pine `runtime/life/ambientLife.ts`: 256 counted lines, 217 of them C9
  (unknown owner). It holds:
  - carcass scheduling and scavenge `gather` / `release`;
  - the place guide;
  - the hare roam;
  - the skinning beat (camera kick, weapon holster: C6 by function).

  `data/ambientLife.ts` adds 31 lines of hand-written rows (unknown owner).
- Pine `world/weather.ts` (133 lines, C1 / C2) builds its own
  `WeatherContinuation` on the page, separate from the headless install. It
  also answers `projectile.modify` (wet flight) and `creature.wander-goal`
  (herd shelter), which is sim in a view file. `runtime/looks/rainFx.ts` (195)
  and `world/water.ts` (40) are view code.
- DW `world/Ocean.ts` 32, `world/Seabed.ts` 24, `runtime/world/Gulls.ts` 9,
  `runtime/world/Waterfall.ts` 22, `runtime/looks/smokeColumn.ts` 18: view
  bindings on hosts (C1 / C2 tags). DW has no C3 logic.
- AS (report-only, outside the TS numerator): Pine 7 scripts (311 physical
  lines), DW 1 (41).

## Fix list (C3 closes when these land and the ruler re-checks)

1. **buildingLife door lines out of C3** (Codex, sim): they leave with the C7
   door fix. Until then, tag the `BuildingDoor` interface and the `door`
   look C7 in `scripts/shard-components.mjs`.
2. **Audio loans out of buildingLife** (Codex): emit the floor rectangles and
   fire pits as rows that `declaredAmbience` already reads (`floorRows`), or
   re-tag them C8. Delete `floorHeightAt`, `_floor`, `_firePit` and
   `audioState.floors` / `firePits`.
3. **Flock scavenge / visit** (Codex): give them a second shipped user, or
   return both sections to Pine as counted custom code (G454 (3)). Pine's
   carcass / scavenge orchestration in `ambientLife.ts` moves onto the
   scavenge row if the section stays in the host.
4. **SiteLights state, not callbacks** (Codex): replace `lit: () => boolean`
   with a declared state box or channel port (Pine landmarks, the
   `bakedBuilding` sites, Sunscar braziers). Add a host test and a short
   ENGINE.md section.
5. **Weather host** (Codex):
   - Give Nalati's headless `installWeatherContinuation`, or fold it into
     Pine.
   - Make Pine's page use the installed continuation, not a second
     `new WeatherContinuation` (`world/weather.ts:91`).
   - Turn `SteppeStorm`'s four overrides into program rows or phase events
     the host emits.
6. **Host tests** (Codex): one small row-driven test each for `AmbientFlock`
   (both shards' rows), `ForagerPopulation` (hares + marmots) and
   `WaterSurface` (DW floor / dry + Pine plain draw).
7. **Single-user water pieces** (Opus, visual): Pine adopts
   `waterSurfaceLook` (`world/water.ts:31`), and `ripples.ts` gets a second
   user or moves into Pine as listed view code. `swellBody` gets the same
   treatment for DW.
8. **Ambient-life ownership** (Codex): attribute `runtime/life/ambientLife.ts`
   and `data/ambientLife.ts` (C3; harvest beat C6). Emit the rows from a
   generator, not hand-written `data/*.ts`. Move the weather file's wet-flight
   and herd-shelter answers out of the view file. Fix the `item` / `swings`
   mis-tags.

## Codex follow-up (G469)

Source landings: `95804fe8b` (SiteLights), `dcdfb32da` (rows,
ownership and host tests), `d90d079f3` (private visitor state).

- **2:** `world/ambience.json` emits floor rectangles and fire-pit
  positions from the existing cabin records, in cabin-then-hamlet order.
  `BuildingLife` no longer owns floor/fire lists, registration callbacks
  or `floorHeightAt`. Audio consumes `floorRows`; rain cover and the rifle
  pickup use the same declared rectangles through `floorAtRects`.
- **3:** scavenge/visit simulation and its private bird, player and
  weighted-perch state belong to Pine's counted
  `runtime/life/visitors.ts`. The shared flock retains perch/wheel/guide
  and refuses the private modes. No second-user claim is made for them.
- **4:** Pine and Sunscar publish plain `SiteLightState` boxes before
  the light pool steps. The host invokes no ignition callback. Its test
  covers both light rows, room priority and extinguishing unused slots;
  ENGINE.md documents the port.
- **6:** `ambient-flock-host`, `ambient-forager-host` and
  `water-surface-host` test both shipped users' rows. The forager test
  uses the real terrain override port, without module mocks. The water
  test exercises Driftwood floor/foam/dry draws and Pine's plain draws.
- **8, partial:** ambient orchestration is attributed to C3, harvest to
  C6, and the door sound listener to C8; `items`/`swings` no longer cause
  the three C6 mis-tags. The ambient rows were already under
  `generators/ambientLife.ts` when this lane started. Weather remains
  counted custom, including its page answers.

**Still NOT CLOSED.** G469 rejected new phase-event callbacks and moving
the page answers into another runtime module. Item 5 and the weather
part of item 8 remain open: Nalati still subclasses the continuation;
Pine's page still constructs a separate continuation. Items 1 and 7
remain with their other owners. This correction claims no net cut and
deletes no whole runtime file; it returns previously shared modes to
the custom numerator.

Focused checks passed: six host/audio tests, plus a temporary comparison
of every bird and voice across 12,000 frames of the original and returned
Pine modes. No visual tuning changed. The exact SiteLights commit passed
root/layer types, typed lint, all ten products and all 17 headless cases.

Exact `dcdfb32da` and `d90d079f3` mirror checks also passed root/layer
types, typed lint, all ten products and 26 selected tests (including all
17 headless cases). Source-basis inventories used an absent products
directory consistently, excluding section-host imports from both sides:

| Shard | Before (`45f8647d1`) | After (`d90d079f3`) | Net custom | C3 before → after |
|---|---:|---:|---:|---:|
| Pine | 11,618 | 11,930 | **+312** | 99 → 730 |
| Driftwood | 7,094 | 7,094 | **0** | 0 → 0 |

The increase returns private modes to Pine; attribution also exposes the
weather and orchestration already present. No whole runtime file was
deleted. The three code commits are ancestors of `origin/main`.
