# Honest custom floor — next switch point, 2026-10-17

**Recommendation:** list the demonstrated shard-owned laws as custom at the
G466 switch point, with Jake's approval. Keep their lines in the ruler.
Do not call a component 100/0 while those laws remain. The current G466 bar
still permits only **listed view code**; this ledger proposes a decision,
not a new exemption, completed conversion, or host approval.

## Scope and measurement

**Pinned snapshot: `908dcec0a`.** One exact-commit build-mirror `check` run of `sourceProgressInventory` after the BOTH-surface release. Command: `node scripts/build-mirror.mjs run 908dcec0a --slot check -- node <inventory.mjs>`; the temporary reader imported the snapshot's `scripts/shard-platform.mjs` and retained its `customSources`, `components` and totals. Concurrent uncommitted work is excluded.

Product prerequisites include the producer-order repair `40bd99537`.
The earlier attempt at `682af4048` refused incomplete products; preparation
then exposed isolated readers running before their generated inputs. The
final counts below use complete product section inventories on the repaired
pin, without granting source credit for the ordering fix itself.

The mirror prepared complete products with `node scripts/gen.mjs --proof`
and `node scripts/build-shardfiles.mjs --reuse` under the shared
`heavy-lane.py build` lease. To reproduce the inventory read in that
prepared mirror, run this Node module command through `build-mirror.mjs`:

```sh
node --input-type=module -e 'import {sourceProgressInventory} from "./scripts/shard-platform.mjs"; console.log(JSON.stringify(sourceProgressInventory()));'
```

Every file contributing **80 or more custom lines** is listed below,
including a platform file when its one-shard declarations sum to 80.
Counts are nonblank, comment-free TypeScript lines from
`sourceProgressInventory` in `scripts/shard-platform.mjs`, including G294
sole-user platform attribution. They are **source-basis progress**, not
output closure, a physical line count, or a new M3 denominator. The frozen
basis fix is `62ed57754`. AssemblyScript is a separate visibility column;
generator authoring is excluded under G467. No code moves or line cuts are
claimed by this documentation commit.

For Pine, Driftwood, Sky and Signal, the component column gives the exact
ruler allocation (mixed files show each component's lines). Nalati and Nine
are outside `COMPONENT_SHARDS`; their components are **proposed job owners**,
not fabricated inventory component results. All file counts still come
from the same source inventory. Source links identify the file; read the
pinned commit for immutable evidence if a later lane deletes or changes it.

Tags are proposals for the **whole listed contribution**, conservatively
keeping mixed simulation/view modules out of a blanket view exemption:

- **view code**: presentation/adoption/assembly candidate for explicit
  listing. This does not mean every span has already been accepted.
- **shard-owned law**: a real gameplay, ownership, content or lifecycle rule
  without a demonstrated second shard consumer.
- **needs new shared ABI**: ownership or skin boundaries worth designing
  with two real shard users in the same landing, rather than another port
  bag of shard callbacks.
- **still convertible**: a named existing bake/graph/posed-draw pattern
  remains available. It is not part of the claimed irreducible floor.

The below-80 tail is reconciled separately, **unclassified**. A file can
contain smaller convertible parts even when its whole-file tag is a law.
Neither shared vocabulary nor two callers in one shard satisfies G454.

Two charged tool/proof contributions are kept visible rather than accepted
as gameplay floor: Nalati's `sdk/compileScript.ts` (97, reached by the Qara
generator) and Nine's `game/plugin/simulation.ts` proof declarations (143,
reached by its boot module map). Their tags call for reach/admission review;
the ledger does not silently subtract them or propose another gameplay host.
The product run supplied inventory evidence, not a map or visual-parity
proof; no maps were rebaked for this documentation task.

## Evidence register

The coordinator supplied summaries of uncommitted Herdr audits. The
following entries preserve their substance here and cite them as **audit
relayed to coordinator, 10-17**; they are not commits or independent
measurements at this snapshot. Their reported historical line numbers can
move. Row citations `A1`–`A10`, `C3`, and `C7` refer to this register.

- **C3 — `ba4d00fe9`**, [close review](../c3-review/README.md): C3 was not
  closed. At that review, 80 of Pine's 99 C3 spans were accepted view code:
  Puffs, glass/lights, swings/wheels and one geometry import. The other 19
  were door state/audio loans. Scavenge/visit, SiteLights callbacks and
  weather failed parts of G454. This is historical: shared storm-row
  adoption subsequently landed in `c728e6278`; do not repeat the old
  one-user-weather-host finding as a current host failure.
- **C7 — `23d1ca30a`**, [close review](../c7-review/README.md): no closure;
  Pine canoe transit and door hinge were not two-shard data-only hosts.
  Door simulation returned to Pine in `3d26e4535`. Attribution under C5/C3
  did not remove the mechanics. Re-evaluate later fixes against this
  finding; it is not evidence that every historical failure remains open.
- **A1 — C5 joint audit**, at `8b280a432`, audit relayed to coordinator,
  10-17: QuestState.compute already owns ordered done-gates, both native
  installers use DeclaredQuests/installQuestGraph and both finales use
  DirectorScriptStageLane.bind. No additional honest shared step runner.
  DW `runtime/quest.ts:110–260` owns prompt visibility, sailor guard/key,
  barrel pre/post-physics anti-jam, sluice, cable/reward and saved body
  handles. Pine `runtime/quest.ts:146–346` owns modal priority, reading
  payout, bench teleport, resin, dawn, lodge/skin/ammo and atomic restore.
  DW `quest/adventure.ts:116+`, `finalePresentation.ts:54+` and
  `Spine.ts:46+` differ from Pine `quest/index.ts:124+`, lodge and contracts:
  Captain recovery/camera and moving castaway versus pool/mill/canoe and a
  serial-hashed three-slot hunting board with exact payout order.
- **A2 — C4 native actor/save audit**, at `e522ffbf6`, audit relayed to
  coordinator, 10-17: createNativeCreatureRoster already owns
  materialize/retire/herds/reinstall for Pine and DW. DW ecology's delayed
  death/replacement queue, 60 m/night gates, native bound 256; keeper's
  fresh IDs, practice crab, placement retry, coconut handles and island-v8
  save; monkey perch occupancy/root; Pine night director's seven phases,
  roamer/race identities and snapshot-v2 checks; elite rival IDs remain
  distinct ownership policy. Requires a real ownership/save ABI first.
  The reported Pine `runtime/elites.ts` has since been deleted by
  `6fe631848`, so it is not a remaining-file row.
- **A3 — Nalati native creatures audit**, at `8f5e76376`, audit relayed to
  coordinator, 10-17: headlessCreatures owns global ID/RNG adoption order,
  packs/flock/dog/prey, raid/elite/bonded spawns, dormant versus retired
  actors and the nalati.creatures save envelope. headless composes terrain,
  weather/lightning and trample; headlessRaid retains shepherd/prey/pack
  identity and v2 counters. Thin elite keepers cannot simply fold into a
  port bag (the attempted fold added 84 callbacks). headlessElites was
  subsequently deleted by `6fe631848` and is not listed as remaining.
- **A4 — Riding audit**, at `aac0fbb87`, audit relayed to coordinator,
  10-17: MountedBody/MountedReins consumers are only Nalati Mount and
  headlessMounted. Mount, tamingLaw, headlessMounted, RideHUD, ride and
  Reins have no second riding shard: Pine canoe/cable, DW boat/cable, Sky
  board/platform, Signal's tethered caravan model and Nine portals do not
  provide mounted-reins/taming behavior. RideHUD is Nalati's own file.
- **A5 — Kokpar/adventure audit**, around `4fa329e26`, audit relayed to
  coordinator, 10-17: `kokpar.ts:63–117` owns mounted pickup, practice
  exclusion, 45 s round, slow-gait theft, drops, flank pose, tai-qazan score
  and 4 s reset. adventure already uses shared chapter presentation;
  `:114–134` polls taming/boss/cairn state and ordered elite feather
  catch-up, `:138–154` carves the first missing clue on balbal death. Saved
  progress projects killed OR retired elites, unlike that live poll.
- **A6 — Camp lifecycle audit**, under the CPU HOLD, audit relayed to
  coordinator, 10-17: questContent owns placements/talk; adventure passes
  figures to presentChapterStory, whose caller owns them.
  `campPeople.ts:115–205` owns one fallback batch, four capsules, the child
  terrain-following anchor, async skin adoption, detached joint matrices
  and prompt positions. `figureMotion.ts:22–73` owns child stop/orbit,
  attention/glance recurrence and head publication. PosedDraw/pivotNpc
  do not adopt the complete skin/fallback/collider contract. Skin atlas
  and fallback geometry work subsequently landed in `89552ab75` and
  `3b3e00d2f`; those cuts do not establish the missing ownership ABI.
- **A7 — Pine/DW second pass**, audit relayed to coordinator, 10-17:
  source totals then Pine 10,823 / DW 6,662. Existing hosts/bakes already
  handle the shared work; residuals are live native assembly, shard
  mechanics and view ownership. DW compressed-cell streaming is not
  Pine forest-frustum batching. Pine/DW creature-host findings are also
  committed in `07b5ec55a` and `b63ba6488`
  ([native audit](../w2-sim-o267/README.md),
  [second-user audit](../w2-hosts-o274/README.md)): Pine has no biped
  swing/stride, ranked perch placement, grouped page spawner or DW
  memory-action policy twin; a real group-sampling twin did land.
- **A8 — Nalati mid-size audit**, at `682af4048`, audit relayed to
  coordinator, 10-17: elites delegates three named profiles but retains
  Qara circle/wheel/charge/open, paired charges, identity, contacts and
  tells (`:173–269`, `:297–417`). FlockBrain already runs cohesion; removing
  the page flock needs a sheep shader/posed-draw conversion retaining dog
  herding, prey death and weapon ray shapes. state retains Titan/practice
  suppression, ride/stealth/night/weather and ordered target clocks.
- **A9 — Other reviewed laws and conversion precedents**, audit relayed to
  coordinator, 10-17: Nine's GrappleAim has only FeiZhua, Well rails and
  portal return-edge law are local, fpArmsRig channels/strandCloth remain
  live; Nalati Titan (`07597ee1d`), javelin (`8f5e76376`), mounted sword
  (`086d68e0d`), Lightning and persistent synth remain owned behavior.
  Conversion precedents: fixed geometry/paint `b905a8549`, places
  `52de1ee89` / `c20ba8716`, scatter `bc2618cf9`, coats `a251a3cbf`, shared
  score lifecycle `807a2d28e`, smoke graph `2384aa14d`, river graph
  `4c967cd0f`, storm-FX graph `9cfdf3e46`. Other row descriptions are
  source inspection at the pinned snapshot, not additional historical
  audit claims; a still-convertible tag explicitly leaves that work open.
- **A10 — Sky/Signal retained view boundary**, current source inspection
  plus the coordinator's 10-17 lane report: Sky runtime/index retains
  build, wind/gust fields, hover/vane dressing, ray wake and gale-wall page
  draws. Native headless assembly cannot run that page lifecycle. Sky and
  Signal world builders now read baked layouts (`e4eb4deb6`); moving the
  remaining page code to plugin.ts would not be a cut.


## Pine Hollow

All custom: **10,831**; listed ≥80-line file contributions: **7,139** in **44 files**; below-threshold tail: **3,692**. AssemblyScript separately: 317 lines. Ruler unknown-owner units: 38.

| File / charged unit | Custom lines | Component | Law or view responsibility | Why the current shared host does not remove it / evidence | Proposed tag |
|---|---:|---|---|---|---|
| [quest/index.ts](../../../src/shards/pine-hollow/quest/index.ts) | 424 | C1 38, C2 4, C4 3, C5 365, C6 5, C7 4, C8 5 | Assemble pool, mill gate, shelf, canoe, lodge, NPC and dawn progression. | QuestState and Director already run shared stages; this page assembly has no Driftwood equivalent. [A1] | shard-owned law |
| [runtime/life/visitors.ts](../../../src/shards/pine-hollow/runtime/life/visitors.ts) | 312 | C3 310, C4 1, C8 1 | Draw and steer carcass scavengers and perch visitors. | C3 audit found no Driftwood scavenge/visit consumer; gull flock is not that law. [C3/A7] | view code |
| [runtime/props/bakedBuilding.ts](../../../src/shards/pine-hollow/runtime/props/bakedBuilding.ts) | 306 | C1 277, C2 28, C3 1 | Assemble baked walls, openings, glass and building attachment handles. | It already reads bakes; native living-building assembly is not another static placement producer. [A7] | view code |
| [runtime/index.ts](../../../src/shards/pine-hollow/runtime/index.ts) | 277 | C1 39, C2 12, C4 14, C5 9, C6 19, C8 7, C9 177 | Sequence Pine page/native installation, runtime preparation and disposal. | Shared boot assembly does not own the page's forest, adventure and presentation loans. [A7] | shard-owned law |
| [runtime/quest.ts](../../../src/shards/pine-hollow/runtime/quest.ts) | 273 | C1 4, C2 1, C5 263, C6 3, C7 2 | Apply modal priority, reading payout, dawn, ammo and atomic modal restore. | Driftwood has no contract board or reading continuation; another step runner would hide shard decisions. [A1] | shard-owned law |
| [combat/eliteScripts.ts](../../../src/shards/pine-hollow/combat/eliteScripts.ts) | 270 | C2 1, C4 263, C6 6 | Run named-elite cave/fade actions and rival identity saves. | EliteCore hosts cadence; rival references and saved ownership remain Pine policy. [A2] | needs new shared ABI: native actor + save ownership |
| [runtime/looks/keyedSky.ts](../../../src/shards/pine-hollow/runtime/looks/keyedSky.ts) | 257 | C1 4, C2 250, C9 3 | Load sky keys and publish weather-over-clock sky textures. | Atmosphere/day hosts do not implement this keyed texture interpolation/ownership contract. [A7] | view code |
| [src/game/plugin/heldLauncher.ts](../../../src/game/plugin/heldLauncher.ts)<br>sole-export 255 | 255 | C9 255 | Own physical-bolt flight, sticking/glance, retrieval and held launcher state. | HeldLauncher declarations are still Pine-only on G294; hitscan firearms and bows do not establish a second data-only launcher user. [A7] | shard-owned law |
| [runtime/life/ambientLife.ts](../../../src/shards/pine-hollow/runtime/life/ambientLife.ts) | 252 | C3 178, C4 21, C6 51, C8 2 | Coordinate harvest beats, carcass visits, crumbs and discoveries. | Forager/flock hosts cover populations; harvest interruption and journal coupling remain Pine laws. [C3/A7] | shard-owned law |
| [runtime/antlerKing.ts](../../../src/shards/pine-hollow/runtime/antlerKing.ts) | 213 | C1 14, C2 47, C4 148, C6 4 | Own King encounter rewards, presence, arena and page handoff. | Phased boss host is already used; King-specific room and reward policy has no identical second user. [A2/A7] | shard-owned law |
| [loadout/loadout.ts](../../../src/shards/pine-hollow/loadout/loadout.ts) | 203 | C1 2, C2 2, C6 188, C8 11 | Restore ranged loadout, skins, ammo and keepsake equipment order. | Held-item hosts are already adopted; Pine's saved loadout and award ownership remain local. [A7] | shard-owned law |
| [runtime/world/homestead.ts](../../../src/shards/pine-hollow/runtime/world/homestead.ts) | 202 | C1 166, C2 34, C9 2 | Load cabin materials/LODs and assemble the living settlement. | Existing model loaders do not own Pine cabin lifecycle and per-building loans. [A7] | view code |
| [combat/install.ts](../../../src/shards/pine-hollow/combat/install.ts) | 195 | C1 4, C2 3, C4 176, C5 2, C6 4, C8 6 | Wire Pine fights, named-elite encounters and combat outcomes. | The shared combat hosts do not define Pine's assembly and reward ordering. [A2/A7] | shard-owned law |
| [runtime/looks/rainFx.ts](../../../src/shards/pine-hollow/runtime/looks/rainFx.ts) | 195 | C1 26, C2 130, C6 39 | Present wooded rain, canopy drips, low-ground puddles and streams. | Shared rain hosts do not supply Pine canopy/puddle composition as data today. [C3/A7] | view code |
| [runtime/species/limbRig.ts](../../../src/shards/pine-hollow/runtime/species/limbRig.ts) | 190 | C4 190 | Blend a four-legged scalar rig and plant its feet through IK. | Driftwood biped swing/stride is a different rig; no second consumer of this IK contract. [A7] | view code |
| [runtime/roster.ts](../../../src/shards/pine-hollow/runtime/roster.ts) | 170 | C1 3, C4 167 | Bind rolled elites, parked actors, ground and native roster continuation. | Shared roster is already adopted; retained actor identity and save wire need explicit ownership rows. [A2] | needs new shared ABI: native actor + save ownership |
| [runtime/world/crags.ts](../../../src/shards/pine-hollow/runtime/world/crags.ts) | 167 | C1 152, C2 15 | Present Ridge granite, Den cave and admitted rock looks. | The geometry is baked; local material and cave assembly remain. [A7] | view code |
| [runtime/compendium/trophyWall.ts](../../../src/shards/pine-hollow/runtime/compendium/trophyWall.ts) | 155 | C1 134, C2 20, C4 1 | Draw chalk trophies from journal progress. | No second shard trophy wall uses its board/slot contract. [A7] | view code |
| [runtime/nightDirector.ts](../../../src/shards/pine-hollow/runtime/nightDirector.ts) | 154 | C4 154 | Own seven night phases, roamer/race identities and saved lists. | Shared roster does not own Pine night phases or snapshot identity validation. [A2] | needs new shared ABI: native actor + save ownership |
| [runtime/kit/caveInterior.ts](../../../src/shards/pine-hollow/runtime/kit/caveInterior.ts) | 151 | C1 143, C2 8 | Display cave interior, entry transition and baked bounds in its own frame. | Other interiors do not consume this cave frame/visibility contract. [A7] | view code |
| [runtime/world/landmarks.ts](../../../src/shards/pine-hollow/runtime/world/landmarks.ts) | 149 | C1 134, C2 9, C9 6 | Bind named landmark models, signs and live interaction anchors. | Model placement is shared already; landmark-specific attachments are not a shared simulation law. [A7] | view code |
| [runtime/models/antlerKing.ts](../../../src/shards/pine-hollow/runtime/models/antlerKing.ts) | 148 | C1 135, C2 5, C4 8 | Dress the King's own baked rig and lantern. | Baked creature hosts load parts; this dressing and attachment policy remains King-specific. [A7] | view code |
| [runtime/king.ts](../../../src/shards/pine-hollow/runtime/king.ts) | 145 | C1 4, C2 5, C4 129, C6 6, C8 1 | Bind native Antler King body, presence and encounter continuation. | Generic boss phases do not own the King's body and encounter save relationship. [A2] | needs new shared ABI: native actor + save ownership |
| [runtime/npc/standInPerson.ts](../../../src/shards/pine-hollow/runtime/npc/standInPerson.ts) | 139 | C1 5, C2 2, C5 132 | Draw a posed fallback person and named attachment parts. | Pivot NPC covers rigid pieces; fallback/generated replacement ownership is still local. [A7] | view code |
| [world/weather.ts](../../../src/shards/pine-hollow/world/weather.ts) | 133 | C3 128, C4 3, C5 1, C8 1 | Bind page weather to forest, water, shelter and ambient sound. | Shared storm rows now have two users, but these page answers are Pine-specific. [C3/A7] | shard-owned law |
| [src/game/systems/npc/npcRig.ts](../../../src/game/systems/npc/npcRig.ts)<br>sole-export 132 | 132 | C5 132 | Pose and publish the charged NPC rigid-figure bindings. | Only the attributed declarations are charged; other NPC consumers do not automatically share those bindings. [A7] | view code |
| [runtime/kingPoseKeeper.ts](../../../src/shards/pine-hollow/runtime/kingPoseKeeper.ts) | 127 | C1 2, C4 125 | Publish King joints and query pose in the required order. | Native pose host is adopted; the King query/publish timing remains a specific presentation binding. [A7] | view code |
| [runtime/kit/heldTool.ts](../../../src/shards/pine-hollow/runtime/kit/heldTool.ts) | 109 | C1 10, C2 7, C6 92 | Dress and animate a gloved tool through a timed work beat. | Other held weapons do not use the same tool/beat/decal contract. [A7] | view code |
| [quest/contracts.ts](../../../src/shards/pine-hollow/quest/contracts.ts) | 104 | C5 98, C6 6 | Draw collision-free contracts, count kills and preserve tear/claim order. | The contract cycle has no second shard consumer. [A1] | shard-owned law |
| [src/engine/world/water/ripples.ts](../../../src/engine/world/water/ripples.ts)<br>sole-module 102 | 102 | C1 56, C2 46 | Maintain water skyline/probe and ripple texture presentation. | G294 retains the Pine-only declarations; another water surface does not prove those declarations have a second user. [A7] | view code |
| [runtime/lodge.ts](../../../src/shards/pine-hollow/runtime/lodge.ts) | 102 | C4 1, C5 99, C6 2 | Rebuild and pay the saved rotating lodge board. | Driftwood shop has no serial three-slot board or overlapping kill predicates. [A1] | shard-owned law |
| [runtime/species/herdShelter.ts](../../../src/shards/pine-hollow/runtime/species/herdShelter.ts) | 96 | C4 95, C8 1 | Move grazing herd wander homes under canopy during rain. | No second herd uses this forest shelter/home policy. [A7] | shard-owned law |
| [combat/kingRig.ts](../../../src/shards/pine-hollow/combat/kingRig.ts) | 94 | C2 1, C4 91, C6 2 | Apply baked King clips and foot planting. | Native pose hosts do not own this quadruped rig/query ordering. [A7] | view code |
| [runtime/looks/groundCover.ts](../../../src/shards/pine-hollow/runtime/looks/groundCover.ts) | 94 | C1 7, C2 87 | Bind forest-frustum cover batches to graph textures and sky parameters. | DW compressed-cell streaming has a different residency/allocation law. [A7] | view code |
| [runtime/weapons/LeverRifle.ts](../../../src/shards/pine-hollow/runtime/weapons/LeverRifle.ts) | 93 | C1 17, C2 1, C6 74, C9 1 | Admit rifle geometry and bind its held-firearm rows/specimen. | HeldFirearm is shared; Pine model/skin material and geometry loans remain. [A7] | view code |
| [data/layout.ts](../../../src/shards/pine-hollow/data/layout.ts) | 90 | C1 87, C2 3 | Declare Pine named sites, geometry coordinates and discovery anchors. | Preserve derived arithmetic offline and use the existing admitted layout path; avoid a second const mirror. [A7] | still convertible: authored JSON layout rows |
| [runtime/sections.ts](../../../src/shards/pine-hollow/runtime/sections.ts) | 88 | C1 3, C2 18, C6 2, C9 65 | Validate and admit Pine-specific section payloads. | Schema ownership remains shard-specific; moving validators to a one-user host changes no debt. [A7] | shard-owned law |
| [src/game/models/pickups.ts](../../../src/game/models/pickups.ts)<br>sole-module 86 | 86 | C1 80, C2 6 | Build and register the charged pickup geometry, parts and bob/pulse rows. | Prepared geometry and declared pickup rows are the existing path; keep the original slot/lift/pulse contract while removing the procedural module, not just moving its constants. [A7] | still convertible: offline pickup-model bake |
| [world/terrain.ts](../../../src/shards/pine-hollow/world/terrain.ts) | 83 | C1 71, C2 1, C4 11 | Answer old-growth, ridge, creek and species density geography. | Shared terrain host does not define Pine geography; sample conversion needs exact consumer parity. [A7] | shard-owned law |
| [runtime/quest/npcModels.ts](../../../src/shards/pine-hollow/runtime/quest/npcModels.ts) | 82 | C1 8, C2 6, C5 68 | Load generated hamlet NPCs and fit them to posed stand-ins. | Shared model loading does not own the hamlet replacement/attachment binding. [A7] | view code |
| [data/sky.ts](../../../src/shards/pine-hollow/data/sky.ts) | 81 | C2 27, C9 54 | Declare Pine sky keys, presets, schedule and overcast tuning. | Existing keyed-sky/channel consumers can admit the same data; these literal presets are not an irreducible gameplay law. [A7] | still convertible: authored JSON sky rows |
| [species/looks.ts](../../../src/shards/pine-hollow/species/looks.ts) | 81 | C2 37, C4 44 | Dress Pine grazers and elk with the shard's coats and rigs. | Shared creature rendering does not define Pine material/variant presentation. [A7] | view code |
| [runtime/models/logCabin.ts](../../../src/shards/pine-hollow/runtime/models/logCabin.ts) | 80 | C1 80 | Expose baked log-building specimens and session material views. | Geometry is baked; model catalogue/variant adoption remains local. [A7] | view code |
| [runtime/world/cabins.ts](../../../src/shards/pine-hollow/runtime/world/cabins.ts) | 80 | C1 77, C9 3 | Place the homestead and hamlet models with floor/building handles. | Static kit is baked; settlement-specific attachment and placement composition remains. [A7] | view code |

## Driftwood Isle

All custom: **6,662**; listed ≥80-line file contributions: **2,634** in **17 files**; below-threshold tail: **4,028**. AssemblyScript separately: 96 lines. Ruler unknown-owner units: 28.

| File / charged unit | Custom lines | Component | Law or view responsibility | Why the current shared host does not remove it / evidence | Proposed tag |
|---|---:|---|---|---|---|
| [sim/keeper.ts](../../../src/shards/driftwood-isle/sim/keeper.ts) | 299 | C1 10, C2 1, C4 287, C6 1 | Adopt ecological returns, practice crab, coconuts and island-v8 saves. | Shared roster already materializes actors; retry placement, fresh IDs and saved auxiliary handles remain local. [A2] | needs new shared ABI: native actor + save ownership |
| [runtime/looks/streamedCover.ts](../../../src/shards/driftwood-isle/runtime/looks/streamedCover.ts) | 264 | C1 29, C2 235 | Decode compressed cover cells and stream plant batches around the viewer. | Pine's forest-frustum batches have a different allocation/streaming law. [A7] | view code |
| [creatures/Enemies.ts](../../../src/shards/driftwood-isle/creatures/Enemies.ts) | 234 | C1 42, C2 16, C4 154, C6 19, C9 3 | Own page enemy groups, palm occupancy and disposal/retirement. | Pine spawns single actors through the roster, without this grouped page lifecycle. [A2] | needs new shared ABI: native actor + save ownership |
| [runtime/quest.ts](../../../src/shards/driftwood-isle/runtime/quest.ts) | 196 | C1 17, C5 176, C6 3 | Dispatch visible prompts and preserve sailor/body/cable/barrel quest ownership. | Pine has no matching sailor guard, barrel anti-jam, sluice or saved Rapier-handle adoption. [A1] | shard-owned law |
| [quest/adventure.ts](../../../src/shards/driftwood-isle/quest/adventure.ts) | 173 | C1 12, C4 1, C5 155, C6 4, C8 1 | Assemble ecology, trader, kit, completion, guides and bridge-camera sway. | Shared quest/stage hosts are adopted; Pine page assembly has different mechanics. [A1] | shard-owned law |
| [runtime/sections.ts](../../../src/shards/driftwood-isle/runtime/sections.ts) | 173 | C1 23, C2 19, C4 3, C6 2, C9 126 | Validate and admit the island's typed product rows. | Validators describe island payloads; a second host user is absent. [A7] | shard-owned law |
| [world/BlenderIsland.ts](../../../src/shards/driftwood-isle/world/BlenderIsland.ts) | 166 | C1 143, C2 8, C9 15 | Admit cove terrain, foliage and baked island model placements. | Geometry is baked; this tier/material/world assembly has no identical second consumer. [A7] | view code |
| [runtime/viewmodel/toonArms.ts](../../../src/shards/driftwood-isle/runtime/viewmodel/toonArms.ts) | 155 | C1 11, C2 10, C6 134 | Dress shared skinned arms with Driftwood toon materials. | Shared RigArms plays the rig; toon material/weapon bindings remain local. [A7] | view code |
| [runtime/models/ropeBridge.ts](../../../src/shards/driftwood-isle/runtime/models/ropeBridge.ts) | 148 | C1 142, C2 2, C6 1, C9 3 | Assemble the baked rope bridge and its model/collider anchors. | Shared placement reads baked pieces; bridge-specific assembly survives. [A7] | view code |
| [loot/keepsakes.ts](../../../src/shards/driftwood-isle/loot/keepsakes.ts) | 139 | C1 16, C2 1, C5 3, C6 116, C8 3 | Award saved keepsakes from beach pickups and chosen fights. | Loot economy is shared; award triggers and claimed-item ordering are island policy. [A7] | shard-owned law |
| [world/build.ts](../../../src/shards/driftwood-isle/world/build.ts) | 139 | C1 126, C2 3, C4 3, C9 7 | Compose Driftwood world owners, retained handles and disposal. | Static builders are shared/baked; this is the island's live assembly. [A7] | view code |
| [weapons/IronSword.ts](../../../src/shards/driftwood-isle/weapons/IronSword.ts) | 114 | C1 3, C2 5, C6 106 | Own rack pickup, reward visibility and sword interaction. | Shared item drawing does not define the island's rack/claim lifecycle. [A7] | shard-owned law |
| [runtime/index.ts](../../../src/shards/driftwood-isle/runtime/index.ts) | 91 | C1 5, C2 5, C4 4, C5 4, C6 8, C8 2, C9 63 | Install the island world, loadout, creatures, adventure and sound. | Existing boot assembly does not own these page-specific installation loans. [A7] | shard-owned law |
| [sim/baked.ts](../../../src/shards/driftwood-isle/sim/baked.ts) | 90 | C1 9, C4 2, C5 10, C9 69 | Admit island native floor, species, placements and keeper rows. | Shared native bake readers do not define the island's typed payload contract. [A7] | shard-owned law |
| [runtime/npc/Castaway.ts](../../../src/shards/driftwood-isle/runtime/npc/Castaway.ts) | 88 | C1 22, C2 4, C5 51, C9 11 | Present Wendell fallback/generated parts, wave and head attention. | Shared NPC primitives do not own castaway-specific part/replacement bindings. [A1/A7] | view code |
| [runtime/finalePresentation.ts](../../../src/shards/driftwood-isle/runtime/finalePresentation.ts) | 83 | C4 2, C5 76, C9 5 | Recover Captain spawn/failure and hand off the reward camera. | Pine dawn captions/clock have no DrownedCaptain lifecycle. [A1] | shard-owned law |
| [runtime/npc/Trader.ts](../../../src/shards/driftwood-isle/runtime/npc/Trader.ts) | 82 | C1 13, C2 3, C5 57, C9 9 | Present the island trader and shop-facing attention state. | Shop mechanics are shared; this is local NPC view assembly. [A7] | view code |

## Nalati Grasslands

All custom: **22,021**; listed ≥80-line file contributions: **17,922** in **86 files**; below-threshold tail: **4,099**. AssemblyScript separately: 162 lines. Component labels below are proposed job owners.

| File / charged unit | Custom lines | Component | Law or view responsibility | Why the current shared host does not remove it / evidence | Proposed tag |
|---|---:|---|---|---|---|
| [combat/stormTitan.ts](../../../src/shards/nalati-grasslands/combat/stormTitan.ts) | 918 | C4 (proposed) | Run Titan storm phases, strike targets, arena rewards and continuation. | Existing borrowed boss policies require AnimalSim; Titan has a different owner (07597ee1d). [A8/A9] | shard-owned law |
| [world/KurganDungeon.ts](../../../src/shards/nalati-grasslands/world/KurganDungeon.ts) | 743 | C1 (proposed) | Build chamber fabric, baked lighting and animated encounter attachments. | Static geometry/light can follow places/specimens bakes; live floor and encounter handles must stay owned. [A9] | still convertible: offline geometry/paint bake |
| [runtime/weapons/javelinSpear.ts](../../../src/shards/nalati-grasslands/runtime/weapons/javelinSpear.ts) | 542 | C6 (proposed) | Own thrown javelin flight/pickup and mounted lance contacts. | Held weapon hosts do not own projectile persistence and mounted contacts (8f5e76376). [A9] | shard-owned law |
| [runtime/headlessCreatures.ts](../../../src/shards/nalati-grasslands/runtime/headlessCreatures.ts) | 494 | C4 (proposed) | Preserve global actor-ID/RNG adoption, packs, raids, bonded bodies and saves. | Shared roster lacks this complete ownership/save-envelope policy. [A3/A8] | needs new shared ABI: native actor + save ownership |
| [combat/elites.ts](../../../src/shards/nalati-grasslands/combat/elites.ts) | 472 | C4 (proposed) | Run named elite bindings and Qara Batyr wheel/charge/open rules. | Existing elite hosts cover three profiles; paired charges, contacts and rider tells stay Nalati policy. [A8/A9] | shard-owned law |
| [src/game/plugin/mover.ts](../../../src/game/plugin/mover.ts)<br>sole-export 451 | 451 | C7 (proposed) | Own attributed mounted-body, reins, spur and road-steering laws. | All real mounted/reins consumers remain Nalati; other traversal modes are not a second riding user. [A4] | shard-owned law |
| [world/terrain.ts](../../../src/shards/nalati-grasslands/world/terrain.ts) | 404 | C1 (proposed) | Compute river, brook, bowl, ridge and trail geography. | Baked ground can serve runtime queries, but every edge/floor consumer must use the same exact sampler first. [A9] | still convertible: offline ground/layout rows |
| [creatures/flock.ts](../../../src/shards/nalati-grasslands/creatures/flock.ts) | 394 | C4+C2 (proposed) | Draw sheep and bind cohesion, dog herding, prey death and weapon-ray shapes. | FlockBrain is adopted; removal needs sheep shader/posed draw conversion, not ambient flyer/forager substitution. [A8] | still convertible: look-graph + posed-draw |
| [runtime/state.ts](../../../src/shards/nalati-grasslands/runtime/state.ts) | 389 | C9 (proposed) | Order Titan/practice suppression, ride/stealth/night/weather and target clocks. | Shared installation hosts do not determine Nalati cross-system update order. [A3/A8] | shard-owned law |
| [ride/Mount.ts](../../../src/shards/nalati-grasslands/ride/Mount.ts) | 357 | C7+C6 (proposed) | Own physical horse gait, mounting, spurs and dismount state. | MountedBody/MountedReins have only Nalati consumers; no second riding shard. [A4] | shard-owned law |
| [combat/ghostRiders.ts](../../../src/shards/nalati-grasslands/combat/ghostRiders.ts) | 345 | C4 (proposed) | Own night rider lines, Qara encounter and ghost arrows. | Shared brains/line drivers do not own night identities and reward coupling. [A8/A9] | shard-owned law |
| [runtime/audio/synth.ts](../../../src/shards/nalati-grasslands/runtime/audio/synth.ts) | 330 | C8 (proposed) | Maintain procedural steppe voices and their persistent audio nodes. | Score-set lifecycle conversion does not replace persistent synth ownership (807a2d28e). [A9] | shard-owned law |
| [species/balbal.ts](../../../src/shards/nalati-grasslands/species/balbal.ts) | 314 | C4 (proposed) | Own stone-warrior pose, crack state, attacks and damage law. | No second stone warrior shares the combined policy/rig contract. [A8/A9] | shard-owned law |
| [models/campProps.ts](../../../src/shards/nalati-grasslands/models/campProps.ts) | 309 | C1 (proposed) | Bind named camp prop models to their baked specimens. | Camp geometry is offline; model catalogue/adoption is still local. [A9] | view code |
| [look/grass.ts](../../../src/shards/nalati-grasslands/look/grass.ts) | 308 | C2 (proposed) | Compose grass blade/flower geometry, height texture and painterly mood. | GrassField is adopted; remaining texture/flower assembly is Nalati presentation. [A9] | view code |
| [combat/goldenKing.ts](../../../src/shards/nalati-grasslands/combat/goldenKing.ts) | 306 | C4 (proposed) | Bind Golden King arena, reward, encounter and chamber handoff. | Phased boss host is shared; the remaining dungeon/reward binding is Nalati law. [A8/A9] | shard-owned law |
| [world/WeatherFX.ts](../../../src/shards/nalati-grasslands/world/WeatherFX.ts) | 297 | C3 (proposed) | Draw shelf clouds, horizon rain and storm illumination. | Storm simulation is shared; Nalati storm-deck presentation differs from Pine rain. [A9] | view code |
| [runtime/tamingLaw.ts](../../../src/shards/nalati-grasslands/runtime/tamingLaw.ts) | 296 | C7+C6 (proposed) | Run trust, bucking, bond and reward transitions against a live horse identity. | Other shards have no taming law; moving it would create a one-user host. [A4] | shard-owned law |
| [world/painted.ts](../../../src/shards/nalati-grasslands/world/painted.ts) | 291 | C1 (proposed) | Bind model specimens, generated assets and instance queues. | Shared loaders do not own Nalati painterly model/context bindings. [A9] | view code |
| [playground/HorsePlayground.ts](../../../src/shards/nalati-grasslands/playground/HorsePlayground.ts) | 264 | C7 (proposed) | Present the horse controls practice room and track. | The common playground supplies lifecycle, not this riding course. [A4] | view code |
| [world/placeBake.ts](../../../src/shards/nalati-grasslands/world/placeBake.ts) | 262 | C1 (proposed) | Adopt baked place buffers, cloth, colliders and floor handles. | Places are baked already; this is the Nalati layout/adoption contract. [A9] | view code |
| [look/skyRig.ts](../../../src/shards/nalati-grasslands/look/skyRig.ts) | 245 | C2 (proposed) | Apply steppe day keys, sky, lights and weather to the look. | Shared clock/atmosphere does not supply these painterly application bindings. [A9] | view code |
| [runtime/weapons/Naizagai.ts](../../../src/shards/nalati-grasslands/runtime/weapons/Naizagai.ts) | 236 | C6 (proposed) | Apply Storm Sabre charge and lightning power. | Shared sword/strike hosts do not define Titan reward power. [A9] | shard-owned law |
| [runtime/headlessMounted.ts](../../../src/shards/nalati-grasslands/runtime/headlessMounted.ts) | 232 | C7+C6 (proposed) | Bind the native physical rider, mountable roster and continuation. | Only Nalati mounts creatures; other traversal modes are not this contract. [A4] | shard-owned law |
| [weapons/nalatiSkins.ts](../../../src/shards/nalati-grasslands/weapons/nalatiSkins.ts) | 230 | C6 (proposed) | Award/equip elite skins and repaint the Sky-Marked saddle. | Equipment/save hosts exist; live saddle mask and reward mappings are Nalati-specific (a251a3cbf). [A9] | shard-owned law |
| [world/dressing/index.ts](../../../src/shards/nalati-grasslands/world/dressing/index.ts) | 226 | C1 (proposed) | Bind baked dressing placements, layer materials and instance colliders. | Placement bake bc2618cf9 removed scatter; local assembly survives. [A9] | view code |
| [stealth.ts](../../../src/shards/nalati-grasslands/stealth.ts) | 224 | C4 (proposed) | Compute crouch, grass concealment, downwind visibility and HUD cues. | No second shard shares Nalati grass/horse stealth semantics. [A8/A9] | shard-owned law |
| [world/paint.ts](../../../src/shards/nalati-grasslands/world/paint.ts) | 220 | C1 (proposed) | Construct and AO-paint static POI geometry. | Follow fixed-model paint bake b905a8549; preserve exact vertices, colours and material slots. [A9] | still convertible: offline geometry/paint bake |
| [creatures/sheepRaid.ts](../../../src/shards/nalati-grasslands/creatures/sheepRaid.ts) | 211 | C4 (proposed) | Run wolf raid, shepherd interception and raid outcome. | Pack/flock hosts do not define this shepherd-and-sheep encounter. [A8/A9] | shard-owned law |
| [world/Bowl.ts](../../../src/shards/nalati-grasslands/world/Bowl.ts) | 206 | C1 (proposed) | Assemble Kokpar, herd, lotus and glacier baked set pieces. | Static place producers exist; this is live set/material/anchor assembly. [A9] | view code |
| [ride/RideHUD.ts](../../../src/shards/nalati-grasslands/ride/RideHUD.ts) | 203 | C7 (proposed) | Draw horse stamina/trust, prompts and taming/riding atoms. | This is Nalati's own HUD; no engine RideHUD or second mounted consumer supplies it. [A4] | view code |
| [runtime/weapons/GoldenBow.ts](../../../src/shards/nalati-grasslands/runtime/weapons/GoldenBow.ts) | 200 | C6 (proposed) | Apply King's legendary bow charge and power behavior. | Shared bow/held hosts exist; legendary reward power remains a single-shard rule. [A9] | shard-owned law |
| [runtime/audio/sound.ts](../../../src/shards/nalati-grasslands/runtime/audio/sound.ts) | 198 | C8 (proposed) | Map hoof surfaces, animals, stampede and world zones to audio cues. | Mixer and cue hosts are shared; event/world-distance selection is Nalati-specific. [A9] | shard-owned law |
| [world/Spruce.ts](../../../src/shards/nalati-grasslands/world/Spruce.ts) | 196 | C1 (proposed) | Build painterly spruce crown/trunk geometry. | Follow offline body/dressing geometry pattern; live forest/material binding remains a separate concern. [A9] | still convertible: offline geometry/paint bake |
| [world/Lightning.ts](../../../src/shards/nalati-grasslands/world/Lightning.ts) | 190 | C4 (proposed) | Choose tall strike targets and apply storm/Titan lightning effects. | Storm cadence is shared; target/world consequences remain Nalati law. [A8/A9] | shard-owned law |
| [combat/balbalWarriors.ts](../../../src/shards/nalati-grasslands/combat/balbalWarriors.ts) | 186 | C4 (proposed) | Wake dusk statues, own warrior roster and cracks/reward transitions. | No second shard has dusk statue activation and stone-warrior ownership. [A8/A9] | shard-owned law |
| [runtime/index.ts](../../../src/shards/nalati-grasslands/runtime/index.ts) | 186 | C9 (proposed) | Install Nalati page owners, declared rows and scoped teardown. | Native boot assembly is shared; page lifecycle is still Nalati-specific. [A3/A8] | shard-owned law |
| [world/modelView.ts](../../../src/shards/nalati-grasslands/world/modelView.ts) | 181 | C1 (proposed) | Adopt prepared model buffers, painterly material and instances. | Fixed painting already moved offline (b905a8549); loading/ownership is native view code. [A9] | view code |
| [creatures/wildlife.ts](../../../src/shards/nalati-grasslands/creatures/wildlife.ts) | 180 | C4 (proposed) | Bind wild horse packs, Argymaq herd and page creature lifecycle. | Shared brains already steer; Nalati spawning, ownership and views remain local. [A8/A9] | shard-owned law |
| [runtime/headless.ts](../../../src/shards/nalati-grasslands/runtime/headless.ts) | 176 | C9 (proposed) | Compose native terrain, roster, weather/lightning and trample queries. | Lower-level hosts already exist; this environment/query wiring remains local. [A3/A8] | shard-owned law |
| [look/terrainPainter.ts](../../../src/shards/nalati-grasslands/look/terrainPainter.ts) | 174 | C2 (proposed) | Bind painterly terrain materials and signed trail distance. | Terrain host supplies ground, not Nalati paint/trail material assembly. [A9] | view code |
| [world/dressing/life.ts](../../../src/shards/nalati-grasslands/world/dressing/life.ts) | 174 | C3 (proposed) | Draw pollen, butterflies and circling raptors. | Ambient hosts do not yet replace this painterly multi-draw recipe. [A9] | view code |
| [world/index.ts](../../../src/shards/nalati-grasslands/world/index.ts) | 167 | C1 (proposed) | Bind POI owners, outcrops and effect updates. | Place bakes are used; runtime attachment composition remains. [A9] | view code |
| [runtime/weapons/mountedSword.ts](../../../src/shards/nalati-grasslands/runtime/weapons/mountedSword.ts) | 166 | C6 (proposed) | Combine on-foot sword with mounted pass-window hits. | No second mounted sword consumer (086d68e0d). [A9] | shard-owned law |
| [species/horse.ts](../../../src/shards/nalati-grasslands/species/horse.ts) | 162 | C4 (proposed) | Apply horse pose and bind saddle/eye joints. | Native pose host is shared; the horse rig and attachments remain specific. [A9] | view code |
| [world/installWeather.ts](../../../src/shards/nalati-grasslands/world/installWeather.ts) | 160 | C3 (proposed) | Order page clock, storm views, water lights, sound and lightning. | Shared cadence rows are adopted (c728e6278); page-specific world consequences remain. [A9] | shard-owned law |
| [src/game/systems/looks/grassField.ts](../../../src/game/systems/looks/grassField.ts)<br>sole-export 152 | 152 | C2 (proposed) | Draw the charged grass-field rings and material bindings. | Only Nalati-attributed declarations count; generic grass vocabulary is not another actual caller. [A9] | view code |
| [look/bake.ts](../../../src/shards/nalati-grasslands/look/bake.ts) | 152 | C2 (proposed) | Capture static shadow/contact textures for the painterly look. | Other shard look hosts do not share this orthographic bake target/scene lifecycle. [A9] | view code |
| [species/goldenKing.ts](../../../src/shards/nalati-grasslands/species/goldenKing.ts) | 151 | C4 (proposed) | Bind King's rig and boss-specific pose/think rules. | Shared boss phase machinery does not own this creature's attack pose policy. [A8/A9] | shard-owned law |
| [ride/ride.ts](../../../src/shards/nalati-grasslands/ride/ride.ts) | 150 | C7+C6 (proposed) | Compose rider, taming, reins, mode, naming and sound. | No second shard wires a mounted horse lifecycle. [A4] | shard-owned law |
| [world/dressing/layer.ts](../../../src/shards/nalati-grasslands/world/dressing/layer.ts) | 143 | C1 (proposed) | Render a scatter kind with instanced colour/shadow state. | Other cover hosts have different shader/material ownership. [A9] | view code |
| [campPeople.ts](../../../src/shards/nalati-grasslands/campPeople.ts) | 142 | C5 (proposed) | Own fallback batch, four capsules, child anchor and scoped skin adoption. | PosedDraw/pivotNpc do not adopt the skin/fallback/collider and detached-joint contract. [A6] | needs new shared ABI: figure/skin ownership |
| [adventure.ts](../../../src/shards/nalati-grasslands/adventure.ts) | 141 | C5 (proposed) | Poll taming/boss/cairn progress and carve first-missing balbal clues. | Story chapters already run shared hosts; killed-versus-retired and feather catch-up are Nalati rules. [A5] | shard-owned law |
| [runtime/looks/stormTitanGlsl.ts](../../../src/shards/nalati-grasslands/runtime/looks/stormTitanGlsl.ts) | 141 | C2 (proposed) | Shade Titan cloud and grass-fire effects. | Raw GLSL remains custom; smoke/river graph conversions demonstrate the lane pattern. [A9] | still convertible: look-graph |
| [world/Flutter.ts](../../../src/shards/nalati-grasslands/world/Flutter.ts) | 136 | C3 (proposed) | Draw all POI cloth as one wind-driven mesh. | Other cloth hosts do not share this instanced POI layout/wind presentation. [A9] | view code |
| [runtime/headlessTaming.ts](../../../src/shards/nalati-grasslands/runtime/headlessTaming.ts) | 135 | C7+C6 (proposed) | Connect native horse identity, taming clock and overlays. | The host must retain Nalati bond/reward ownership; no second consumer. [A4] | shard-owned law |
| [runtime/audio/SteppeAmbience.ts](../../../src/shards/nalati-grasslands/runtime/audio/SteppeAmbience.ts) | 133 | C8 (proposed) | Blend geographic beds, hold dominant zones and schedule seeded distant calls. | AmbienceZones owns bed mixing, but Nalati zone hysteresis, storm sink and independent call RNG remain local. [A9] | shard-owned law |
| [runtime/ghostRosterKeeper.ts](../../../src/shards/nalati-grasslands/runtime/ghostRosterKeeper.ts) | 132 | C4 (proposed) | Own night rider allocation, clocks and arrow continuation. | Generic roster does not express the line/projectile/identity save relationship as rows. [A3/A8] | needs new shared ABI: native actor + save ownership |
| [runtime/qaraKeeper.ts](../../../src/shards/nalati-grasslands/runtime/qaraKeeper.ts) | 132 | C4 (proposed) | Own Qara rider identity, line/arrow policy and kill counters. | Shared boss lanes do not define Nalati night-roster ownership. [A3/A8] | needs new shared ABI: native actor + save ownership |
| [ride/Reins.ts](../../../src/shards/nalati-grasslands/ride/Reins.ts) | 131 | C7 (proposed) | Draw reins between the live rider hands and horse bridle. | No second mounted rig exposes the same hand/bridle sockets. [A4] | view code |
| [species/hulls.ts](../../../src/shards/nalati-grasslands/species/hulls.ts) | 130 | C4 (proposed) | Load pre-skinned creature hulls and baked coat pages. | Coats are baked (a251a3cbf); loading/rig-fit presentation remains. [A9] | view code |
| [manifest.ts](../../../src/shards/nalati-grasslands/manifest.ts) | 120 | C9 (proposed) | Declare shard metadata and bind native callbacks, asset identities and derived lists. | Follow generated boot metadata/declaration-only manifest pattern: move pure lists/maps to admitted data while retaining explicit native bindings; do not treat all metadata as an irreducible law. [A9] | still convertible: declaration-only manifest + authored rows |
| [runtime/ghostLineKeeper.ts](../../../src/shards/nalati-grasslands/runtime/ghostLineKeeper.ts) | 119 | C4 (proposed) | Bind one admitted ghost line to roster-owned body/death state. | Line driving is shared, but body allocation and night ownership remain local. [A3/A8] | needs new shared ABI: native actor + save ownership |
| [runtime/headlessRaid.ts](../../../src/shards/nalati-grasslands/runtime/headlessRaid.ts) | 116 | C4 (proposed) | Own sheep-raid timer, prey/pack bindings and shepherd continuation. | Shared pack/flock brains do not own Nalati's raid identity and strike counters. [A3/A8] | needs new shared ABI: native actor + save ownership |
| [look/sky.ts](../../../src/shards/nalati-grasslands/look/sky.ts) | 114 | C2 (proposed) | Draw the 360-degree sky dome with scoped texture loading. | Other backdrops do not consume this exact panorama/grade binding. [A9] | view code |
| [look/dayKeys.ts](../../../src/shards/nalati-grasslands/look/dayKeys.ts) | 113 | C2 (proposed) | Interpolate steppe numeric light/sky keyframes. | Existing channel programs can own key interpolation when exact clock, colour and consumer bindings are represented; retain parity before deleting the native module. [A9] | still convertible: channel-program key rows |
| [runtime/groups.ts](../../../src/shards/nalati-grasslands/runtime/groups.ts) | 110 | C4 (proposed) | Bind wild, pack and Argymaq group identities to the native environment. | Group hosts are used already; the remaining group/save relationships are Nalati-specific. [A3/A8] | needs new shared ABI: native actor + save ownership |
| [models/dressing.ts](../../../src/shards/nalati-grasslands/models/dressing.ts) | 107 | C1 (proposed) | Bind fitted rock/scatter model specimens and painterly materials. | Offline paint is used; remaining model/material contract is local. [A9] | view code |
| [combat/stormTitanLook.ts](../../../src/shards/nalati-grasslands/combat/stormTitanLook.ts) | 102 | C2 (proposed) | Bind Titan cloud patching and grass-fire view effects. | The effect look is single-shard; graph conversion can shrink shading separately. [A9] | view code |
| [src/engine/world/geometryKit.ts](../../../src/engine/world/geometryKit.ts)<br>sole-export 101 | 101 | C1 (proposed) | Provide the charged smooth primitive/loft builders used by Nalati paint. | Move the remaining static consumers through the existing prepared-geometry/paint bake; only sole-user declarations are charged, not the whole shared kit. [A9] | still convertible: offline geometry/paint bake |
| [src/sdk/compileScript.ts](../../../src/sdk/compileScript.ts)<br>sole-export 97 | 97 | C9 (proposed) | Compile and instrument the charged AssemblyScript author module. | Source inspection finds Nalati use in generators/qara.ts, so this charge needs a G467 ruler/reach audit; it is not an accepted runtime floor and does not justify a gameplay host. [A9] | still convertible: G467 build-reach attribution audit |
| [models/gear.ts](../../../src/shards/nalati-grasslands/models/gear.ts) | 97 | C1 (proposed) | Bind spear, bow, sabre and rifle model specimens. | Held geometry is baked; model/specimen adapters remain. [A9] | view code |
| [species/ghostRider.ts](../../../src/shards/nalati-grasslands/species/ghostRider.ts) | 96 | C4 (proposed) | Own ghost rider behavior and rider/horse presentation bindings. | Generic herd/brain rows do not replace the night rider policy. [A8/A9] | shard-owned law |
| [combat/nightFx.ts](../../../src/shards/nalati-grasslands/combat/nightFx.ts) | 93 | C3 (proposed) | Draw pooled night motes and spark sprites. | ParticlePool already owns pooling; local visual recipe remains. [A9] | view code |
| [combat/goldenKingViews.ts](../../../src/shards/nalati-grasslands/combat/goldenKingViews.ts) | 92 | C3 (proposed) | Draw chamber pours, niches, rings, shafts and victory lighting. | Shared FX primitives do not supply this encounter view composition. [A9] | view code |
| [runtime/baked.ts](../../../src/shards/nalati-grasslands/runtime/baked.ts) | 89 | C9 (proposed) | Validate native terrain, solids and creature bake queries. | Shared native bake reader does not define the Nalati bake contract. [A3/A8] | shard-owned law |
| [creatures/marmots.ts](../../../src/shards/nalati-grasslands/creatures/marmots.ts) | 86 | C4 (proposed) | Draw ambient sentry colonies on their forager host. | ForagerPopulation is adopted; local marmot geometry/material binding remains. [A9] | view code |
| [kokpar.ts](../../../src/shards/nalati-grasslands/kokpar.ts) | 86 | C5 (proposed) | Run mounted goat pickup/theft, scoring, drops and round reset. | No second shard has mounted goat rounds; a generic timer would leave the actual decisions local. [A5] | shard-owned law |
| [layout.ts](../../../src/shards/nalati-grasslands/layout.ts) | 86 | C1 (proposed) | Compute river/snow-valley layout profile queries. | Static samples/rows can use existing ground bake; do not replace live query laws with const mirrors. [A9] | still convertible: offline ground/layout rows |
| [models/ambientLife.ts](../../../src/shards/nalati-grasslands/models/ambientLife.ts) | 86 | C1 (proposed) | Expose ambient butterfly and raptor model specimens. | Model registry is shared; local geometry/rig/specimen bindings remain. [A9] | view code |
| [runtime/looks/skyGlsl.ts](../../../src/shards/nalati-grasslands/runtime/looks/skyGlsl.ts) | 85 | C2 (proposed) | Shade the painterly sky dome. | Raw GLSL remains custom; use the established look.materials graph path. [A9] | still convertible: look-graph |
| [src/game/plugin/weaponFamily.ts](../../../src/game/plugin/weaponFamily.ts)<br>sole-export 83 | 83 | C6 (proposed) | Own the attributed sabre hook phase/damage lane and installation contract. | Nalati is the only real declared weapon-hook consumer for these charged declarations; another weapon or a generic name is not a second shard user. [A9] | shard-owned law |
| [models/signpost.ts](../../../src/shards/nalati-grasslands/models/signpost.ts) | 83 | C1 (proposed) | Build lettering atlas and carved signpost geometry. | Follow generated atlas/specimen pattern; native material reader stays. [A9] | still convertible: offline geometry/paint bake |
| [species/bodies.ts](../../../src/shards/nalati-grasslands/species/bodies.ts) | 83 | C4 (proposed) | Adopt baked body lanes and preserve renderer-owned geometry. | Geometry is already offline; runtime buffer/rig ownership remains. [A9] | view code |
| [species/wolf.ts](../../../src/shards/nalati-grasslands/species/wolf.ts) | 82 | C4 (proposed) | Apply canid-specific post-pose details. | Shared canid rig does not own Nalati coat/pose application. [A9] | view code |
| [world/solid.ts](../../../src/shards/nalati-grasslands/world/solid.ts) | 80 | C1 (proposed) | Convert Nalati static support hulls and slab collision descriptions. | Physics host owns collision; local shape conversion remains tied to authored place data. [A9] | view code |

## Nine Dragon Stack

All custom: **14,414**; listed ≥80-line file contributions: **10,491** in **48 files**; below-threshold tail: **3,923**. AssemblyScript separately: 0 lines. Component labels below are proposed job owners.

| File / charged unit | Custom lines | Component | Law or view responsibility | Why the current shared host does not remove it / evidence | Proposed tag |
|---|---:|---|---|---|---|
| [runtime/looks/look.ts](../../../src/shards/nine-dragon-stack/runtime/looks/look.ts) | 880 | C2 (proposed) | Shade Jiehua architecture and neon. | Graph conversion lane is active; preserve paint/light splice semantics. [A9] | still convertible: look-graph |
| [runtime/looks/facadeLook.ts](../../../src/shards/nine-dragon-stack/runtime/looks/facadeLook.ts) | 577 | C2 (proposed) | Shade Nine facade architecture. | Raw shader program remains counted; follow admitted look.materials graph conversions. [A9] | still convertible: look-graph |
| [runtime/looks/passes.ts](../../../src/shards/nine-dragon-stack/runtime/looks/passes.ts) | 525 | C2 (proposed) | Define bleed, reflections and halo post shader programs. | Follow graph conversion with real post-chain parity. [A9] | still convertible: look-graph |
| [runtime/tools/grappleAim.ts](../../../src/shards/nine-dragon-stack/runtime/tools/grappleAim.ts) | 376 | C7 (proposed) | Select hook targets, line/zip view and capsule landing policy. | FeiZhua is its sole user; cable traversal is not free aim plus hook validation. [A9] | shard-owned law |
| [runtime/viewmodel/fpArmsRig.ts](../../../src/shards/nine-dragon-stack/runtime/viewmodel/fpArmsRig.ts) | 334 | C6 (proposed) | Play two arm channels and publish live sockets, lag and cloth attachments. | Other held rigs do not consume its channel/cloth socket ABI. [A9] | view code |
| [runtime/signs/signAtlas.ts](../../../src/shards/nine-dragon-stack/runtime/signs/signAtlas.ts) | 329 | C1 (proposed) | Rasterize calligraphy and pack sign atlases/boards. | Follow emitted atlas/placement metadata pattern; preserve font and pixel parity. [A9] | still convertible: offline geometry/atlas bake |
| [runtime/looks/strandCloth.ts](../../../src/shards/nine-dragon-stack/runtime/looks/strandCloth.ts) | 328 | C3 (proposed) | Step constrained tassel/sheet points and collide them with held capsules. | No second runtime consumer shares this held-cloth stepping contract. [A9] | view code |
| [world/build.ts](../../../src/shards/nine-dragon-stack/world/build.ts) | 311 | C1 (proposed) | Compose square, Well, towers, crowd, cullers and live view owners. | Layout is baked; remaining scene/material/owner assembly is not a static generator. [A9] | view code |
| [runtime/looks/vmLook.ts](../../../src/shards/nine-dragon-stack/runtime/looks/vmLook.ts) | 309 | C2 (proposed) | Define class palettes and toon/ink viewmodel shaders. | Look graph lane can delete shader modules; live rig/channel code remains counted. [A9] | still convertible: look-graph |
| [runtime/signs/neonText.ts](../../../src/shards/nine-dragon-stack/runtime/signs/neonText.ts) | 296 | C2 (proposed) | Draw SDF calligraphy fill, rim, halo and tube boards. | Atlas baking can shrink input work; local neon material/draw composition remains. [A9] | view code |
| [runtime/tools/hookCourse.ts](../../../src/shards/nine-dragon-stack/runtime/tools/hookCourse.ts) | 273 | C7 (proposed) | Present hook pads, targets and grapple practice progression. | Playground lifecycle is shared; the hook course has one user. [A9] | view code |
| [runtime/kit/ruledKit.ts](../../../src/shards/nine-dragon-stack/runtime/kit/ruledKit.ts) | 260 | C1 (proposed) | Build face-metric quad kit geometry. | Follow baked layout/specimen outputs; retain only native geometry adoption after all consumers convert. [A9] | still convertible: offline geometry/atlas bake |
| [runtime/kit/tangentKit.ts](../../../src/shards/nine-dragon-stack/runtime/kit/tangentKit.ts) | 251 | C1 (proposed) | Build tangent/face-coordinate surface geometry. | Can follow generated mesh buffers once runtime material/geometry consumers are split. [A9] | still convertible: offline geometry/atlas bake |
| [src/game/plugin/mover.ts](../../../src/game/plugin/mover.ts)<br>sole-export 239 | 239 | C7 (proposed) | Own attributed mounted-body, reins, spur and road-steering laws. | All real mounted/reins consumers remain Nalati; other traversal modes are not a second riding user. [A4] | shard-owned law |
| [runtime/looks/renderPass.ts](../../../src/shards/nine-dragon-stack/runtime/looks/renderPass.ts) | 228 | C2 (proposed) | Allocate and execute declared post-pass targets and uniforms. | Other shards do not use this pass-row target/pack/camera contract today. [A9] | view code |
| [runtime/kit/sweptKit.ts](../../../src/shards/nine-dragon-stack/runtime/kit/sweptKit.ts) | 226 | C1 (proposed) | Build shaped sweeps, ellipsoids and curved kit pieces. | Existing build producers can own static geometry; live viewmodel consumers need separation first. [A9] | still convertible: offline geometry/atlas bake |
| [runtime/cull/instanceCuller.ts](../../../src/shards/nine-dragon-stack/runtime/cull/instanceCuller.ts) | 225 | C1 (proposed) | Pack per-instance world batches into visible distance levels. | Other shard cover streamers have different allocation/LOD ownership. [A9] | view code |
| [runtime/kit/classKit.ts](../../../src/shards/nine-dragon-stack/runtime/kit/classKit.ts) | 222 | C6 (proposed) | Build close-up class-mapped geometry and swept viewmodel pieces. | Emit the same named buffers through existing geometry/model readers and retain only live arm/cloth channels; the static builder is not an irreducible law. [A9] | still convertible: offline viewmodel-part bake |
| [runtime/looks/light.ts](../../../src/shards/nine-dragon-stack/runtime/looks/light.ts) | 220 | C2 (proposed) | Define light-volume, pool and halo shader terms. | Graph conversion must preserve shared uniforms and emitter bindings. [A9] | still convertible: look-graph |
| [runtime/looks/streaks.ts](../../../src/shards/nine-dragon-stack/runtime/looks/streaks.ts) | 211 | C2 (proposed) | Shade wet-ground reflection streak cards. | Follow instanced-card material graph pattern. [A9] | still convertible: look-graph |
| [src/game/systems/viewmodel/armRig.ts](../../../src/game/systems/viewmodel/armRig.ts)<br>sole-module 205 | 205 | C6 (proposed) | Solve and measure the charged two-bone arm/wrist geometry and joint limits. | Nine alone reaches this arm contract through fpArmsRig; other held arms do not provide the same wrist/measurement ABI. [A9] | view code |
| [look/render.ts](../../../src/shards/nine-dragon-stack/look/render.ts) | 199 | C2 (proposed) | Compose Jiehua effects, native frame loans and floor reflection draws. | Engine composition exists; the Nine-specific post graph and resource lifecycle remain. [A9] | view code |
| [runtime/looks/ropeFilament.ts](../../../src/shards/nine-dragon-stack/runtime/looks/ropeFilament.ts) | 195 | C7 (proposed) | Draw a fixed-step Verlet filament between moving hook endpoints. | No second shard uses this endpoint/solver presentation contract. [A9] | view code |
| [runtime/signs/glyphField.ts](../../../src/shards/nine-dragon-stack/runtime/signs/glyphField.ts) | 192 | C1 (proposed) | Rasterize glyphs and generate signed distance fields. | Move deterministic font/atlas output offline with exact metrics; retain texture reader. [A9] | still convertible: offline geometry/atlas bake |
| [world/layoutBake.ts](../../../src/shards/nine-dragon-stack/world/layoutBake.ts) | 190 | C1 (proposed) | Restore baked architecture, signs and placement queues. | Static build is offline; this binds the Nine layout/material contract. [A9] | view code |
| [runtime/looks/canopy.ts](../../../src/shards/nine-dragon-stack/runtime/looks/canopy.ts) | 181 | C2 (proposed) | Define canopy card/leaf/core shader programs. | Convert shader family to look.materials graph data with coverage/depth parity. [A9] | still convertible: look-graph |
| [runtime/looks/burstFx.ts](../../../src/shards/nine-dragon-stack/runtime/looks/burstFx.ts) | 179 | C3 (proposed) | Draw deterministic one-shot sparks and flash bursts. | Common FX primitives do not replace these local materials and timed draws. [A9] | view code |
| [runtime/looks/vertexSpill.ts](../../../src/shards/nine-dragon-stack/runtime/looks/vertexSpill.ts) | 174 | C2 (proposed) | Bake light-emitter spill into merged geometry colours. | Static spill can move offline after exact emitter/geometry inputs qualify; live material binding stays local. [A9] | view code |
| [runtime/looks/hangingLanterns.ts](../../../src/shards/nine-dragon-stack/runtime/looks/hangingLanterns.ts) | 160 | C3 (proposed) | Cull and draw near/far/dot lantern levels from hook rows. | Shared instancing is used; lantern geometry/material/LOD ownership is specific. [A9] | view code |
| [vm/fpArms.ts](../../../src/shards/nine-dragon-stack/vm/fpArms.ts) | 150 | C6 (proposed) | Bind Nine arm clips, weapon holds, halos and live cloth. | Arm geometry can be baked; per-frame channel and attachment ownership stays local. [A9] | view code |
| [data/signs.ts](../../../src/shards/nine-dragon-stack/data/signs.ts) | 149 | C2 (proposed) | Define sign/calligraphy/atlas authoring row shapes. | Only Nine consumes this lettering contract; no simulation host can remove a presentation type boundary. [A9] | view code |
| [plugin.ts](../../../src/shards/nine-dragon-stack/plugin.ts) | 149 | C9 (proposed) | Order Nine world, tools, portals and native/page lifecycle. | Native assembly is already declared (682af4048); page install/teardown remains local. [A9] | shard-owned law |
| [runtime/kit/propGlb.ts](../../../src/shards/nine-dragon-stack/runtime/kit/propGlb.ts) | 149 | C1 (proposed) | Fit generated GLB props to kit geometry and colour slots. | Prepared-model bake pattern can own the static fitting; material adoption remains native. [A9] | still convertible: offline geometry/atlas bake |
| [runtime/looks/heroVm.ts](../../../src/shards/nine-dragon-stack/runtime/looks/heroVm.ts) | 145 | C2 (proposed) | Shade the hero viewmodel and ink hull. | Follow look.materials graph conversion while preserving decals and held lighting. [A9] | still convertible: look-graph |
| [src/game/plugin/simulation.ts](../../../src/game/plugin/simulation.ts)<br>sole-export 143 | 143 | C9 (proposed) | Run the charged entryway/socket-lift proof functions and their port types. | Nine boot/headlessModules.ts reaches proveEntryways; these proof-only charges need import-admission isolation through the native module-map generation path, not a claimed gameplay-law exemption. [A9] | still convertible: proof module-map generation |
| [runtime/portals/walkInRide.ts](../../../src/shards/nine-dragon-stack/runtime/portals/walkInRide.ts) | 140 | C7 (proposed) | Transfer through road rings and preserve return-edge arrival/fade state. | No second shard has this ring-entry/return-edge policy. [A9] | shard-owned law |
| [manifest.ts](../../../src/shards/nine-dragon-stack/manifest.ts) | 116 | C9 (proposed) | Declare shard metadata and bind native callbacks, asset identities and derived lists. | Follow generated boot metadata/declaration-only manifest pattern: move pure lists/maps to admitted data while retaining explicit native bindings; do not treat all metadata as an irreducible law. [A9] | still convertible: declaration-only manifest + authored rows |
| [runtime/looks/paint.ts](../../../src/shards/nine-dragon-stack/runtime/looks/paint.ts) | 113 | C2 (proposed) | Define paint-layer sampling and flagstone shader equations. | Graph conversion must retain texture-array and face-coordinate contracts. [A9] | still convertible: look-graph |
| [runtime/cull/figureCrowd.ts](../../../src/shards/nine-dragon-stack/runtime/cull/figureCrowd.ts) | 111 | C1 (proposed) | Cull static figures by colourway and visibility. | No second shard consumes this baked crowd/colourway contract. [A9] | view code |
| [world/facade/batch.ts](../../../src/shards/nine-dragon-stack/world/facade/batch.ts) | 107 | C1 (proposed) | Assemble instanced facade fabric and cull its level draws. | Instancing is shared; facade kit/material/level composition remains Nine presentation. [A9] | view code |
| [runtime/viewmodel/brushTrail.ts](../../../src/shards/nine-dragon-stack/runtime/viewmodel/brushTrail.ts) | 106 | C6 (proposed) | Draw the Jian flying-white slash ribbon. | Shared SlashTrail samples geometry; local brush look/composition remains. [A9] | view code |
| [runtime/looks/scroll.ts](../../../src/shards/nine-dragon-stack/runtime/looks/scroll.ts) | 101 | C2 (proposed) | Shade the LED handscroll sky screens. | Existing graph host can express material math; preserve scroll texture/time inputs. [A9] | still convertible: look-graph |
| [runtime/looks/lightVolume.ts](../../../src/shards/nine-dragon-stack/runtime/looks/lightVolume.ts) | 95 | C2 (proposed) | Bake/capture the light-pool irradiance volume. | Offline conversion needs exact emitter and scene inputs; native texture binding remains local. [A9] | view code |
| [runtime/looks/lanterns.ts](../../../src/shards/nine-dragon-stack/runtime/looks/lanterns.ts) | 86 | C2 (proposed) | Shade red lantern near/far/dot representations. | Follow graph conversion; preserve distance and glow equivalence. [A9] | still convertible: look-graph |
| [runtime/audio/ambience.ts](../../../src/shards/nine-dragon-stack/runtime/audio/ambience.ts) | 85 | C8 (proposed) | Blend market/Well ambience with the six-metre boundary law. | Audio-zone host is used already; geographic blend remains Nine-specific. [A9] | view code |
| [runtime/geometry.ts](../../../src/shards/nine-dragon-stack/runtime/geometry.ts) | 85 | C1 (proposed) | Adopt baked layout/specimen geometry and named owner lanes. | Geometry is offline already; admission and native material ownership remain local. [A9] | view code |
| [src/engine/audio/AmbienceBeds.ts](../../../src/engine/audio/AmbienceBeds.ts)<br>sole-module 83 | 83 | C8 (proposed) | Own Nine sampled-bed lifetimes and nearest-lantern loop selection/panning. | Nine alone uses this bed/positional-loop contract; Nalati uses AmbienceZones directly with distinct storm/zone/call clocks. Current callbacks are not a two-shard data-only host. [A9] | shard-owned law |
| [runtime/cull/meshLod.ts](../../../src/shards/nine-dragon-stack/runtime/cull/meshLod.ts) | 83 | C1 (proposed) | Choose mesh simplification from phone pixel error. | May move offline where exact outputs qualify, but current LOD policy has one shard user. [A9] | view code |

## Sky Reach

All custom: **1,482**; listed ≥80-line file contributions: **221** in **2 files**; below-threshold tail: **1,261**. AssemblyScript separately: 53 lines. Ruler unknown-owner units: 49.

| File / charged unit | Custom lines | Component | Law or view responsibility | Why the current shared host does not remove it / evidence | Proposed tag |
|---|---:|---|---|---|---|
| [runtime/index.ts](../../../src/shards/far-reach/runtime/index.ts) | 125 | C1 38, C2 6, C3 4, C5 4, C6 5, C9 68 | Assemble Sky's wind/gust fields, hover dress, ray wake and gale wall draws. | Native headless assembly cannot own the page lifecycle; moving into plugin.ts would not cut custom code. [A10] | view code |
| [world/build.ts](../../../src/shards/far-reach/world/build.ts) | 96 | C1 87, C2 5, C5 4 | Bind baked islands, hover decks, lifts and crown-storm view owners. | Static layout is baked; live material/attachment assembly remains local. [A10] | view code |

## Signal Dunes

All custom: **1,500**; listed ≥80-line file contributions: **215** in **2 files**; below-threshold tail: **1,285**. AssemblyScript separately: 118 lines. Ruler unknown-owner units: 44.

| File / charged unit | Custom lines | Component | Law or view responsibility | Why the current shared host does not remove it / evidence | Proposed tag |
|---|---:|---|---|---|---|
| [data/fireLook.ts](../../../src/shards/sunscar-dunes/data/fireLook.ts) | 131 | C2 131 | Author Signal fire material graph nodes and tuning. | Graphs are already data; if every consumer is build-only, move the complete author module into generators and ship its graph JSON, as G467 permits. [A10] | still convertible: build-only look-graph authoring |
| [data/whip.ts](../../../src/shards/sunscar-dunes/data/whip.ts) | 84 | C1 3, C2 11, C5 1, C6 25, C9 44 | Define cord, braid, coil and held-lash presentation row shapes. | The held-family host already consumes data; the remaining Signal cord/view contract is not a second-shard ABI. [A10] | view code |

## Totals and reconciliation

Each source contribution is counted once. A platform file may appear for different shards only for different sole-user declarations; shared declarations are not charged wholesale. The totals below do not claim the tail is irreducible.

| Shard | All custom | Listed files | Listed lines | Below 80 / unclassified | AS separately |
|---|---:|---:|---:|---:|---:|
| Pine Hollow | 10,831 | 44 | 7,139 | 3,692 | 317 |
| Driftwood Isle | 6,662 | 17 | 2,634 | 4,028 | 96 |
| Nalati Grasslands | 22,021 | 86 | 17,922 | 4,099 | 162 |
| Nine Dragon Stack | 14,414 | 48 | 10,491 | 3,923 | 0 |
| Sky Reach | 1,482 | 2 | 221 | 1,261 | 53 |
| Signal Dunes | 1,500 | 2 | 215 | 1,285 | 118 |
| **Total** | **56,910** | **199** | **38,622** | **18,288** | **746** |

Per tag, listed contributions only (not an exemption allowance):

| Tag | Pine Hollow | Driftwood Isle | Nalati Grasslands | Nine Dragon Stack | Sky Reach | Signal Dunes | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| view code | 3,445 | 1,042 | 5,335 | 4,268 | 221 | 84 | 14,395 |
| shard-owned law | 2,698 | 1,059 | 8,559 | 987 | 0 | 0 | 13,303 |
| needs new shared ABI | 739 | 533 | 1,245 | 0 | 0 | 0 | 2,517 |
| still convertible | 257 | 0 | 2,783 | 5,236 | 0 | 131 | 8,407 |

Named ABI / conversion-pattern subtotals:

| Proposed ABI or pattern | Listed custom lines |
|---|---:|
| needs new shared ABI: figure/skin ownership | 142 |
| needs new shared ABI: native actor + save ownership | 2,375 |
| still convertible: G467 build-reach attribution audit | 97 |
| still convertible: authored JSON layout rows | 90 |
| still convertible: authored JSON sky rows | 81 |
| still convertible: build-only look-graph authoring | 131 |
| still convertible: channel-program key rows | 113 |
| still convertible: declaration-only manifest + authored rows | 236 |
| still convertible: look-graph | 3,574 |
| still convertible: look-graph + posed-draw | 394 |
| still convertible: offline geometry/atlas bake | 1,407 |
| still convertible: offline geometry/paint bake | 1,343 |
| still convertible: offline ground/layout rows | 490 |
| still convertible: offline pickup-model bake | 86 |
| still convertible: offline viewmodel-part bake | 222 |
| still convertible: proof module-map generation | 143 |

## Recommended switch-point decision and next designs

**List the audited shard-owned laws as custom under the G466 bar.** Keep
their numerator and explicit source owners; record Jake's decision in the
plan before describing their components as closed. List view spans
separately, particularly in mixed modules. The C3 review's historical
80-line allowance is not permission to exempt every file tagged view here.
The ≥80-line threshold is a review scope, not a cap or an exemption for
smaller files. Continue whole-module conversions where the table names a
real path; do not use this ledger to stop those lanes or claim 100/0.

Three boundaries are worth design effort at the next switch point:

1. **Native actor + save ownership ABI:** use Pine and Driftwood as the
   first paired adoption, with Nalati as a third real test. Describe actor
   identity allocation/adoption, dormant versus retired bodies, auxiliary
   handles, group/encounter ownership, RNG draw order and versioned saved
   envelopes. Roster materialize/retire already exists; a new callback bag
   would not solve the residual. Keep encounter decisions local until a
   data/decision-runtime contract genuinely expresses them. Gate the first
   paired landing with old-save continuation and ID/RNG-order parity.
2. **Figure/skin ownership ABI:** use Nalati camp figures and Pine posed
   people as the design pair, with actual second-shard adoption required
   before landing an extended host. Define fallback-to-generated skin
   replacement, scoped async cancellation, owned joint/socket publication,
   kinematic/capsule anchors and prompt positions. Existing rigid pivot
   NPCs and PosedDraw do not establish this ABI. Camp atlas/fallback bakes
   have already removed static work; retain child/attention policy as law
   unless a real second user shares it.
3. **Look-graph conversion contract:** finish converting remaining Nine
   and Nalati raw shader families through the existing graph/material and
   card/posed-draw hosts. This is primarily an existing-ABI conversion
   lane, not a justification for a new generic renderer. Only design an
   extension for a demonstrated two-shard gap (for example, matching
   post-pass/resource or skin/pose inputs). Preserve each shard's style;
   require shader/geometry/phone parity and a labelled phone board when
   the look changes. Smoke/river/storm-FX conversions are precedents, not
   proof that all remaining shaders are already representable.

These are recommendations, not new work queues or accepted exceptions.
The coordinator keeps ownership and acceptance in SHARD-PLATFORM. No game
code, Debug variants, screenshots, runtime detours or admission-only cuts
are part of this ledger.

