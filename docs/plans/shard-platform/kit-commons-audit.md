# The kit audit and the commons design (SF54 / SF26 proposal)

**State:** proposal, 2026-10-04, for Jake's pick on the commons form (G137). Read-only audit at `24d0b2674` plus the
working tree; nothing here has moved yet.

Jake's ask: *"make an audit and review of what's in the kit workspace and how it would be a shared commons package built
on top of the sdk aka it helps people generate the shard files. Could be shared code for WASM or other extension points
too right. Or shared scripts for generating quest nodes or whatever"*. The decisions it works under: G135 (the kit
package dissolves; every shard file imports only `@wildshard/sdk`), G136 (80 % on the SDK, 20 % `runtime/` with no shared
kit dependency), G137 (a shared commons package, form open), G6 (commons cached across shards), G8 (standard rigs and a
clip library), G29 / §3.4 (versioning), MMO-REQUIREMENTS decisions 6–20 (constraints, not mechanisms; authors invent
mechanics; one path for every author; full server authority; AssemblyScript first).

**Units.** "Lines" = physical / code (non-blank, non-comment, which is what `scripts/shard-platform.mjs` counts). The kit
is **62 files, 9,317 physical / 7,293 code lines** (the plan's "~7.3k"). Shard slugs: DW `driftwood-isle`, FR `far-reach`
(Sky Reach), NA `nalati-grasslands`, ND `nine-dragon-stack`, PH `pine-hollow`, SD `sunscar-dunes` (Signal Dunes).
"Boot" = `src/entry.ts`, the composition root, which installs kit content for **every** shard before any shard loads.

## Summary

| Class | Files | Code lines | Share |
|---|---:|---:|---:|
| (a) SDK system: platform behaviour shards reach through the SDK | 19 | 2,246 | 31 % |
| (b) commons generator: build-time code that makes models, rigs, props | 10 | 2,369 | 32 % |
| (c) commons data / assets: rows, profiles, sounds, icons, clip maps | 19 | 648 | 9 % |
| (d) commons script library: AssemblyScript modules, authoring generators | 0 | 0 | 0 % |
| (e) one shard's own code (used by exactly one shard) | 11 | 1,998 | 27 % |
| (f) delete | 3 | 32 | 0.4 % |
| **Total** | **62** | **7,293** | |

- The kit has **no** AssemblyScript and no authoring generators today. Class (d) is filled from the shards' own
  `behaviour/` folders: `driftwood-isle/behaviour/bridge.as` and `far-reach/behaviour/bridges.as` are **byte-identical**
  (`cmp`), and all nine `.as` modules repeat the same ABI-v0 prelude (`abi_version`, `init`, `in_ptr`, `in_cap`, `out_ptr`,
  `out_cap`, `out_count`).
- **A quarter of the kit breaks its own rule.** ENGINE.md says the kit is "shared content, used by 2+ shards". 11 files
  (1,998 lines) are used by one shard. The measure already charges most of them to that shard as "kit-only" custom lines
  (DW 153, NA 652, ND 205, PH 1,696; PH's figure also includes 514 lines that boot installs for every shard).
- **The kit is a runtime class library.** 28 of the 60 `.ts` files import three.js as a value, 3 touch the DOM, 8 read the
  `app` runtime singleton or `Settings`, and 46 import engine or game modules the SDK does not expose. Shards **subclass** it in
  4 places (`Sabre extends Sword`, `Spear extends Melee`, `GoldenBow extends Bow`, `LeverRifle extends Firearm`). This is
  the "shared kit dependency" G136 bans. Renaming it `@wildshard/sdk/runtime` would only hide it.
- **The shardfile already has the commons wiring.** `requires.commons` plus `commons:<sha256>` references are validated
  in `schema.ts`, `clientScripts.ts` and `items.ts`. The client's content store is keyed by hash (`product.ts:110`), so a
  commons file downloads once for every shard that uses it. Commons residency claims are platform-owned
  (`clientLibrary.ts:19-22`). The shardfile also resolves platform behaviour by **string id**: `family: "kit.melee"`,
  view recipe `kit.sword`, voice `kit.swordSwing`, creature look `kit.look.boar`. The ids are injected at boot. That id
  path is the seam the commons and the SDK systems need. What's missing is the entries themselves, and a package to own
  them.

## 1. Inventory

Columns:

- **Used by**: direct `@wildshard/kit` import sites per shard (×n = files); "+reach" = shards that reach the module only
  through another kit module.
- **When**: R = runtime, B = build time, R→B = runtime today but could run at build time.
- **Touches**: 3 = three.js value import (t = type only), D = DOM, E = engine/game imports, value / type-only (`E4/2`),
  A = `app` runtime singleton or `Settings`.

102 import statements in 64 shard files: DW 15 in 11 files, FR 2 in 2, NA 37 in 23, ND 7 in 5, PH 39 in 21, SD 2 in 2.
Six of those files are in `runtime/`. Outside the shards: boot imports 11 kit modules, `test/setup.ts` 4, and 58 test
files and 9 scripts read kit paths.

| Module | Lines | What it is | Used by | When | Touches |
|---|---|---|---|---|---|
| audio/combatCues | 29 / 27 | runtime: maps weapon voices to the engine's combat cue map | boot | R | E0/1 |
| audio/creatureVoices | 125 / 111 | asset recipe: synthesized boar / crab / monkey / sailor barks | DW×1 | R→B | E1 |
| audio/forest | 23 / 20 | data: forest ambience bed + silent-score profile | FR×1, SD×1 | R | E0/3 |
| audio/weaponVoices | 40 / 34 | runtime: the `kit.*` weapon voice registry | FR×1, NA×1, PH×2, SD×1, boot | R | E0/2 |
| bag/items | 13 / 12 | data: platform Bag item rows (`KIT_ITEMS`) | boot | R | – |
| effects/bindings | 26 / 23 | runtime: status effects → player movement lock / scale | PH (reach) | R | 3, E0/4 |
| effects/install | 31 / 30 | runtime: Debug row "Apply effect" (E357) + status icon widget | PH×1 | R | t, E0/3 |
| effects/starter | 21 / 18 | data: stun / burn / poison / bleed / slow `EffectDef` rows | PH×1 | R | E0/1 |
| effects/view + status.css | 35+3 / 35 | UI: HUD status icons | PH (reach) | R | D, E0/1 |
| icons + icons.merge.d.ts | 239+48 / 226 | data + UI: the content SVG icon set and `BAG_ICONS`, merged into `IconMap` | boot (every Bag) | R | E1/1, game |
| items/declared | 73 / 71 | runtime: the shardfile item families `kit.melee` / `kit.lantern`, views `kit.whip/sword/lantern` | boot (template) | R | 3, E2/3 |
| lookApi | 8 / 5 | shim: lazy loaders for grass / trample / particles | NA×2, PH×1 | R | – |
| looks/fogProgram | 19 / 18 | shader chunk: fog GLSL for custom programs | PH×2, +NA | R | – |
| looks/grassField | 184 / 116 | runtime + generator: meadow height / tone / flower fields on the active heightfield | NA×4, +PH via trample | R | E5/1 |
| looks/particles | 407 / 339 | runtime look: mist, needle fall, motes; canvas mist texture | PH×3, NA via lookApi | R | 3, D, E8/2, A |
| looks/trample | 239 / 176 | runtime look: GPU grass trampling by up to 16 movers | NA×2, PH via lookApi | R | 3 |
| models/creatures | 20 / 6 | data: Model Explorer defs for shared deer / boar / bear | DW×1, PH×1 | B | E2 |
| models/interact | 94 / 69 | generator + registration: chest, key, door, lever, plate, barrel, beacon, bench, altar | boot (every shard's interactables) | R→B | 3, E4 |
| models/pickups | 106 / 86 | generator + registration: sea glass, glyph shard, flint, resin, carved token, doubloon, coin | PH×1, boot | R→B | 3, E6, game |
| models/sword | 23 / 12 | Model Explorer card for the iron sword | none | – | E1 |
| npc/faceHeads | 60 / 42 | runtime loader: GLB face heads for NPCs | DW×2 | R | 3, t |
| npc/figureMotion | 73 / 68 | runtime: body / head / arm motion for fitted figures | NA×2 | R | 3 |
| npc/figureRig | 211 / 186 | generator: fit scanned figures to a 3-bone rig, pack atlases, merge | NA×4 | R→B | 3, D, E1 |
| npc/npcRig | 629 / 490 | generator + runtime: procedural humanoid leg rig, walk / talk / point pose | DW×2, PH×3 | R→B | 3, E2 |
| props/interact | 236 / 191 | generator: low-poly geometry for every interaction prop | via models/interact (boot) | R→B | 3, E2/1 |
| species/bear | 30 / 29 | data: bear `SpeciesRow` + hunt tuning | DW×1, PH×1 | R | E0/2 |
| species/boar | 28 / 27 | data: boar `SpeciesRow` + hunt tuning | DW×1, PH×1 | R | E0/2 |
| species/deer | 298 / 266 | generator + rows: lofted deer hull, bones, variants, palette | boot; PH by id (14 files) | R→B | 3, E2/3 |
| species/elk | 337 / 288 | generator + rows: lofted elk hull, bones, variants, tuning | boot; PH by id (15 files) | R→B | 3, E2/4 |
| species/install | 18 / 15 | composition-root registration of the four species + sound defaults | boot | R | E2 |
| species/view/bear | 244 / 209 | generator: bear look (lofted hull, paints) | PH×2, boot | R→B | 3, E2/3 |
| species/view/boar | 247 / 219 | generator: boar look (`kit.look.boar`) | PH×2, boot | R→B | 3, E3/3 |
| tools/hoverboard | 93 / 80 | runtime: the hoverboard tool (hover mode) | boot (every loadout's `tool.hoverboard`) | R | 3, E4/2, A |
| viewmodel/armClips | 11 / 10 | data: clip-name map for rigged arms | DW×1, ND×1 | R | E0/1 |
| viewmodel/armRig | 310 / 205 | generator: two-bone arm IK, hand specs | ND×1; Blender bake + check-clips scripts | B (+R in ND) | 3 |
| viewmodel/hunterHands | 435 / 324 | generator + runtime: PBR hands, sleeves, coat textures | PH×2 (+ Crossbow) | R | 3, E2 |
| viewmodel/rigArms | 225 / 160 | runtime: rigged first-person arms on an `AnimMachine` | DW×1, ND×1 | R | 3, E4/3, A |
| weapons/bow/draw | 100 / 60 | runtime logic: draw / let-down / re-nock state machine (no imports) | NA, PH (reach) | R | – |
| weapons/bow/family | 435 / 334 | runtime: the `Bow` weapon family | NA×6, PH×2 | R | 3, E9/6, A |
| weapons/bow/index | 2 / 2 | data: quiver and aim constants | NA×1 | R | – |
| weapons/bow/profile | 25 / 23 | types: `BowProfile`, `BowView` | NA×1, PH×2 | R | t, E0/3 |
| weapons/bow/profiles | 11 / 10 | data: the default `BOW` row | NA×1, PH×1 | R | E1 |
| weapons/bow/recurve | 438 / 346 | generator: recurve bow, arrow and rider-arm viewmodel geometry | NA×1, +PH | R→B | 3, E2/2 |
| weapons/crossbow/Crossbow | 998 / 711 | runtime: crossbow weapon, bolt flight, viewmodel | PH×4 | R | 3, E9/6, A |
| weapons/crossbow/display | 41 / 34 | runtime: the crossbow's display model | PH×3 | R | 3, E1/1 |
| weapons/crossbow/profiles | 10 / 10 | data: `CROSSBOW_PROFILE` | PH (reach) | R | – |
| weapons/crossbow/sounds | 71 / 59 | asset recipe: crossbow fire / dry fire / impact / reload synth | via weaponVoices (4 shards + boot) | R→B | E2/1 |
| weapons/equipment | 65 / 62 | data: `SWORD`, `WOODEN_SWORD`, `IRON_SWORD` rows | DW, NA, ND, boot (reach) | R | E0/1 |
| weapons/firearm/Firearm | 24 / 22 | runtime: abstract firearm base | PH×1, +NA | R | E1 |
| weapons/firearm/profiles | 16 / 16 | data: `AR15` row | PH×1, +NA | R | – |
| weapons/firearm/Rifle | 516 / 377 | runtime: AR-15 rifle, hitscan, brass, viewmodel | NA×2 | R | 3, E10/4, A |
| weapons/firearm/sounds | 43 / 31 | asset recipe: rifle fire / reload synth | via weaponVoices | R→B | E2 |
| weapons/melee/Melee | 68 / 61 | runtime: abstract melee base | DW×1, NA×3, ND×1 | R | t, E3/4, A |
| weapons/melee/moves | 88 / 59 | data: sword keyframes (rest, slash, backhand, finisher, heavy) | NA×1, ND×1, +DW | R | 3, E0/1 |
| weapons/melee/profiles | 17 / 16 | data: `SWORD_WOOD`, `SWORD_IRON` | DW×1, NA×2, ND×1 | R | – |
| weapons/melee/sounds | 40 / 37 | asset recipe: sword swing / heavy / hit synth | via weaponVoices | R→B | E1/1 |
| weapons/melee/SweptMelee | 948 / 718 | runtime: the `Sword` (swept blade, lock-on, trails, glow) + `buildSword` geometry | DW×3, NA×1, ND×1, boot | R | 3, E16/7, A |
| weapons/thrown/Thrown | 22 / 19 | runtime: thrown-weapon arc helper | NA×1 | R | t |
| weapons/ui | 9 / 8 | data: weapon-swap glyphs | NA×1, PH×1 | R | – |
| weather/rainCurtain | 39 / 35 | runtime look: rain curtain mesh + shader | NA×1, PH×1 | R | 3, E2 |

## 2. Classification

The class is where the module **ends up**. Where today's use and the target disagree, the evidence says so.

### (a) SDK system: 19 files, 2,246 lines

Platform behaviour. It runs in the engine on the client, and on the server where it touches the sim (decision 14). A
shard reaches it from data by a stable id (`family: "sdk.bow"`, `voice: "sdk.swordSwing"`, `look.layers: [{ kind:
"sdk.rain" }]`), and `runtime/` reaches it through the SDK's trusted runtime surface. The code moves to `src/game/systems/`
(the game layer knows Wildshard; the engine stays content-free, E405). `@wildshard/sdk` exports the row schemas and the
trusted facade.

| Module | Evidence |
|---|---|
| weapons/melee/SweptMelee, Melee | 3 shards + boot (the template's `kit.sword` view calls `buildSword`). The family already takes a profile row (`new Sword(world, targets, { row, profile })`). SF36 makes it a row family. Its `buildSword` geometry splits out to (b). |
| weapons/bow/family, draw, profile | NA and PH build it from profile rows (`new Bow(..., { profile: NALATI_BOW })`). `draw.ts` is pure logic with no imports, so it can become the family's sim-side step or an AS hook. |
| weapons/firearm/Firearm | Base class for NA's `Rifle` and PH's `LeverRifle`. |
| items/declared | It **is** the shardfile's `kit.melee` / `kit.lantern` families. It becomes `sdk.melee` / `sdk.lantern`. |
| tools/hoverboard | Every loadout's `tool.hoverboard`, installed at boot. SF34 makes hover a platform mode. |
| audio/weaponVoices, combatCues | The voice-id registry four shards' audio data already names (`kit.swordSwing`, `kit.reload`). The synth recipes behind it are (c). |
| looks/particles, trample, fogProgram | Particles and trample are shared by NA and PH. They are look-stack layers with numeric parameters, and the fog chunk belongs with the engine's `attachFogUniforms`. The canvas mist texture becomes a baked KTX2 (b → c). Trample must stop importing NA's `grassBaseHeightAt` and take a height callback instead. |
| weather/rainCurtain | NA and PH. A weather look layer. |
| viewmodel/rigArms | DW and ND. The rigged first-person arm player (SF34's swim arms run on it). |
| effects/bindings, view (+css), install | **PH only today**, but status effects are platform behaviour: the engine already owns `EffectService`, `view` is a HUD widget (shared HUD, E332), and `install` is a Debug row that DEBUG-TOGGLES allows as an engine-wide registry row. Keeping them per shard would fork the HUD. |

### (b) commons generator: 10 files, 2,369 lines

Build-time code that makes shardfile content. All 10 are pure three.js builders: none touches the DOM or the `app`
singleton. They already run in Node: the SF9c fixture (`test/fixtures/sim-level/skins/build.ts`) exports the kit boar and
an NPC rig to skinned GLB with sampled clips (boar ≤ 0.19 mm error). Each generator ships **prebuilt** entries in the
commons catalogue, so first-party shards share one hash. Authors can also re-run a generator with their own parameters,
which makes a shard-local file instead.

| Module | Evidence |
|---|---|
| species/view/boar, view/bear | PH plus boot. SF9c proved the boar export. G8's quadruped. |
| species/deer, elk | Installed at boot; only PH spawns them (14–15 files by id; DW only has a toon-paint table entry). **Single user today**, but they are G8 quadrupeds next to the shared boar and bear, so they go to the commons with them. If Jake prefers, they can go to PH instead (≈ 554 lines). |
| npc/npcRig | DW and PH. G8's standard humanoid. The rig is built at build time; walk / talk / point become sampled clips or named platform pose bindings (SF9c's route). |
| props/interact, models/interact | Boot registers them for every shard's chests, doors and levers (`registerInteractProps`). They become commons models the interaction runtime references by hash. |
| models/pickups | Boot plus PH's token shelf. The pickup kinds are used by DW, PH and the template. |
| weapons/bow/recurve | NA and PH (the default `BOW` profile builds it). Viewmodel geometry. |
| viewmodel/armRig | Already build-time: the Blender fp-arms bake and ND's `check-clips.mjs` import it. ND's runtime use goes once its arms are baked. |

### (c) commons data / assets: 19 files, 648 lines

Rows and recipes that become commons entries: JSON rows parsed by the SDK, rendered sound variants, and SVG icons.

| Module | Evidence |
|---|---|
| species/boar, bear; models/creatures | `SpeciesRow` and tuning shared by DW and PH, plus their Model Explorer defs. |
| weapons/equipment, melee/profiles, melee/moves, bow/profiles, bow/index, firearm/profiles, weapons/ui | Pure rows, constants and keyframes (moves are a clip). Up to 4 shards use them. |
| crossbow/sounds, firearm/sounds, melee/sounds | Synth recipes reached by 4 shards through `weaponVoices`. Target: rendered variants in the commons sound library (G24). Until then they stay behind the SDK voice ids. |
| audio/forest | FR and SD. An ambience profile. |
| effects/starter | The five status-effect rows. |
| icons (+ merge.d.ts), bag/items | Boot, for every shard's Bag. The SVG set becomes a commons icon pack; the `IconMap` merge becomes a generated catalogue type. |
| viewmodel/armClips | DW and ND. A clip-name map. |

### (d) commons script library: 0 kit files

Nothing in the kit qualifies. The library starts from the shards and from new work:

- **From the shards now:** an `abi.as` prelude (the ABI-v0 boilerplate all nine modules repeat); `movers/bridge.as`
  (identical in DW and FR); the template's `door.as`, `idle.as` and `items.as` as the starter set.
- **From the plan's rows:** SF27's AS brains (pack, skirmisher, guardian, perch hunter as AS where they don't need
  native code); SF36's item hooks (the whip, the lantern; `bow/draw` if it moves sim-side); director snippets (timers,
  phase gates, raid / retry rolls like FR's, night / dawn like DW's).
- **New authoring generators** (TypeScript on the author's machine, output checked by the SDK parsers): quest shapes
  (`reachThenDefeat`, `fetch`, `escort`) → `QuestData`; dialogue trees → `dialogue`; boss and elite phase tables →
  `ENCOUNTERS` rows. The template's `data/quests.ts` and `data/encounters.ts` show the output shape.

### (e) one shard's own code: 11 files, 1,998 lines

| Module | Goes to | Evidence |
|---|---|---|
| audio/creatureVoices | DW `runtime/audio/` | DW only (`runtime/audio/sfx.ts`). The boar bark can be rendered into the commons when a second shard asks. |
| npc/faceHeads | DW | DW only. |
| npc/figureRig, figureMotion | NA (`generators/` for fit and pack, `runtime/` for motion) | NA only. |
| looks/grassField | NA | NA only by real use: PH reaches it only through trample, which gets a height callback (see (a)). |
| weapons/firearm/Rifle | NA `runtime/` | NA only (`plugin.ts`, `models/gear.ts`). |
| weapons/thrown/Thrown | NA | NA only (Spear). |
| weapons/crossbow/Crossbow, display, profiles | PH `runtime/` | PH only. |
| viewmodel/hunterHands | PH | PH only (Crossbow, longbow view, LeverRifle). |

Moving them lowers no measure: the measure already charges them to these shards as kit-only custom lines (B16). Runtime
ceilings after the move: PH 1,413 + 1,079 = 2,492 of 4,339; NA 1,986 + 766 = 2,752 of 6,618; DW 1,133 + 153 = 1,286 of
3,753.

### (f) delete: 3 files, 32 lines

| Module | Evidence |
|---|---|
| models/sword | No importer anywhere in `src/`, `test/` or `scripts/`, and the model roster has no glob that would find it. |
| lookApi | A lazy-import shim. It goes once particles / trample are SDK layers and grassField is NA's. |
| species/install | "Composition root defaults for legacy shards". Once species are commons rows plus skins resolved per shardfile, nothing global is installed. |

## 3. The commons form

Three candidates:

- **SDK plugins.** Versioned packages (`@wildshard/plugin-creatures`) that extend the SDK with trusted systems, generators,
  assets and AS modules. A shard declares them in `shard.config.ts` (`plugins: [creatures('^1')]`).
- **A plain content package.** `@wildshard/commons` holds data, assets, AS modules and generators, and no runtime
  TypeScript. Every runtime system lives in the SDK.
- **A hybrid: content packs with build-time plugin hooks.** One `@wildshard/commons` package split into packs. Each pack
  is a plugin to `wildshard build` (generators, catalogue, typed references) on the author's machine. What ships is only
  immutable content (`commons:<hash>`: GLB, KTX2, audio, wasm, JSON rows). Runtime behaviour a pack needs **graduates
  into the SDK** as a system with a stable id (R8). It never ships inside the pack.

| Criterion | SDK plugins | Plain content | Hybrid |
|---|---|---|---|
| Shardfile validation and determinism (S2, R4, G48) | ✗ Plugin systems are trusted TS: the shardfile would name code it can't validate, and TS gets only same-engine replay | ✓ Data and AS only: the SDK parsers check it, AS is bit-exact | ✓ Same as plain: hooks run before validation, never after |
| The MMO server loads shardfiles unchanged (decision 14, S1) | ✗ The server must host every plugin × version × `SHARDFILE_VERSION`; a shardfile is no longer self-contained | ✓ Hashes plus SDK ids versioned by `requires.sdk` | ✓ Same as plain |
| Outside authors (A0 one path, A2, R2) | ~ Familiar npm shape, but outsiders can't ship trusted runtime plugins, so first-party gets a private route (breaks A0) | ✓ Install the tarball, reference entries; contribute through review later (G6) | ✓ Same, plus a plugin shape for their own build-time tools (A7: share tools) |
| Cached once across shards (G6) | ~ Works if assets are content-addressed, but per-plugin bundles tempt per-version copies | ✓ Prebuilt entries mean one hash per entry; the client store is already hash-keyed | ✓ Same; the catalogue pins first-party shards to prebuilt hashes so they dedupe |
| Versioning (§3.4, G29) | ✗ Each plugin adds a runtime ABI with its own support window | ✓ Shipped entries are immutable hashes; package semver covers only the authoring API | ✓ Same; a pack's `needs: ['sdk.bow']` rides on `requires.sdk` |
| Extension points | ✓ Most: new systems, hooks, assets | ~ AS modules and generators; new systems need an SDK release | ✓ AS modules, generator hooks, quest / dialogue / encounter generators, and the R8 graduation path for systems |

**Recommended: the hybrid.** It is the plain content package plus "plugin" ergonomics where they are safe, on the
author's machine. Jake's "could be sdk plugins" holds for authoring. At runtime only the SDK runs code. Every pack is
data, assets, AS and build-time TS, so the server reads the same shardfile the client does, and an outside author has
exactly the first-party path.

### Package layout

```
src/commons/                          @wildshard/commons (6th workspace package; a pnpm-pack tarball like the SDK)
  package.json                        exports: ./<pack>/<module> (build-time only) and ./catalogue
  catalogue.generated.json            entry id → sha256, kind, decoded / GPU / wire cost, credit and licence, pack version
  catalogue.generated.d.ts            typed entry ids (replaces icons.merge.d.ts and the kit.* string ids)
  packs/
    creatures/   pack.ts · generators/ (loft: boar, bear, deer, elk) · rows/ (species, tuning) · clips/ (quadruped)
    npc/         pack.ts · generators/ (humanoid leg rig) · clips/ (walk, talk, point)
    props/       pack.ts · generators/ (chest, key, door, lever, plate, barrel, beacon, bench, altar) · pickups/
    weapons/     pack.ts · generators/ (sword, recurve + arrow viewmodels) · rows/ (sword, bow, AR15 profiles; moves)
    audio/       pack.ts · sounds/ (rendered weapon and creature voices) · ambience/ (forest)
    icons/       pack.ts · svg/ (content icons, Bag icons)
    behaviour/   abi.as · movers/ (bridge) · door.as · idle.as · items/ (hooks) · director/ (timers, phases) · brains/
    authoring/   quests.ts (quest shapes) · dialogue.ts · encounters.ts (phase tables)   → validated rows
  built/                              prebuilt immutable bytes, named by sha256 (build output; served once at /commons/<sha256>)
```

- **What ships in a shardfile:** only `requires.commons: [sha256…]` and `commons:<sha256>` references (models, skins,
  clips, KTX2 materials, rendered sounds, compiled wasm, JSON rows), plus SDK system ids (`sdk.melee`, `sdk.rain`). The
  bytes are served once by the platform. The current "copied once into the product" step (SHARDFILE.md) becomes a shared
  `/commons/` path, so the CDN holds one copy too.
- **What stays on the author's machine:** the pack manifests, generators, authoring scripts, AS sources and the
  catalogue types. They run inside `wildshard build`.
- **How a shard uses it:** a build-time file calls `commons.ref('creatures/boar')` or a generator
  (`creatures.loft({ species: 'boar', palette })`). The SDK's build turns either into a hash plus rows and checks the
  cost against the shard's budgets. `runtime/` never imports the commons.
- **Layers:** engine → game → sdk → commons → shards. The commons imports only `@wildshard/sdk`, whose bake helpers it
  uses (`staticGlb`, `skinnedGlb`, `sampleSkinClip`). Shards import `@wildshard/sdk`, and in build-time folders the
  commons (Q1).

### Extension points

1. **AS modules.** `import { … } from 'commons/behaviour/…'` in a shard's `.as`. `wildshard build` compiles with a pinned
   `asc` so the same source gives the same wasm hash in every shard, and that hash dedupes.
2. **Generator hooks.** `defineGenerator({ id, input: valibotSchema, run(ctx) → { assets, rows } })`. The build caches
   each run by input hash. The same hook shape serves first-party packs and an author's own tools (A7).
3. **Authoring generators.** Quest, dialogue and encounter shapes as plain functions returning rows the SDK parses (a
   Claude Code skill can call them, A1).
4. **Graduation (R8).** A pack that needs new runtime behaviour proposes an SDK system with an id. Until it lands, the
   behaviour sits in one shard's `runtime/`.

## 4. Migration order and effort

An agent-day is the plan's unit (≈ 1–2 wall-clock hours of the fleet).

| Step | What | Sites moved | Effort |
|---|---|---|---:|
| 0 | `src/commons` skeleton, catalogue build, `@wildshard/sdk/commons` (`ref`, `defineGenerator`), layer rank `commons`, ratchet `kit-imports` at 102 statements / 64 files | – | 1 |
| 1 | (f) delete; (e) move into DW / NA / PH; trample takes a height callback | 25 statements | 2–3 |
| 2 | (c) rows and icons into commons packs; SDK row schemas; sounds stay behind SDK voice ids | ~30 | 2–3 |
| 3 | (a) into `src/game/systems/` with SDK facades; rename `kit.*` ids to `sdk.*` in one migration commit (A11; v0 is not frozen) | ~45 | 6–8 |
| 4 | (b) generators into packs; prebuild entries; switch boot and shards from runtime-procedural to baked, with parity captures | ~10 + boot | 6–9 |
| 5 | (d) `abi.as`, the shared bridge, template behaviours; pinned `asc` in `wildshard build` | 9 `.as` | 2–3 |
| 6 | Kit removal: boot's 11 modules, `test/setup.ts` and 58 tests, 9 scripts (gen-api, check-models, check-row-data, shard-platform, gen-shard-words, e350-hale-web, Blender targets and bake scripts), lint (`LAYER_PACKAGE`, ranks, engine-internal, shard-names, asset path), the workspace entry, ENGINE / SHARDS / AGENTS layering, ratchet at 0 | – | 2–3 |
| 7 | SF26 proof: two shards share one commons boar; one download; crossroads memory counts it once | – | 2–3 |
| | **Total** | 102 statements in 64 files | **≈ 23–33 (≈ 28)** |

- **About 8 days of this overlap rows already costed:** SF36 (families as rows), SF34 (hover mode), SF9c follow-ups
  (baked creatures and NPCs) and SF27 (AS brains). New cost to Part A is ≈ 20 agent-days for SF54 + SF26.
- **A cheaper path exists, and I don't recommend it.** Steps 0–3 and 6, with the (b) code left as trusted runtime modules
  in the SDK, is ≈ 12–14 days. It deletes `@wildshard/kit` and meets SF54's letter. But it leaves 2.4k lines of content
  generators as a kit under the SDK's name, against G136's intent, and step 4 is still owed afterwards.
- **The 64 import sites move per shard, inside that shard's own lane.** DW, NA and PH are mid-port, with uncommitted
  hunks in the tree today. Each shard's sites move in one commit with its parity tests. The ratchet falls with each
  commit, and `wildshard/layer` refuses any new `@wildshard/kit` import from step 0.
- **The four subclass sites** (Sabre, Spear, GoldenBow, LeverRifle) extend the SDK's trusted families until SF36 turns
  them into family rows with AS hooks (Q2).

**Risks**

- **Parity.** Steps 1–3 move code byte-for-byte, and the 58 tests, the frame floor and physics-baseline guard them.
  Weapon feel (SweptMelee 718 lines, Crossbow 711) is the most sensitive. Change no tuning in a move commit.
- **Look changes need boards.** Step 4 replaces runtime-procedural species, NPCs, props and the recurve with baked
  GLBs. Per-variant palette recolours (PH's coats from `DEER_PALETTE` / `BEAR_PALETTE`), toon facets and `kitLook`
  variants may shift. Where a capture differs, the old path stays a Debug variant and Jake gets an A / B board per
  family (Q3).
- **Memory.** Baked GLBs add wire and decoded bytes the procedural path doesn't pay. GPU bytes stay about the same. The
  commons counts once at a crossroads, which is the gain. Watch PH (30 fps, 1.0 GB Explorer) and the `gpuMB` ratchets.
- **HUD.** `effects/view` is a HUD widget. Moving it changes no placement, but herdr notice per E332 anyway.
- **Expectations.** Dissolving the kit raises no shard's public share (B16). Only converting shard code to rows,
  generators and AS does.
- **Licences.** Every commons entry carries its credit (LOCAL-MODELS: credits are licence conditions). Research-only
  assets never enter the commons.

## 5. Questions for Jake

1. **Can build-time shard files import the commons directly?** G135 says shards import only `@wildshard/sdk`.
   **Recommend:** `generators/`, `data/` and `quests/` may import `@wildshard/commons` (it's an author tool built on the
   SDK, A2). `runtime/` and the shipped shardfile see only the SDK and `commons:<hash>`. The alternative re-exports
   every pack through the SDK, which makes the SDK depend on its own content.
2. **Can the four subclassed weapons extend the SDK's trusted families for now?** These are Sabre, Spear, GoldenBow and
   LeverRifle, until SF36 makes them rows plus AS hooks. **Recommend:** yes, ratcheted. The SDK's trusted surface is
   the platform, not a kit. Copying Sword and Bow into two shards would duplicate 1.1k lines that SF36 then deletes.
3. **When baked creatures, NPCs and props replace the procedural ones, do you want a board every time?** **Recommend:**
   a board, with the old path kept as a Debug variant, only when the parity capture shows a visible difference.
   Captures that are identical within SF9c's tolerance ship without a board.
4. **Quest, dialogue and encounter generators: Part A or Part B?** **Recommend:** Part B as one S-row. Part A gets the
   commons skeleton, the packs the kit fills, `abi.as` and the shared bridge mover.

## 7. SF54 final-module dissolution (2026-10-09)

This section supersedes the historical “nothing has moved yet” statement for the final SF54 modules.
`f72b637c8` moved them into the game package. The reviewed boundary now ratchets **game imports outside
`runtime/`** at their actual per-file count; it does not invent SDK aliases for the same runtime classes.
Engine imports remain the separate G143/SF62 transition debt. Only exact files in the SF73 frozen-copy
inventory receive the `-legacy` exception, never a suffix or a manifest declaration alone.

| Moved module | Verdict | Consumer / destination | Reason |
|---|---|---|---|
| `systems/npc/figureRig` | (c) single shard | Nalati `models/npc/figureRig` | Only Nalati fits and merges these figures; preserve the fitting/atlas code unchanged. Future build-time fitting belongs to Nalati's generator. |
| `systems/npc/figureMotion` | (c) single shard | Nalati `models/npc/figureMotion` | Only Nalati advances these NPC poses; keep its rig types local. |
| `systems/npc/faceHeads` | (c) single shard | Driftwood `npc/faceHeads` | Only Driftwood loads these heads; preserve the module-local caches and decoder. |
| `systems/effects/install` | (a) platform system | Game installer; SDK effects declarations/runtime boundary | Status effects and Developer controls are platform services. Direct page imports remain transition debt, not a renamed SDK class library. |
| `systems/effects/view` + `status.css` | (a) platform system | Game status widget called by effects installer | Shared effect display belongs to the platform HUD; authored content supplies effects data. |
| `systems/items/declared` | (a) platform system | Boot-owned family/view registration; authored family ids | The shardfile resolves registered item families by id; authors do not import this installer. |
| `systems/items/declaredSword` | (a) platform system | Private view builder used by item registration | A platform-rendered recipe, private to its installer. |
| `systems/tools/hoverboard` | (a) platform system | Boot-owned registration; authored tool id | Input/motor lifecycle is platform-owned, not build-time commons. |
| `systems/icons` + merge types | (a) platform system | Boot icon registry; declared icon ids | One registry serves every shard. Existing direct calls remain explicit transition debt. |

None of these final runtime modules is a build-time-only commons pack or proven dead. This job preserves
live platform systems and does not create facade aliases that leave author code coupled to them.

### Current path to zero

The actual oxlint AST scan at `6f1ff85b5b198f632ac9d1ea23b5b2e243c0de00` finds **233 game import sites
in 128 files outside `runtime/`**, including type imports, dynamic imports, re-exports and relative game
imports. The new `wildshard/shard-game-imports` ratchet starts with those per-file counts and only shrinks.
It is not a hard-zero rule on the existing tree.

| Shard | Current sites | NPC-local moves | Remaining after those moves |
|---|---:|---:|---:|
| Driftwood | 58 | 2 | 56 |
| Nalati | 46 | 6 | 40 |
| Pine | 69 | 0 | 69 |
| Signal Dunes | 29 | 0 | 29 |
| Nine Dragon | 16 | 0 | 16 |
| Sky Reach | 14 | 0 | 14 |
| Template | 1 | 0 | 1 |
| **Total** | **233** | **8** | **225** |

The list below is a measured migration checklist, not exemptions to add. Each site must become a real
SDK declaration/capability, a shard-local module, or part of that shard's explicit runtime conversion
with unchanged loaded behavior. The per-file ratchet prevents fresh coupling.

#### _template

- `manifest.ts`: 1

#### driftwood-isle

- `creatures/install.ts`: 1
- `creatures/species.ts`: 2
- `creatures/tables.ts`: 1
- `fpArms.ts`: 3
- `generators/movers.ts`: 1
- `loadout/rows.ts`: 2
- `loot/effects.ts`: 1
- `loot/finds.ts`: 2
- `loot/keepsakes.ts`: 3
- `loot/perks.ts`: 1
- `loot/presentation.ts`: 4
- `loot/shop.ts`: 1
- `loot/tables.ts`: 1
- `manifest.ts`: 1
- `models/trader.ts`: 1
- `npc/Castaway.ts`: 1
- `onboarding/firstMinutes.ts`: 1
- `plugin.ts`: 4
- `quest/Complete.ts`: 3
- `quest/Spine.ts`: 3
- `quest/adventure.ts`: 5
- `quest/facts.ts`: 3
- `quest/install.ts`: 4
- `quest/people.ts`: 1
- `quest/rows.ts`: 3
- `roster.ts`: 1
- `species/sailor.ts`: 1
- `weapons/swordView.ts`: 1
- `world/sea.ts`: 1
- `world/systems.ts`: 1

#### far-reach

- `boot/files.ts`: 1
- `combat/stormRoc.ts`: 1
- `generators/movers.ts`: 1
- `manifest.ts`: 1
- `plugin.ts`: 1
- `quest/install.ts`: 5
- `roster.ts`: 1
- `world/baked.ts`: 1
- `world/build.ts`: 1
- `world/skyDock.ts`: 1

#### nalati-grasslands

- `adventure.ts`: 4
- `bag.ts`: 1
- `campPeople.ts`: 2
- `campPeopleModels.ts`: 1
- `campPeopleProfiles.ts`: 2
- `combat/balbalWarriors.ts`: 1
- `combat/eliteRoster.ts`: 1
- `combat/elites.ts`: 1
- `combat/goldenKing.ts`: 2
- `combat/stormTitan.ts`: 2
- `creatures/raidDirector.ts`: 1
- `feats.ts`: 1
- `look/grass.ts`: 2
- `look/horizon.ts`: 1
- `look/skyRig.ts`: 1
- `manifest.ts`: 1
- `models/gear.ts`: 1
- `models/people.ts`: 1
- `playground/registration.ts`: 1
- `plugin.ts`: 4
- `ride/Mount.ts`: 1
- `ride/ride.ts`: 1
- `stealth.ts`: 2
- `weapons/equipment.ts`: 1
- `weapons/loadout.ts`: 2
- `weapons/nalatiSkins.ts`: 2
- `world/WeatherFX.ts`: 1
- `world/dressing/life.ts`: 1
- `world/dressing/place.ts`: 1
- `world/installWeather.ts`: 2
- `world/terrain.ts`: 1

#### nine-dragon-stack

- `grapple/FeiZhua.ts`: 1
- `manifest.ts`: 1
- `plugin.ts`: 3
- `vm/arms.ts`: 2
- `vm/fpArms.ts`: 2
- `vm/jianRow.ts`: 2
- `vm/swordSupport.ts`: 1
- `world/entries.ts`: 1
- `world/jian.ts`: 2
- `world/portalRide.ts`: 1

#### pine-hollow

- `combat/chargeTells.ts`: 2
- `combat/ctx.ts`: 2
- `combat/eliteRoster.ts`: 2
- `combat/elites.ts`: 1
- `combat/install.ts`: 6
- `compendium.ts`: 1
- `compendium/install.ts`: 1
- `debug/options.ts`: 2
- `dev/perfLap.ts`: 1
- `feats.ts`: 1
- `items.ts`: 1
- `life/index.ts`: 3
- `loadout/finishes.ts`: 1
- `loadout/loadout.ts`: 7
- `manifest.ts`: 1
- `models/skinningKnife.ts`: 1
- `models/tokenShelf.ts`: 1
- `plugin.ts`: 5
- `quest/index.ts`: 7
- `quest/npcModels.ts`: 1
- `quest/npcProfiles.ts`: 1
- `quest/npcRig.ts`: 1
- `quest/trades.ts`: 1
- `roster.ts`: 1
- `species/hulls.ts`: 2
- `species/looks.ts`: 2
- `species/rows.ts`: 2
- `weapons/longbowProfile.ts`: 1
- `world/PineWeatherFX.ts`: 1
- `world/drawnModels.ts`: 1
- `world/rainProgram.ts`: 1
- `world/streams.ts`: 2
- `world/trophyWall.ts`: 3
- `world/weather.ts`: 3

#### sunscar-dunes

- `boot/files.ts`: 1
- `combat/creatures.ts`: 2
- `combat/matriarch.ts`: 5
- `look/groundTiles.ts`: 3
- `manifest.ts`: 1
- `plugin.ts`: 6
- `quest/install.ts`: 5
- `roster.ts`: 1
- `weapons/Bullwhip.ts`: 1
- `world/baked.ts`: 1
- `world/build.ts`: 2
- `world/places.ts`: 1

### Frozen NPC compatibility and removal

The three literal historical modules remain exported at `@wildshard/game/systems/npc/{figureRig,figureMotion,faceHeads}` only while an exact SF73-registered frozen file imports them. Primary Nalati will own unchanged copies at `models/npc/`; primary Driftwood will own `npc/faceHeads`. They are rendering code, not bounded `runtime/` code. There are no facade aliases and no edits inside frozen copies. After the primary moves, a guard permits external imports of these historical exports only from registered legacy files; the old modules retain their existing internal type dependency unchanged. Delete each old implementation and its public export in the same commit that retires its last registered legacy consumer.

Relocations are serialized after the Pine combat landing, sp-x1's Nalati reins rebake and sp-x5's G258 claim. Each source move includes its real bake and loaded-input freshness proofs; the table above lists their projected reductions until those commits land.

### Nalati relocation landed (2026-10-09)

The two Nalati modules now live literally in `models/npc/`; all six primary author sites use them. Nalati's measured path drops 46 → 40, the original total 233 → 227. Driftwood's two planned sites are still pending. Historical game exports remain unchanged for the SF73 frozen inventory. Actual physics capture at `5fcdc794833524e4561549d0c0f99ecff8af164a` preserves every gameplay field; the map was genuinely rebaked and the exact model-support declaration retains rejection of undeclared siblings. See [the relocation receipt](../../../progress/shard-platform/kit-npc/nalati.md).
