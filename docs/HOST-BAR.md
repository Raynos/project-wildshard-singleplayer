# The host bar: what goes in the engine, the game, or the shard

The scoring matrix for every platform host and every proposed one. A host is shared code in `src/engine`, `src/game`,
`src/sdk` or `src/format` that shards drive. Jake set the bar in G454 (2026-10-16) and asked for it to be written down
as permanent design (G481, 2026-10-17): *"the engine is supposed to be very flexible and not have all kinds of random
Sky specific and Dune specific if statements in them."* Decisions live in
[plans/shard-platform/decisions.md](plans/shard-platform/decisions.md); the layer rules are in
[ENGINE.md](ENGINE.md) and [AGENTS.md](../AGENTS.md).

## Where code belongs

| Place | What it holds | Test |
|---|---|---|
| **Engine** (`src/engine`) | Rendering, physics, input, audio, boot, levels in general | Knows nothing of the game, Wildshard, shards or content. Engine words only (E405) |
| **Game** (`src/game`, rows in `src/format`) | Wildshard concepts two or more shards use, driven by rows | Knows it is Wildshard; never names a shard |
| **Shard data** | JSON, sections, GLB, look-graph JSON, generator output | No runtime code |
| **Shard AssemblyScript** | Rules, decisions and story only this shard has | Event-driven, at most 10 Hz, through Script ABI commands ([SCRIPT-ABI.md](SCRIPT-ABI.md)); within 10 % of legacy lines (G463) |
| **Shard view code** (TS that stays) | Per-frame drawing or page wiring only this shard has and not worth a host | Listed with a reason; counted as custom |
| **Delete** | Dead code, finished Debug rows, legacy paths | Nothing reaches it |

`generators/` is build-time code and never counts as custom (G467), but only for files no runtime or headless file
imports.

## The six tests

A host counts as shared platform code only if it passes all six. Score each test 1 (pass) or 0 (fail), with file:line
evidence for every fail.

1. **Two real users.** Two shards drive it today. *Exception:* a feature Jake approved as platform from day one
   (G473–G478) or a pending-user entry in `lint/platform-pending-users.json` that names a real future shard, a plan row
   and a recheck date. A pending entry whose shard never adopts it by its recheck comes out and charges back.
2. **No shard nouns.** No shard names, ids, shard-only constants or `if (shard === …)` / `mode === 'board'` branches.
3. **Data-driven.** Shards differ only in the data they declare, not in parameter lists shaped like one shard.
4. **Server-safe**, or labelled as client-only presentation.
5. **Deletion test.** You would keep it if its first shard vanished.
6. **Data-only API** (G454 (5)). The API takes rows and ids. A per-shard hook is an AssemblyScript script reference,
   never a TS callback, subclass override, port object or `{owner, path}` reflection into shard code.

## Verdicts

| Score | Verdict | What happens |
|---|---|---|
| 6 / 6 (or 5 / 6 failing only test 1 under its exception) | **Real engine feature** or **real game host** | Counts as platform |
| 3–5 | **Borderline** | Named fix, a plan row and an owner; counts back to its shard if unfixed by its recheck |
| 0–2 | **Silly**: shard logic in a generic coat | Loses credit at once; moves back to the shard as data, AssemblyScript or listed view code |

**Single-shot code** (exactly one use, no plausible second user) is never a new host. It becomes a row, a number or an
AssemblyScript script. Examples from the Signal audit: the dusk-per-step table, flicker waves, a save-slot name.

## Nothing is free: net platform lines

Moving a line out of a shard into a host is not a cut until the host passes the bar. Every report shows shard lines
cut **and** platform lines added (G455, G466 (9)). A wave that removes 800 shard lines and adds 1,800 platform lines
has grown the codebase; the hosts earn it back only as more shards adopt them.

## The plugin system is migration scaffolding

`src/game/plugin/` (the `HybridRuntimePlugin` and the hooks shards subclass) exists to carry the legacy `runtime/`
code of shards that are not yet fully data. It is not the target architecture. As each shard's runtime reaches zero,
the plugin pieces only it used become dead code and are deleted (SHARD-PLATFORM-NEXT N2, G481). The Signal audit
(2026-10-17) scored `HybridRuntimePlugin` 1 / 6: a subclass with TS hooks and Sky's hoverboard mode hard-coded.

## Audits

- `progress/shard-platform/host-audit-2026-10-16/README.md`: the 92 pending-user hosts (77 good, 14 borderline, 1 silly).
- The Sky and Signal deep dives (2026-10-17): every platform module only those two shards use, scored on the six tests.
- `progress/shard-platform/builder-calls-audit-2026-10-17/host-rescore.md` (G496): 31 feature hosts since the 10:37
  pass re-scored; 17 self-scores held, 14 were too high; loadout `held.ts` and the held equipment catalogue score 2 / 6.

## Dated exceptions

- G478 riding presentation: `game/riding/mount` consumes profile rows and actor identities (fixture second shard).
- G478 riding HUD: `game/riding/hud` consumes observation rows and retains the baseline HUD slots (fixture second shard).

- `engine/world/waterSurface.ts` (Pine's water body) stays in the engine until `pine-hollow-legacy` is deleted
  (SHARD-PLATFORM-NEXT N5) and moves to Pine in that commit (G500); the sealed legacy copy cannot import primary Pine.

## Still owed

- Still owed (G481): every host in `src/engine` and `src/game`, the plugin system, and the G473–G478 features as they
  land.
- G474 boss arenas: `game/boss/arenaRoom` consumes room, effect, floor and scene rows; `game/boss/arenaFire` consumes mesh capacity, graph ids and smoke tuning rows. Both are client-only presentation, with a second-shard vault/fire fixture in `test/boss-arena-room.test.ts`.

- G478 grapple traversal: `game/grapple/sim`, `game/grapple/course`, `game/grapple/headless`, `game/grapple/tool`, and `game/grapple/ribbon` consume course/profile rows; client presentation is labelled.
- G478 practice courses: `game/practice/hookCourse` consumes the admitted room layout and the equipped native grapple tool.

- G478 stealth: `game/stealth/controller` consumes detection observations and ABI-v1 program rows; `StealthDetection` is server-safe and `StealthController` is client-only baseline HUD presentation.

- G475 held weapons: `game/weapons/heldPolearm`, `game/weapons/mountedBlade`, `game/weapons/arcPower` and `game/weapons/heldDecision` consume `format/heldMelee` schemas for admitted model, pose, contact and ABI-v1 guest rows. Native presentation is client-only; `heldDecision` is renderer-free. An unrelated orchard weapon fixture drives the same projection runner in `test/held-weapon-laws.test.ts`.

- G478 walk-in portal rides: `game/shardfile/walkInPortalRide` consumes portal links, trigger/fade rows and feet observations, returning hold/transfer commands and a veil amount. Renderer-free; a made-up orchard shard drives the same host in `test/nine-traversal-data.test.ts`.
- G478 audio patches: `game/audio/voicePatches` consumes voice, bed, scheduler and layer rows; client-only presentation, with an unrelated cavern fixture in `test/audio-voice-patches.test.ts`.
- G478 audio scenes: `game/audio/sceneDirector` consumes zone probes, surface maps, event cues, bed controls and score observations; client-only presentation.

- G478 grass fields: `game/looks/grassPresentation` consumes admitted field rasters, bounded ring buffers and mood rows; client-only presentation. `format/fieldPresentation` validates its profile and the G475 static capture rows.
- G478 painterly panorama fog: `engine/world/Atmosphere` `ColourRampFog` with a `panorama` (heading LUT, aerial haze, edge haze, live tint; `render/nodes/engineFog` its node twin) consumes borrowed live values only; client-only presentation. Nalati is the first user; an unrelated painted dusk desert fixture drives both paths in `test/graph-ramp-fog.test.ts`.
- G475 static captures: `game/looks/staticCapture` consumes bounds, quality and pass-program rows; client-only shadow/contact presentation.
- G475 scatter projection: `engine/render/scatterInstances` consumes numeric pose, colour and range rows; client-only culling, shared with an unrelated orchard fixture.
- G474 wing projection: `game/ambient/wingField` consumes ambient group, palette and paired-wing rows; client-only projection of the existing 10 Hz ambient host.
