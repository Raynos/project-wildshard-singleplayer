# Debug rows burn-down: mini plan (G669)

**State:** `done` 2026-10-26 (G742 reconciliation, sp-x9). Reconciled in `72a1482c68`. All DR1–DR19 already landed and are verified ancestors of `origin/main`; the former 0/19 count was stale. This reconciliation changes no runtime code or look. Their defining commits total **1,361 net lines and 102,100 bytes removed under `src/`** (Git parent-to-commit deltas, not bundle or memory measurements).

DR19's retained portrait Simulator recordings cover staging, no reload, undo and reachable Apply. A fresh six-suite UI check collected zero because Far Reach/Nine generated discovery was absent after a peer's refused generation. That prerequisite refusal is retained, not a new UI failure or a passing current witness. The owning lane is restoring discovery; no duplicate build or capture was started.

Jake, 2026-10-23 ~10:05 Cancun: *"What's the default state? … are these all improvements that we need to be on and we
should just default them on? … default on whatever should be on, like whatever setting is the best setting. Even if that
setting is buggy, we'll just fix it forward. I really want to get rid of these debug rows because it's just a fucking
mess. I want to get rid of as many as possible. I just want to have one setting."* And: *"if we have a bunch of
improvements waiting behind the debug row toggle … I want all the improvements."*

**G669:** each row's best option becomes the only behaviour. The row, its losing options, their strings and their dead
code go in the same commit (E451). "Best" means the measured or intended improvement, even if it still has bugs; those
get fixed forward. This overrides AGENTS.md's "risky render change stays default-off until a device reading" for these
rows. A row survives only if it is a look A/B Jake hasn't judged yet, or a pure diagnostic tool.

## Original audit (2026-10-23, c145edf02a)

27 rows in total. 19 are engine rows (`src/engine/ui/debugOptions.ts`) and 4 are game-wide rows (measure clay, Pine
score, legacy buttons, template). 4 are legacy-shard rows: 3 can be reached through Developer ▸ Legacy shard buttons,
and Signal's legacy one can't be reached at all. 7 rows are public, so everyone sees them in Settings ▸ Debug. 20 are
Developer-only.

The shardfile route for declared Debug rows (`plumbing.json` → `debug: []`) is empty on every shard. Some dead code
already sits around the rows: `DEBUG_READOUTS.tex` reads out a row that was deleted with the GPU textures row (G386),
and `prepareHybridShard`'s `debug` parameter has no caller.

**Verdicts: 14 SHIP · 11 DELETE · 2 KEEP in a Developer section** (G672 deleted three survivors; G673 keeps Clear downloads and Legacy shard buttons). About 1,200 lines go, plus the survivors' code.

| Row id | Label | Default today | Verdict | Ships | Evidence | Risk | Lines |
|---|---|---|---|---|---|---|---|
| `graphUniforms` (dev) | Graph material uniforms | plain | SHIP | plain | Nine Sim frame 25–32 → 17 ms, p95 34 (ea0ab7baa9); default for 3 days | low | ~390 |
| `bootShaders` (dev) | Shaders before play | drawn | SHIP | first frame only | Shaders 4111 → 3366 ms, tap→play 14.1 → 13.5 s (e4b4e1a847) | low | ~20 |
| `nodeReuse` (dev) | Shared shader builds | on | SHIP | on | node builds −19 %, 0 verify differences (ae8ed1fd6a); 00:14 leak fix 3f972ab731. **Signal suspect** | med | ~45 |
| `programShare` (dev) | Shared shader programs | off | SHIP | on | fewer GL links at cell entry (c862a20fa4); never measured on; falls back with a warning | med | ~20 |
| `fixedShadowSamples` | Fixed shadow samples | off | SHIP | on | DW graph CPU 1.60 → 1.21 ms/frame, DW pixels equal, Pine horizon max 23 (a88e5e4159) | low | ~15 |
| `buildPacing` (dev) | Build pacing in play | on | SHIP | on | Sky quiet floors (9ba34b4bbe); `entry` ABBA no gain (2267c30660); `uploads` = `on` on WebKit; `links` never proven | low | ~180 |
| `staticMatrices` (dev) | Static piece matrices | off | SHIP | on | ~2.6 ms of a Nalati frame (7de6a6a4d7); on the coordinator's phone list | med | ~25 |
| `staticSets` (dev) | Merged static pieces | off | SHIP | on | Nalati 46 of ~117 draws are dressing; same pixels (03f53f63df); not live yet | low | ~10 |
| `distantTrees` | Distant trees | per variant | SHIP | per species | ~20 fewer draws in Pine (27df8e3893); far trees of a species look alike | low | ~10 |
| `groundTiles` | Ground from tiles | off | SHIP | on | G652 D-S3 one ground path; off/on read the same, −48k tris, +35 draws aerial (015607cb12) | med | ~20 |
| `tileResidency` (dev) | Tile residency | whole | SHIP | 5 x 5 | tile plan D2 B (recommended); 5 x 5 walks 0 stuck (STATE) | high | ~30 |
| `graphMaterials` | Graph materials | off | SHIP | on | G387 graphs on without a device reading; Signal, Nine, Pine still draw presets. **Signal suspect** | high | ~40 |
| `pineMemoryTrim` (legacy Pine) | Pine memory trim | on in grid | SHIP | on | G180 / E450 Jake picked the trim | low | ~25 |
| `memorySaver` (dev) | Memory saver | off | SHIP (needs Jake's word) | on | cuts "change no look" (memorySaver.ts); reverses G271's "off, full quality" | med-high | ~60 |
| `fps` (dev, desktop) | Frame cap | auto | DELETE | auto | desktop only, never on Jake's phone; harness `?fps=` stays | low | ~10 |
| `budgetReadout` (dev) | Calibrated budgets | button | DELETE | — | no reader on device; the probe stays for scripts | low | ~12 |
| `storage` (dev) | Storage | readout | DELETE | readout moves under Clear downloads | one row fewer; plus the dead `tex` readout | low | ~20 |
| `measurePlain` | Dev map / Clay | dev map | DELETE | dev map | G527 approved the dev-map look; clay was the before | low | ~60 |
| `pineScore` (Pine) | Pine Hollow score | auto | DELETE | auto | an audition pin, no pick pending; the `debugPin` format field goes too | low | ~50 |
| `shardDirectors` (legacy) | Shard directors (data) | legacy | DELETE | legacy | review date 10-18 passed; Script path never shipped; legacy only | low | ~100 |
| `ai.brains` (legacy Pine) | AI brains | off | DELETE | off | legacy Pine is its only user; on LD7's legacy-only list | low | ~85 |
| `groundTiles` (legacy Signal) | Signal Dunes ground tiles | code-built | DELETE | — | can't be reached; goes with its folder in LD6 | none | (LD6) |
| `time` (dev) | Time of day | live | DELETE (G672) | — | diagnostic: holds the clock for look checks | — | — |
| `weather` (dev) | Weather | live | DELETE (G672) | — | diagnostic: holds a weather phase | — | — |
| `clearDownloads` (dev) | Clear downloads | button | KEEP, Developer section (G673) | — | Jake's cold-load tool (E172) | — | — |
| `legacyShardButtons` (dev) | Legacy shard buttons | off | KEEP, Developer section (G673) | — | G606: stays until deletion day | — | — |
| `game.template` (dev) | Template shard | button | DELETE (G672) | — | the only way into the hidden grey-box level | — | — |

## The Signal Dunes lighting regression (live ff45b6a24, 09:36)

Jake reported dark Model Explorer cards and a dark, washed-out world (`art/grid/round-54-explorer-dark/`). Four rows
could cause it:

- **`nodeReuse` is the first suspect.** It has been on by default since ae8ed1fd6a and is in live. A reused build keeps
  the first material's code and rebinds only its own uniform and update nodes. A model card renders in its own scene
  with its own lights, so it could pick up code or light bindings built for the world. That fits "every card a black
  silhouette".
- **`graphMaterials`.** Signal's client plan only draws its graph materials when this public row is on
  (`graphs: 'debug'`). If Jake's saved pick is on, he is the only one seeing those graphs on Signal, and DR12 would
  make that look universal.
- **`bootShaders`** (drawn-only, in live) compiles off-screen programs (cards, the Explorer) in play rather than at
  boot. It is less likely to leave things unlit.
- **`graphUniforms`** (plain, live since 10-20) caches render and frame uniforms once per camera pass. It's older, so
  it's unlikely to explain a new regression.

Jake runs with Developer on, so any Developer pick he once saved also applies to him. G669 still holds: these ship as
the only behaviour, and the fix goes forward. DR3 and DR12 each start by drawing Signal's Explorer once with their
row's old value. If that lights the cards, the fix lands in the same commit.

## Build rows

Each row is one small commit (or a few related rows). It deletes the row, the losing options, their strings, their
`OPTION_VALUES` / `OPTION_SPECS` / `DEVELOPER_OPTIONS` entries, the tests that only covered the losing path, and the
dead code. It also lowers `lint/ratchet.json` `debugRows` and refreshes `lint/ask-ids.json`.

**Done when:** the row is gone from Debug; types, lint and `vitest related` on the touched files pass; and the commit
subject names the shipped behaviour.

**Owner:** Opus for rows that change pixels or shader code, Codex for everything else.

Pure improvements with evidence come first:

| Row | What | Owner | Size |
|---|---|---|---|
| **DR1** | `graphUniforms` → plain only: delete `NodeUniformBuffers` (move the `BlockGroup` type into `nodePlainUniforms.ts`) and its test | Opus | S |
| **DR2** | `bootShaders` → first frame only: drop the `all` branches in `Game.ts` and `session/finish.ts` | Codex | XS |
| **DR3** | `nodeReuse` → on: drop the `off` / `verify` paths in `engineNodesHandler.ts` and their tests. First draw Signal's Explorer cards with reuse forced off; if they light, fix the rebind in this commit | Opus | S |
| **DR4** | `buildPacing` → on: delete `off`, `uploads`, `entry`, `links` (`Game.ts`, `precompile.ts` entry inventory and borrowed instances, `regionalRuntime.ts`, `hybrid.ts` parked entry, `SLICED_UPLOAD_BUDGET`, the framePacing off switch) and their test cases | Codex | M |
| **DR5** | `fixedShadowSamples` → on: `shadowDepthSample` always folds; drop the stock-texture branch and its test case | Opus | XS |
| **DR6** | `staticMatrices` → on: drop `off` and `verify`; keep the 30-step mover check and its console line | Codex | XS |
| **DR7** | `staticSets` → on: scene dressing always merges static siblings | Opus | XS |
| **DR8** | `programShare` → on (after DR3): the shared key always leads with the graph shape; drop the off-case tests | Opus | XS |
| **DR9** | `distantTrees` → per species: drop the per-variant far path | Opus | XS |
| **DR10** | `groundTiles` → on: painted and splat grounds draw from their tiles (`painterlyLook.ts`, `clientSplatTerrain.ts`); delete the whole-mesh draw branch. Tile plan D-S3 deletes the whole `Terrain.build` | Opus | S |
| **DR11** | `tileResidency` → 5 x 5 (colliders 3 x 3): delete `whole` and the 3 x 3 choice; `tileResidencyRadius()` becomes a constant | Codex | S |
| **DR12** | `graphMaterials` → on: every shard draws its declared graphs; delete the `graphs: 'required'` field (schema plus 7 declarations) and Signal's `graphs: 'debug'`. First draw Signal's Explorer with graphs on | Opus | S |
| **DR13** | Developer cleanup: delete `fps` (`?fps=` stays a harness read in `tier.ts`), `budgetReadout`, the `storage` row (its readout moves under Clear downloads) and the dead `tex` readout plus `memoryReadout` | Codex | S |
| **DR14** | `measurePlain` → dev map: delete `measurePlain.ts`, `setMeasurePlain`, the `plainVariant` field and its 3 data flags, and the strings | Opus | S |
| **DR15** | `pineScore` → auto: delete Pine's `debugPin`, the format field, `CatalogueScore.pin` and the row in `plugin/audio.ts`, plus the legacy Pine score row | Codex | S |
| **DR16** | Legacy rows: delete `shardDirectors` (`directorClient.ts` and the legacy Script branches in the DW finale, Pine clock and Nalati raid / crowd), `ai.brains` (`DebugOverlay.ts`), `pineMemoryTrim` → on, the now-unused `runtimeVariantEnabled`, and `prepareHybridShard`'s dead `debug` parameter. Signal's legacy row goes with LD6 | Codex | M |
| **DR17** | `memorySaver` → on (G674, Jake: on for everyone): drop the off path and the Developer fence. If he says keep it off, DR17 instead deletes `memorySaver.ts` and its ~16 call sites (~330 lines) | Opus | S |

## Survivors: the Developer section (G672, G673)

Jake, 2026-10-23 ~10:50 Cancun: *"Debug rows mini plan. That's big because it's just so much fucking code that's been off … Hidden template shard is being shown anyway, so like don't have a button for that. Get rid of that hidden template button. Clear downloads, legacy shard buttons, time of day and weather. Yeah, sure, whatever. Time of day and weather, get rid of those … Also, this setting page is really fucking annoying. It feels really slow. It feels really unresponsive. It does an instant reload when you toggle something that requires a reload instead of like allowing me to press the apply and reload button."*

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| **DR18** | Delete Template shard (the template already has its SHARD SELECT card), Time of day and Weather (captures hold the clock and weather through the harness), with their code, strings and tests. **Clear downloads and Legacy shard buttons stay** (G673, Jake: *"we do need a dev section with the ability to clear downloads and turn the legacy shard buttons on and off"*) in one Settings section named Developer, shown with Developer on; Clear downloads takes over the Storage readout | Codex | S | Settings shows only player settings plus the Developer section with exactly those two; types, lint, `vitest related` pass |
| **DR19** | **The Settings page applies on a button.** A toggle never reloads the page: changes that need a reload are staged and an "APPLY & RELOAD" button appears (with how many changes wait); taps answer on pointerup within one frame; nothing re-renders the whole page per tap. Check the slowness on the phone tier first (what runs per tap) and fix that cause | Codex (Opus if it's render-side) | S | a Simulator recording: a reload toggle shows APPLY & RELOAD and no reload; every tap answers within 100 ms |

DR1–DR19 are done. Settings keeps player settings plus a Developer section with Clear downloads and Legacy shard buttons. Capture-only Time/Weather APIs intentionally remain for harnesses and frozen legacy callers; their menu rows are gone.

### Defining landings (G742)

All SHAs below are on origin. Counts are net source-tree deletions in the named commit, including strings and source-colocated tests; this reconciliation adds no new source savings.

| Row | Status / defining SHA | Net src lines removed | Net src bytes removed |
|---|---|---:|---:|
| DR1 | done `30a6cde323` | 265 | 16,278 |
| DR2 | done `c391756c84` | 11 | 1,320 |
| DR3 | done `9cd55b1591` | 78 | 6,118 |
| DR4 | done `76918daa83` | 149 | 11,613 |
| DR5 | done `4181600771` | 4 | 699 |
| DR6 | done `4317319d11` | 10 | 1,668 |
| DR7 | done `229f8d3a62` | 7 | 1,001 |
| DR8 | done `c7a9b7b458` | 7 | 1,122 |
| DR9 | done `48eb955b6e` | 8 | 1,221 |
| DR10 | done `488ca90929` | 13 | 1,531 |
| DR11 | done `070d9d96f0` | 75 | 6,405 |
| DR12 | done `7a54a395be` | 17 | 2,353 |
| DR13 | done `e0fa9db838` | 31 | 3,082 |
| DR14 | done `db440b20c2` | 63 | 4,536 |
| DR15 | done `866572a3a6` | 129 | 6,905 |
| DR16 | done `85692a2df7` | 424 | 29,244 |
| DR17 | done `d355c20d3c` | 26 | 2,795 |
| DR18 | done `892004cd85` | 28 | 2,198 |
| DR19 | done `78b5f111e7` | 16 | 2,011 |
| **Total** | **19/19 done** | **1,361** | **102,100** |

DR3/DR12's required Signal checks are recorded in their defining commit bodies: reuse off/on was equally lit, and graphs on/off were both lit. The reported darkness was quest dusk state `7dfa08ba3e`; no unjudged look pick remains in these rows.

### DR19 retained acceptance

- `78b5f111e7` ships staged reload picks and pointerup activation; `4081790d50` pins Apply outside the scroll. Both and the final observed runtime `4317319d11` are on origin.
- `tmp/sp-x8-settings/dr19.mp4` and `dr19-pinned.mp4` retain the Simulator recordings; matching `dr19-receipt.json` and `dr19-pinned-receipt.json` report `pass: true`.
- Method: iPhone Simulator Safari, portrait 402 × 714 / DPR 3, WebKit user-gesture pointerup at the hit-tested control centre. Native HID was unavailable; no physical finger or home-screen PWA claim.
- First recording: toggle handler 0 ms / next frame 13 ms; Apply & reload (1) visible, no navigation, undo hides Apply. Pinned follow-up: handler 1 ms / next frame 2 ms; Apply reachable at y=617, height=51, bottom gutter=46. Title Settings, SHARD SELECT Settings and DEV first-tap handlers are 3/0/13 ms, with 44 px targets and 60 px gutters.

## For Jake

No pick remains. G674 resolved Memory saver **on for everyone**, shipped by DR17 (`d355c20d3c`).

Two notes that need no answer:

- **Tile residency** ships at 5 x 5 (the tile plan's D2 B). His first words were "62.5 m plus the neighbours, so
  3 x 3"; changing that is one constant if he feels the pop-in is fine.
- **Distant trees** ship per species. He'll see it in play: the far trees of one species look alike. Reverting is one
  commit.
