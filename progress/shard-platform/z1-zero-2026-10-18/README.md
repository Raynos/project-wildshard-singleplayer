# Sky and Signal runtime closure

Both primary shards now boot with `runtime: null`. Their whole runtime
folders, entry plugins and native world builders are deleted together.
Client rows bind the original held controllers, species, quest pages,
population, encounters and motion. The admitted native recipe also drives
the renderer-free worker. HybridRuntimePlugin and its sole-user
presentation/runtime bridges are gone. The resident scope lookup remains
because Pine, Driftwood and the common page owners still use it.

This implements G483 Z1/Z2, G486 Z3/Z11, and G502's true-zero replacement
for Z5. Sky's static meadow/islands and Signal's actual ember fields share
the bounded buffered-draw path. The meadow retains its exact interleaved
bytes, counts and LOD. Sky's 976 cosmetic draws retain the approved Z2
once-per-resident random-stream ordering. No new shard AssemblyScript,
reflection path, runtime callback or pending-user tag is added.

Sky's ray wake and gust use the independently landed SlashTrail and
CueDirector implementations, already exercised by Pine. There is no
transitional hybrid FX bridge. Original gear, route and quest constants
remain authoritative generator inputs; unused runtime-data outputs and
their producers are removed.

## Source ruler

The official post-look parent is Sky 313 / Signal 143. The immutable
all-ten source inventory measures Sky 0 / Signal 0: -456 shard lines.
Platform growth is +806 code lines: game +507, SDK +16, format +283,
engine 0. This is a net increase of 350 lines across these four layers
and the shards, stated without treating generators as runtime cuts.
`source-ruler.json` records the exact inventory and changed platform files.

## Host bar

Native client composition, typed quest page refs/effects, and motion:
**6/6**. The table scores the combined feature boundary and its small
implementation modules; their internal typed references point to actual
platform owners, never shard-supplied hooks.

| Test | Evidence |
| --- | --- |
| Two real users | `src/shards/far-reach/generators/clientPlan.ts:16` and `src/shards/sunscar-dunes/generators/clientPlan.ts:16` install held, species, quest, population, encounter, player and motion rows |
| No shard nouns | `src/game/shardfile/clientPlan.ts:37`, `src/game/shardfile/clientNativeBook.ts:12`, `src/game/quest/declaredPage.ts:34`, `src/game/shardfile/sceneMotion.ts:31` |
| Data-driven | `src/format/clientNative.ts:16`, `src/format/clientNative.ts:24`, `src/format/clientNative.ts:31`, `src/format/clientNative.ts:36`, `src/format/clientNative.ts:44`, `src/format/clientNative.ts:61`, `src/format/sceneMotion.ts:13`, `src/format/declaredQuestPage.ts:19` |
| Client-only presentation / server-safe recipe | `src/game/shardfile/clientPlan.ts:36`, `src/sdk/headlessSections.ts:1`, `src/game/shardfile/clientGround.ts:57` |
| Deletion test | Either real page remains a complete consumer when the other is removed; both are exercised by `test/native-runtime-plan.test.ts:23` and `test/shard-headless.test.ts:43` |
| Data-only API | `src/format/clientNative.ts:16`, `src/format/declaredQuestPage.ts:19`, `src/game/shardfile/clientPlan.ts:86`; no borrowed methods, owner paths or executable selectors |

Buffered draws and the world scene extension: **6/6**.

| Test | Evidence |
| --- | --- |
| Two real users | `src/shards/far-reach/generators/worldScenes.ts:119` and `src/shards/sunscar-dunes/generators/lightEmitters.ts:24` |
| No shard nouns | `src/game/shardfile/sceneBuffers.ts:30` |
| Data-driven | `src/format/sceneBuffers.ts:20`, `src/format/worldScenes.ts:53` |
| Client-only | `src/game/shardfile/sceneBuffers.ts:26`, `src/game/shardfile/sceneDraws.ts:24` |
| Deletion test | Signal's resident and cold Explorer ember draws remain real users without Sky; `test/scene-buffers.test.ts:1` |
| Data-only API | `src/format/sceneBuffers.ts:12`, `src/game/shardfile/sceneBuffers.ts:31`; typed buffers, views, counts and LOD rows, no callbacks |

The `audio.cues` and `fx.trail` feature installers each score **5/6**:
only Sky currently consumes these *client-plan installers*, so test 1
uses the explicitly approved-platform exception G478/G502. The underlying
hosts have two real users: Pine and Sky. No pending-user tag is added.
Tests 2-6 pass at `src/game/shardfile/clientCues.ts:7`,
`src/game/shardfile/clientTrails.ts:9`, `src/format/clientCues.ts:5`, and
`src/format/clientTrails.ts:5`: labelled client-only, bounded data rows,
no content nouns or shard callbacks. These installers survive deletion
of their first page because they are the approved platform entry for the
already shared CueDirector/SlashTrail. The independent Pine precursors
are 2575d5aca (cues) and 3e263a911 (trails).

## Play and visual evidence

All ten products, root/layer types, typed lint, focused tests, 17 headless
cases and ten grid re-entry cases run on immutable mirror trees. Map
stamps are intentionally left to the coordinated G490 canonical bake.
No budget, gate, timeout or geometry cut is made.

Muted iPhone 16 Pro / DPR2 / Metal, with desktop views as well:

- Signal's 18 day/creature views have exact pixels, draws, triangles, GPU
  bytes, player state and collider values. Its 24 quest/night views also
  retain pixels/draws/triangles/GPU/player/contact values. Eight restored
  weather stages retain flags, native fire visibility, uniform values,
  easing and reload. Three real quest/save cases match the old page.
- Sky's 20 native views retain draws/triangles. Eighteen have exact pixel
  hashes; the crown view differs at one pixel in each tier. The affected
  144-instance mesh has exact attribute bytes, instance matrices, ray-hit
  points, compiled shader bytes and accessible GL uniforms. No geometry
  or look was simplified. GPU allocation is 840 bytes lower in both
  tiers: one position/normal/UV/index box upload. The invisible native
  gale-wall object is present in both versions. These small port
  differences are accepted under G415 (coordinator, 2026-10-18).
- Program counts differ: Sky +1, Signal +4; cache keys/shader inventories
  change with the new staged preparation. Exact program-count or full
  shader-inventory parity is not claimed.
- All 43 Sky pieces and 1,184 collider values match. Raw contact hashes
  differ only in 77 JSON object-key orders; canonical value hash matches.
  The ten physics walk routes report zero stuck and no walk errors.
- Real Sky notes, winch permissions, three roost deaths, vane director,
  bridge endpoint, repeat/reload and two old saves match. Actual Storm
  Roc damage phases, victory, one-time 25 coins and reload match.
- Explorer order, every cold model prepare, metadata and geometry counts
  match for both shards. Sky's 20 ray/board/gust motion frames match
  geometry, matrices, visibility and actor positions, with minimum raw
  GPU SSIM 0.9999988771148669.

Compact JSON receipts accompany this page. The G502 source fingerprint
receipt is `../g502-fx-2026-10-18/sky-motion-parity.json`; the actual physics
walk is `../../physics/sp-x5-z1-0ac1503-0ac1503-mvdz0e8d.json`.
