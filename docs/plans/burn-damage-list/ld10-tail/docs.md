> QD7 LD10 census (read-only, 2026-11-04, sp-o5's subagent), copied from scratch for the BURN-DAMAGE-LIST 'LD10 tail' row.
> Census of the working tree at the time: LD9a landed, NF18 then uncommitted (it landed as 13253e2609). LD10 slice 1
> (SDK audio wrappers, seven whole-module orphans, NF18 dead arms/exports, stale ENGINE.md passages) is done; the rest
> is the tail. The `tmp/qd7-ld10/work/` scripts mentioned below were scratch and are gone.

# LD10 census: stale docs/ENGINE.md passages (working copy, 13,701 lines)

Line numbers are the working copy's (it already carries NF18's uncommitted edits, e.g. the graph section at 1773-1778
already says "NF18 removed the TSL node runtime"). Keep: build-time graph DSL (`graph(spec)` writing TSL, 4462-4470,
7165, 7820, 7860) and the modern grid-resident sections. Generated API/export tables come from `pnpm docs`; do not
hand-edit them. Each row below names a removed or never-existing API.

## SDK runtime audio / viewmodel facades

**6-11.** Names `@wildshard/sdk/runtime/audio/weaponVoices` (LD10 removes it), the alias
`@wildshard/game/systems/audio/weaponVoices` (a key pointing at `plugin/audio.ts`, retired with the wrapper) and
`@wildshard/sdk/runtime/audio/silentScore` (already does not exist). Replace with:
> `@wildshard/game/plugin/audio` defines the sample-first equipment recipes (`sharedWeaponVoices`,
> `declaredWeaponVoices`, `WeaponSynth`) and the equipment cue router `sharedCombatCues`; boot imports them from there.
> They retain oscillator parameters, cue taps and audio random-draw order.
> `@wildshard/game/systems/audio/silentScore.installSilentScore` scopes a score-only gain mute and restores the
> previous value at disposal. Both install only when called.

**13-17.** "Trusted runtimes reach them through `@wildshard/sdk/runtime/viewmodel/*`, whose facades bind the same
values; legacy shard files outside `runtime/` import the game modules until their -p port." `src/sdk/runtime/viewmodel/`
is empty. Replace the last two sentences with: "Callers import these game modules directly; there is no SDK facade."

**96-101.** "`@wildshard/game/systems/audio/combatCues` defines the shared equipment cue router. Trusted runtimes use
`@wildshard/sdk/runtime/audio/combatCues.sharedCombatCues(audio, meleeSilent)`; its SDK facade refers to the same
function." Neither module exists after LD10 (`systems/audio/combatCues` never had a key). Replace the first two
sentences with: "`@wildshard/game/plugin/audio` `sharedCombatCues(audio, meleeSilent)` is the shared equipment cue
router." Keep the rest of the paragraph (single call, surface/pan/gain, melee silence).

**2981-2998.** SF54 table: "existing transitional runtime facades in `@wildshard/sdk/runtime/*` (deleted under G307)",
"`runtime/` files import the SDK facades", the header "Defining module (runtime facade)", and the parentheticals
`(@wildshard/sdk/runtime/weapons/*)` (2989) and `(@wildshard/sdk/runtime/{viewmodel,audio}/*)` (2997). Replace the
intro with: "SF54 dissolved `@wildshard/kit`: content that 2+ shards use lives in `@wildshard/game`, content one shard
uses stays in that shard, and callers import the defining game module." Rename the column to "Defining module" and
drop both parentheticals.

## ShardPlugin, standaloneHybridEntry, declared entry

**169-171.** "`@wildshard/game/plugin/context` resolves a declared `runtime/*.ts` entry only through a trusted
first-party registry. `prepareHybridShard` admits the shardfile and its trusted entry, …" LD9a deleted that registry
(context.ts lost 56 lines). Replace with: "`declaredClientPlanEntry` (`@wildshard/game/shard/declaredEntry`) is the one
entry: `prepareHybridShard` admits the shardfile, chooses the catalogue instance inside the game layer, and composes its
world, kit and play stages." (If LD9b has not landed, keep "and its trusted entry" until it does.)

**276-282.** Template import example `import { ShardPlugin, installLoot, installCompendium, type ShardContext } from
'@wildshard/game';`: there is no `@wildshard/game` root (no barrels, E434) and shards no longer subclass `ShardPlugin`.
Replace the example with the defining-module imports a shard generator really uses (e.g.
`import { Sword } from '@wildshard/game/weapons/Sword'` and `import type { QuestState } from '@wildshard/engine/quest/…'`),
or drop the sentence "The template's imports show the rule" and its block.

**762-780 (§7 "The shard plugin and the registry").** The `TemplatePlugin extends ShardPlugin` example and the rows
"`ShardPlugin` | the base class; each hook may be async" and "`GameRows`, `GameRowMap` | `ctx.rows.item / lootTable /
skin / feat / shop / compendium / places`" describe plugin authoring that no shard does any more (only
`src/game/grid/pageShell.ts:61` and `src/game/shard/declaredEntry.ts:29` extend `ShardPlugin`). Replace the code
block with: "A shard declares data; its manifest's `bindings.entry` names the built-in client-plan entry
(`declaredClientPlanEntry`), which runs the world, kit and play stages with a `ShardContext`." Keep the table but
make `ShardPlugin` "the internal staged base class of the page shell and the declared entry" and drop `places`
(LD10 removes the unused `rows.places`).

**2813.** Game export map lists `ShardPlugin` and `GameRowMap`: keep both names (still exported), no change unless
`GameRowMap.places` is mentioned elsewhere.

**3426.** Composition-root module list includes `shard/entryMode`, deleted in `4a92df75a4`. Remove it from the list.

**3912-3918.** "Signal's private `runtime/shard/standaloneEntry.ts` `standaloneHybridEntry(Native, { name, source,
entry, runtime })` is a first-party primary's standalone hybrid entry. These one-user implementations and their SDK
facades returned to Signal under DS0.1; …" No `standaloneHybridEntry`/`standaloneEntry` remains anywhere in src,
scripts or tests, and `src/shards/sunscar-dunes/runtime/` holds no files. Delete the two sentences about the
standalone entry (and the `rowsHeadlessRuntime` sentence above them if Signal's `runtime/rowsHeadless.ts` is gone too:
it is, the folder is empty). Replacement: "Signal's runtime rows are data in its product; it enters through the
declared client-plan entry like every shard."

**4257-4262.** "`@wildshard/game/plugin/context` defines the staged `ShardPlugin` base class. Its
`standaloneHybridEntry(Native, admit, shardfile, name)` defines the shared standalone lifecycle used by Nine and Sky:
…" and "The frozen `./shard/context` and `./shard/plugin` export keys point to those distinct modules". LD9a removed
`standaloneHybridEntry` and `shard/plugin.ts`; the `./shard/plugin` key is gone; `./shard/context` still aliases
`plugin/context.ts` (readers: `src/sdk/bake/baked-tiles-looks.test.ts:6`, `test/fixtures/driftwood-world-updates.ts:2`,
`lint/wildshard-plugin.js:926`). Replace with: "`@wildshard/game/plugin/context` defines `ShardContext`,
`shardContext` and the internal staged `ShardPlugin` base class. The `./shard/context` key is a compatibility alias of
the same module for its remaining test/lint readers."

**4329-4330.** Table rows "`plugin/context` | staged `ShardPlugin` constructor" (keep, still true) and
"`plugin/lifecycle` | retained context and entered-service/input lifetime hooks": there is no `plugin/lifecycle`
module or key; those hooks are `@wildshard/game/shard/retainedHooks`. Fix the row to name `shard/retainedHooks`.

**11090-11100.** "Frozen legacy composition roots retain their explicit loaders, standalone constructor injection and
trusted composite until LD; those helpers are not current-manifest entry options." Standalone constructor injection is
gone (LD9a). Replace with: "`declaredClientPlanEntry` is the only entry; no source constructor registry, standalone
constructor injection or `nativePlan` selection remains." Keep the "frozen legacy loaders" clause only until LD9b.

**12264-12267.** "Frozen legacy entry metadata, explicit trusted loaders and the shared prepareHybridShard composite
keep their existing wire and lifecycle until LD." After LD9b: "The shared `prepareHybridShard` composite is the
declared entry's only composite." (LD9b-only; leave until that arm is gone.)

## TSL / node handler, graph ownership and lifetime

**1295.** "One whole-pass compile, driver query or node build remains atomic" → "One whole-pass compile or driver
query remains atomic".

**1319-1322.** "`Game.nodeBuilds.log` retains 1,024 scalar records …" The getter now always returns `null`
(`src/engine/core/Game.ts:961`). Delete the paragraph in the commit that deletes the getter (and its readers listed in
orphans.md §6).

**1811-1814.** "Node builds scope `render/nodes/nodeChildren.ts` child snapshots to one synchronous build. …" The file
was deleted by NF18. Delete the paragraph.

**4493.** "from the top left as three's node back-end gives it" → "from the top left".

**7063-7073.** "The node handler pairs compiled programs and selects their original uniforms on the first draw, … The
stock node model-world matrix uses the classic renderer's `modelMatrix` uniform. … Consecutive graph draws retain
indexed UBO bindings …" The node handler (`render/nodes/engineNodesHandler.ts`) is gone; classic graph programs use
ordinary three uniforms. Delete both paragraphs (nothing replaces them).

**7393-7400 (### Graph shadow depth).** "The existing node handler caches one depth variant per material, including
clones, …" Replace with: "`compileClassicGraph` builds one depth material per graph material
(`render/graph/glslMaterial.ts`, `depthMaterial`) and attaches it as the mesh's `customDepthMaterial`
(`attachClassicDepth`); it borrows the live parameters and mapped textures." Keep the clip-position refusal and the
"absent/false keeps the stock shadow path" sentences.

**7727.** "lowPolyMaterial returns Material, including node materials;" → "lowPolyMaterial returns Material (a lent
classic graph material or the kit material);".

**7818.** "`AnimalMaterial` also accepts a compiled standard/toon node material; … adds no eager graph-backend import."
→ "`AnimalMaterial` also accepts a lit classic graph material (`GraphShaderMaterial` with `lights`); body colour, map
and emissive hit-flash ports keep their types." (Code twin: `src/game/population/productCreatures.ts:54` still tests
`isMeshStandardNodeMaterial`.)

**1773-1778 (Material graphs).** Already NF18-correct: "lazy, not on the default path", the three `load*Compiler`
entry points in `render/graphBackend.ts` and "NF18 removed the TSL node runtime". No change; this is the graph
ownership/lifetime summary to keep. The single-entry API is covered by the 169 / 762 / 11090 replacements.

## Outside ENGINE.md (same commit, same reason)

- `docs/SDK-DEV.md:3,7,15`: `@wildshard/sdk/runtime/audio/{weaponVoices,silentScore,combatCues}` → the
  `@wildshard/game/plugin/audio` and `@wildshard/game/systems/audio/silentScore` defining modules.
- Source comments naming deleted node files (orphans.md §6), plus `src/engine/render/shadowDepthVariants.ts:6`
  ("its own node depth variant").
