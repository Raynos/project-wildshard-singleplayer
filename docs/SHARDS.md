# How to write a shard

## Performance comes first

Run `wildshard build <folder>` and `wildshard validate <folder>` after each content step.
Both print a performance report. New and outside projects refuse target overages;
only the canonical six old shards in the trusted checkout warn while they convert.
A borrowed old slug does not grant an exemption. Runtime admission remains hard.

The only hard memory budgets are the **complete worst-location totals: 1,000 MB
playing and 1,800 MB loading**, including the engine, neighbours, commons and overlap.
Library, simulation, tile and far resident targets are tradeable warnings, not separate
per-shard memory caps. Wire/render targets still refuse new content:

| Content step | Current target | Check before continuing |
|---|---|---|
| Critical simulation and library | 2 MB / 8 MB compressed | Report download closures; validate actual bytes and dependencies |
| Fine tile / coarse tile | 0.3 / 0.2 MB wire; 8 / 2 draws; 40,000 / 10,000 triangles | Report every tile; include shadows and all LODs |
| Far proxy | 1 MB wire; 1 draw; 8,000 triangles | Report the proxy and inspect the approach view |
| Materials | SF59 graph v1 node, sampler and instruction budgets | Report every graph; prefer platform families |
| Scripts | Host fuel ceiling; CPU p95 ≤ declared tick budget or 4,167 µs, whichever is lower | Build observes 60 headless ticks; validate retains the full simulation/entry proof |
| Trusted custom runtime | No frame allocation, raw rendering/DOM, timers, fetch or unbounded loops | Runtime source lint, then frame-floor CPU receipt |
| Playable view | 60 fps desktop / 30 fps Simulator; shard CPU p95 ≤ 4.167 / 8.333 ms per drawn frame | Run frame-floor through browser/Simulator lanes |

The report bounds draws/triangles at spawn and at the worst memory location before
frustum/occlusion. A native transition's measured resident cost is charged; unknown
native view/download work is explicitly **UNMEASURED**, never counted as zero.
Estimated time to playable uses unique playable bytes at **1 MB/s plus 1 s setup**.
This cold-network model is not a phone measurement: capture real fetch, decode,
compile, admission and first-frame timings before claiming a loading improvement.

Runtime geometry is not cheap merely because its source is code. Measure builder CPU,
physics insertion and upload separately; move deterministic construction into baked
assets or workers, and yield within the remaining builders. The SF67 target is no
loading task above about 100 ms; the current matched report still exceeds it.
Report real completed work within Props and other long steps, actual download bytes,
and named waits from the first HTML frame. A step boundary alone is insufficient.
Use [the loading benchmark](../progress/loading/sf67/README.md), separately from the
frame floor: cold and warm SHARD SELECT, phase wall times and tasks above 50 ms.
Chromium CPU emulation and Simulator Safari are separate results, neither a physical
phone measurement.

For example, a 5 MB playable closure estimates 6 s under those assumptions. A good
card says `PASS (refuse)` with measured script samples and no refusals. A bad new
card declaring an 8,000,001-byte library says `REFUSED (refuse)` and
`REFUSAL: library download budget bytes: 8000001 > 8000000`; build writes no product.
Use `@wildshard/sdk/reportCard` to inspect the same structured report in tooling.

Before marking a shard done:

- [ ] Build and validate pass with truthful decoded/GPU/wire costs and measured script CPU/fuel.
- [ ] Worst grid totals fit 1,000 / 1,800 MB; every warning has an explained trade.
- [ ] Spawn, busiest view, approaches and crossings meet draw/triangle and graph targets.
- [ ] Custom runtime lint is clean; reuse buffers and bound every loop.
- [ ] Both-surface frame-floor receipts include trusted shard CPU ownership within its quarter-frame share.
- [ ] Cold-cache phone-tier loading is measured through first playable frame; estimates stay labelled.

## Quickstart

Copy `src/shards/_template/` or run `wildshard new <folder> <slug>`. Install the SDK,
then build and validate before adding content. Add one bounded tile/library/script
slice at a time and check its report row before the next slice. Build-time generators
may allocate freely; shipped data and scripts use the admitted platform systems.

Shared build-time packs use the [commons catalogue](COMMONS.md); runtime imports cannot reach commons code.

SDK projects use `shard.config.ts` plus `generators/`, `data/`, `behaviour/`, `quests/`,
`assets/` and optional trusted transition `runtime/`. A pure shardfile project requires
`shard.config.ts` and `README.md`; it does not require `plugin.ts`. The template is a complete declaration-only SDK project. Its manifest supplies picker
metadata and points at its built shardfile; there is no template runtime chunk.
Build output goes in git-ignored `public/shardfiles/`. Placement is platform data in
`src/game/grid/singleplayer.json`, attached by `scripts/gen-shards.mjs`; source manifests
and shardfiles carry no placement. SF17a changes the catalogue to the 3 × 3 grid.

To start a shard, copy `src/shards/_template/` to a fresh project folder, install
`@wildshard/sdk`, and edit the identity in `shard.config.ts`. Run `wildshard build
<folder>` and `wildshard validate <folder>`. The config imports only SDK modules;
content-addressed assets are already included. Build-time generators may use author
tools, while shipped behaviour is admitted AssemblyScript and callback-free data.
The platform owns placement, cache, residency, physics, input, HUD and the normal
Game boot. Follow [SHARDFILE.md](SHARDFILE.md) for the data contract; the legacy
plugin guide below remains for first-party shards undergoing conversion.

Ledger declarations use `@wildshard/sdk/ledger`: validate fact-to-reward mappings with
`parseLedgerRules`. Authors emit a named outcome; the host assigns its stable instance,
package revision, entity, tick, ordinal and engine/script provenance. The platform admits
catalogue rewards at capped tiers and records achievements/titles once per package in the
profile. Grants and fact dedupe share one durable write; failed writes retry the same
document. Cells never enter a save or fact key. First-party modes resolve one identity
through `@wildshard/game/grid/instances`; template copies use `template-1` … `template-6`,
while Select a shard uses `template-solo`. The template uses the normal staged Game loader.

Instance-local saves bind through `SaveStore.instance`, or the game’s `instanceSave`
helper with the session’s stable id and shard. Canonical first-party slug namespaces stay
unchanged; `template-solo` copies the legacy `_template` document while retaining its
source. Destination entries win, including unknown/future-version entries. Failed copies
remain in memory and retry on read/write; `peek` stays read-only. Template copies never
inherit one another’s progress, and cells never enter the save API. Client integration
follows at SF20a/SF46.

Quest authors use `@wildshard/sdk/quests` to compile declared flags, quest steps,
world markers, region/death triggers and finite dialogue trees. The platform binds them
to the existing `QuestState`, preserving journal/chip/marker text and counters. Custom
conditions read atomically published public/owner script fields by stable id; scene hooks
queue declared events for the next script tick with the session's actor binding. Profile
outcomes pass through the ledger fact port, while coins remain local. Dialogue cursors
and quest state restore at the same simulation checkpoint.

Audio authors use `@wildshard/sdk/audio` for a cue-to-catalogue voice map, bounded wind
recipes and a silent/default score. `installDeclaredAudio` admits every voice before
installing anything; the kit's `declaredWeaponVoices` retains the existing weapon sounds
and impact surface routing. Level scopes remove cue routes, stop bed sources and restore
the score output gain. The template's data keeps its two forest wind bands and silent score.

Scoped plumbing uses `@wildshard/sdk/plumbing`: declare namespaced input actions and
keyboard/touch bindings, phone/desktop tier values, and Debug choices with named scene
hooks. `installDeclaredPlumbing` qualifies context ids by stable instance, uses the normal
recordable command path, gates bindings by active instance, and registers knobs/Debug
rows through session-owned scoped ports. The template keeps its lantern label, prop count
and oil Debug choices; the legacy installer switches at SF16.

A legacy shard is one Wildshard level with a manifest and a plugin. The remaining sections
document that transition API; new shards follow the SDK flow above.

- **The template** is [`src/shards/_template/`](../src/shards/_template/). It is the complete grey teaching level
  authored as shardfile data and admitted behaviour. Copy it; don't start from a real shard.
- **The API reference** is [ENGINE.md](ENGINE.md). Each step below links to its section.
- **The rules** are in [AGENTS.md](../AGENTS.md). The ones a shard author hits most are repeated where they apply.

| Shard | Slug | Status | Style | Look | README |
|---|---|---|---|---|---|
| Driftwood Isle | `driftwood-isle` | `live`, deck 1 | `toon` | extend: the clean chain, toon light and fog | [README](../src/shards/driftwood-isle/README.md) |
| Pine Hollow | `pine-hollow` | `live`, deck 2 | `pbr` | extend: the engine chain, a sky backdrop | [README](../src/shards/pine-hollow/README.md) |
| Nalati Grasslands | `nalati-grasslands` | `earlyAccess`, deck 3 | `painterly` | replace: its own composer | [README](../src/shards/nalati-grasslands/README.md) |
| Nine Dragon Stack | `nine-dragon-stack` | `experimental`, deck 4 | `jiehua` | extend: the engine passes, its own colour chain | [README](../src/shards/nine-dragon-stack/README.md) |
| Template | `_template` | `hidden` (Debug only) | `greybox` | extend: the engine chain only | [README](../src/shards/_template/README.md) |

## 0. Before you start

- **Your lane.** While GAME-NORMALIZATION's lock is on, you may commit only inside your shard's allowlist: your
  `src/shards/<slug>/`, `test/shards/<slug>/`, `art/<slug>/`, `public/assets/<slug>/` and the asset folders in your
  manifest's `assetGlobs`, `scripts/blender/<slug>/`, and `docs/tasks/asks/`. The lead adds your slug to
  `.github/lock.json` first. `scripts/check-lock.mjs` (the `commit-msg` hook) refuses any other path.
- **Zero engine edits.** You never change `src/engine`, `src/game`, `src/kit`, `lint`, `scripts` or `.github`. When
  you need something outside your folder, **stop and file an API gap** in your ask file: what you needed, where, and
  why the public API can't do it. The lead fixes the API. Don't work around it with a deep import or a global.
- **Generated files outside your lane.** Three committed files under `lint/` change when a shard is added, and only
  the lead commits them. Name them in your ask file as soon as they change, so the lead lands them:
  - `lint/shard-words.generated.json`: `pnpm gen --shard=<slug>` adds or updates only your slug's name, species/weapon ids,
    settings and asset ownership, preserving every other committed entry even while its source is unfinished.
    It rebuilds aggregate words from those preserved entries. The ignored runtime registry/closure tables still regenerate globally.
    A scoped run requires an existing inventory (already present in this repository); use unscoped `pnpm gen` for a full refresh or removal.
    The pre-commit hook checks it (`gen-shards --check`) whenever a commit touches your `manifest.ts`.
  - `lint/ratchet.json` `debugRows`: every new `ctx.debugRow` raises the Debug-row cap.
  - `lint/ask-ids.json`: `pnpm gen` adds an ask id that a new Debug row names.
- **Your own look.** Every shard keeps its own style (PH-U1). Shards share the engine and the pipelines, never each
  other's shading. Pick the look with a mockup board first (`art/<slug>/round-<n>-<label>/`); Jake picks.
- **The HUD is shared.** Use the baseline HUD and map your verbs onto existing controls. A HUD change needs Jake's pick
  (E332).
- **No URL switches.** A variant is a Debug row (`ctx.debugRow`, §13), never a `?param`.

## 1. Copy the template

```bash
cp -R src/shards/_template src/shards/<slug>
cp -R test/shards/_template test/shards/<slug>        # the headless contract test; point its relative imports at src/shards/<slug>/
```

Then, in the copy:

1. `manifest.ts`: set `slug: '<slug>'` (it must equal the folder name), `name`, `blurb`, `biome`, a fresh `seed`,
   `order` (after the existing shards), and `status: 'experimental'`. Rename `TEMPLATE` and the plugin class.
2. Rename every `template.*` id (systems, events, actions, rows, save keys, Debug rows) to your own prefix. Ids are
   global: two shards with the same row id collide.
3. Delete what you won't use. The template has one of everything on purpose; a real shard lists only the mechanisms
   and verbs it runs.
4. `pnpm gen --shard=<slug>` regenerates `src/game/shard/shards.generated.ts` (git-ignored) and only your lint vocabulary entry.
   Your shard is now in the registry. `node scripts/gen-shards.mjs --shard=<slug> --check` checks that scoped entry and the runtime tables.
5. `pnpm exec tsc --noEmit -p .` and `pnpm exec vitest run test/shards/<slug>` must pass before you go on.

A folder whose name starts with `_` is hidden: it gets no title card and no layout check. Yours must not.

### Small check exports on the shared machine

For typecheck, lint and unit tests, export committed code without copying the large asset directories.
Run this from the repository root; it creates a fresh private directory, records the exact HEAD, and
symlinks `public`, `art`, `progress` and `node_modules` to the checkout:

```bash
python3 - <<'PY'
from pathlib import Path
import subprocess, tarfile, tempfile

source = Path.cwd()
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
target = Path(tempfile.mkdtemp(prefix='wildshard-check-'))
linked = ['public', 'art', 'progress', 'node_modules']
paths = [p for p in subprocess.check_output(
    ['git', 'ls-tree', '--name-only', sha], text=True).splitlines() if p not in linked]
archive = subprocess.Popen(['git', 'archive', sha, '--', *paths], stdout=subprocess.PIPE)
with tarfile.open(fileobj=archive.stdout, mode='r|') as tree:
    tree.extractall(target)
if archive.wait() != 0:
    raise RuntimeError('check export failed')
for name in linked:
    (target / name).symlink_to(source / name, target_is_directory=True)
(target / 'base-sha').write_text(sha + '\n')
print(target)
PY
```

Change directory to the printed path. Copy only the files you authored into that export when checking
an uncommitted candidate, then initialize its ignored generated tables and run the checks:

```bash
pnpm gen
pnpm exec tsc --noEmit -p .
pnpm exec oxlint
pnpm exec vitest run test/shards/<slug>
```

This avoids the multi-gigabyte `public/` copy. The linked assets are the shared checkout's files;
do asset generation in your own lane. A slim check export is unit-check evidence, not an isolated asset
snapshot for deployment or parity. Runtime checks use a committed candidate SHA:
`node scripts/parity.mjs --export=<candidate-sha> --lane=m5 --shards=<slug> --tiers=phone`.

## 2. The folder layout

The layout check (`scripts/check-shards.mjs`, from `lint/shard-layout.json`) runs at every commit that touches
`src/shards/**`. A file or folder outside this list fails it.

<!-- generated:shard-layout (node scripts/gen-shard-layout-doc.mjs, from lint/shard-layout.json) -->
**Required files**

| File | What it holds |
|---|---|
| `manifest.ts` | the `ShardManifest`, default-exported. Node-safe: data and lazy thunks only |
| `plugin.ts` | the `ShardPlugin` subclass, default-exported |
| `README.md` | what the shard declares, its custom code and why, budgets, look, open work (its plan rows) |
| `roster.ts` | the Model Explorer roster (`live(model)` entries) |
| `budgets.ts` | the budget inputs (§9) |

**Allowed files**

| File | What it holds |
|---|---|
| `ktx2.generated.ts` | your KTX2 table, written by `bake-ktx2` once you bake KTX2 art. The one generated file you commit |
| `budgetCeilings.ts` | recorded F2 ceilings (the four existing shards only) |
| `strings.ts` | every player-facing string (§11) |
| `layout.ts` | every coordinate: sites, trails, spawn points |
| `debug.ts` | your Debug rows |
| `shard.config.ts` | the SDK project source that builds shard.json (SHARD-PLATFORM SF7b) |

**Folders**

| Folder | What goes in it |
|---|---|
| `audio/` | the cue map, ambience, score wiring |
| `boot/` | the boot file plan |
| `explore/` | Explore art |
| `look/` | the `LookStrategy` and its shaders |
| `models/` | model definitions (`defineModel`) only |
| `thumbs/` | the title card images |
| `weapons/` | equipment rows and classes |
| `world/` | world building: pieces, terrain dressing, water, climate |
| `combat/` | encounters: bosses, elites, spawns (optional) |
| `creatures/` | creature wiring (optional) |
| `quest/` | quests; `quest/Places.ts` lists named places (optional) |
| `species/` | species rows, looks and brains (optional) |
| `npc/` | NPCs (optional) |
| `loadout/` | loadout wiring, finishes, ammo (optional) |
| `playground/` | playgrounds (optional) |
| `design/` | the shard's design pack: `design.md` and `spec.json` (optional; E406) |
| `generators/` | build-time code that makes assets (models, terrain, scatter): run by the bake, never imported by the shard's runtime and never shipped (SHARD-PLATFORM SP5; optional) |
| `data/` | the shard's content rows and layouts as serialisable values (JSON-able, no functions, no three.js or DOM): `sim-no-render` and the row ratchet hold it (SHARD-PLATFORM SP5; optional) |
| `runtime/` | the shard's own runtime code that no approved system covers yet: the custom share the 80/20 split counts (SHARD-PLATFORM SP5; optional) |
| `behaviour/` | AssemblyScript entity and director scripts |
| `quests/` | serialisable quest graphs and dialogue trees |
| `assets/` | source assets consumed by the build |
<!-- /generated:shard-layout -->

One name per concept: `quest/` or `quest.ts`, never both.

## 3. Fill the manifest

The manifest is data. Fill it top to bottom ([ENGINE.md §6](ENGINE.md#6-the-shard-manifest-game) has every field).

1. **Identity:** `api: 1`, `slug`, `name`, `blurb`, `biome`, `label`, `order`, `status`, `seed`, `placement`.
2. **Card art:** `card: { thumb, portrait, landscape }` from `thumbs/`. A portrait first: the game is an iPhone PWA.
3. **Ground:** `ground.terrain = buildTerrain(seed, { landscape, trails, cabinSites })` from `@wildshard/engine/world/terrainField`, or
   `ground.structures: true` for a built world, or both. With structures only, there is no terrain mesh/collider:
   `heightAt` / `terrainFor` return an analytic floor at **y = −1,000 m**, not a walkable surface (dry water sentinel
   −1,001 m). Set `spawn.y` to your built floor and register its colliders with `ctx.piece`. Set `bounds.floor` /
   `world.killY` above that fallback for void falls. `ground.water` lists `WaterBody` rows. `spawn`, `bounds`.
4. **Look data:** `sky`, `atmosphere`, `grade`, `style`, `kitLook`, `hands` (`'toon'` for faceted swimming hands; default `'pbr'`), and `render: async () => (await import('./look/render')).myLook()`.
5. **Mechanisms:** `uses` lists only what you run, from the 15: engine `weather dayCycle bosses elites spawns quests
   swim hover explore practice`, game `coins loot compendium feats bag.pack`. Anything not listed isn't built.
6. **Content:** `loadout`, `weapon: 'custom'`, `species`, `encounters`, `spawns`, `fight`, `bag`, `loot`, `creatures`.
7. **Captures:** declare `dev.poses: () => Promise.resolve({ spawn: { eye: [0, 2, 0], feet: [0, 0.32, 0],
   yaw: 0, pitch: 0, mockup: '', frame: 'Spawn view' } })`. Eye/feet are world coordinates; camera angles are degrees
   (0 faces −Z, +90 faces +X). Standing poses are sampled by parity; eye-only poses are free budget views.
   Without standing poses parity samples spawn as `current`. Install `__wildshardHarness` before loading for board
   captures; see [ENGINE §6.1](ENGINE.md#61-authored-diagnostic-cameras) for pins, units and exact legacy probe overrides.
8. **Audio:** `audio: { ambience, score, cues, preload? }` (§8).
8. **Tiers and budgets:** `tiers`, `budgets` (§9).
9. **Boot:** `boot: { files, sources, audio, precache, … }` (§14).
10. **Assets:** `assetGlobs` (the folders your lane commits), `ktx2` once you have a table, `explore`, `roster`.
11. **Plugin:** `load: () => import('./plugin')`.

Keep every coordinate in `layout.ts` and import it. The manifest must import in bare node
(`test/manifests-node-safe.test.ts`): no three.js objects, no DOM, only node-safe engine modules (`world/terrainField`, `core/config`, `core/noise` …; `lint/manifest-closure-budget.json` caps the files a manifest pulls).

For a skyline of your own, set `horizon` in the manifest; [ENGINE §6](ENGINE.md#6-the-shard-manifest-game)
lists every ring and compass-band field. `horizon: { rings: [], cloudSea: false }` removes the default ridges
and cloud floor. `boundary: { visible: false }` removes only the drawn edge dressing; player containment remains active.

Creature navigation normally excludes submerged terrain. For an authored exclusion beyond swimming water (for example a herd avoids a whole river corridor), declare `navmesh.excludeGroundAt(x, z, y)` in the node-safe manifest. It excludes only the terrain soup; registered decks still carry creatures over it. Re-bake with `pnpm gen && node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-navmesh.mjs <slug>` and commit both navmesh files.

## 4. The plugin verbs

The plugin has three hooks, each awaited in its boot stage ([ENGINE.md §5a, §7](ENGINE.md#7-the-shard-plugin-and-the-registry)).
Every verb is bound to your scope: what you register goes away when the level unloads.

| Hook | Stage | Put here |
|---|---|---|
| `world(ctx)` | `level.world` | `ctx.strings`, `ctx.tiers.knobs`, world building with `ctx.piece`, interactables, `ctx.playground` |
| `kit(ctx)` | `level.kit` | every row: `ctx.rows.weapon / tool / ammo / effect / damageRule / species / speciesLook / encounter / spawnTable / item / lootTable / skin / feat / shop / compendium / places`; set `ctx.game.runtime.buildEquipment` |
| `play(ctx)` | `level.play` | systems (`ctx.system`), events (`ctx.on`, `ctx.answer`), input contexts, HUD, Bag tabs, quests, encounters, Debug rows, `ctx.debug.expose` |

**Rows only in `kit`.** A row verb called in `world` or `play` throws. The loadout is built from the rows when `kit`
returns, so `play` can't add a weapon.

Mount a custom weapon's finished camera-space model in `play` with `ctx.app.equipmentHost?.viewmodel.add(model)`;
remove it with `ctx.scope.onDispose`. The engine owns the camera and shared depth-clear pass ([ENGINE §18](ENGINE.md#18-combat-equipment-weapon-tool-gas-lite)).
The template mounts its whip and lantern this way. No camera insertion or local depth-clear mesh is needed.

**`ctx.game.runtime`** is the shell's handoff while the API grows: the built world (`runtime.world`), the player kit
and UI (`runtime.play`), `buildEquipment`, `hooks`, `interactables`. It is `undefined` in the headless contract test,
so read it with `?.`.

**Never** add a DOM input listener, write to `window`, append to `#hud` or `document.body`, read `localStorage`, call
`Math.random` for gameplay, or patch a shader with `onBeforeCompile`. Each has a verb (§15 lists the rules).

## 5. Weapons and Tools

Pick the lowest rung of the ladder that works ([ENGINE.md §18](ENGINE.md#18-combat-equipment-weapon-tool-gas-lite)):

| Rung | When | Example |
|---|---|---|
| **Profile** | a kit family does it; you change numbers | `new Sword(world, targets, { row: IRON_SWORD, profile: SWORD_IRON })`; `new Bow(world, targets, { row: LONGBOW, profile: LONGBOW_PROFILE })` |
| **Extend** | a kit family almost does it | `class LeverRifle extends Firearm` (Pine Hollow) |
| **Custom** | nothing in the kit is close | `class TemplateWhip extends Weapon` built from `blocks.viewmodel` + `blocks.melee` |

The trusted runtime families are defined by `@wildshard/sdk/runtime/weapons/{Melee,Thrown,Firearm,SweptMelee,Bow}`.
The existing starter recipes use `@wildshard/sdk/runtime/weapons/Sword` and `.../starterBow`; their defining
`starterMoves`, `starterMeleeProfile`, `starterBowProfile`, `starterEquipment` and `starterGlyphs` modules preserve
shared recipe identities. These are transitional trusted runtime ports, not uploaded TypeScript author hooks.
A Sword always receives an explicit shard-owned `rig`; the family supplies contact and view execution, not a model.
A Bow profile supplies its own model and arrow strategies. Models stay in the owning shard's lane.

For each weapon:

1. **A row** (`EquipmentRow`, in `weapons/rows.ts`): `id: 'weapon.<name>'`, `ui` (name, icon, touch mode, lock-on,
   its `inputContext`), `meta` (name, icon, blurb, category), `cues`.
2. **Register it** in `kit`: `ctx.rows.weapon(ROW)`, and list its id in `manifest.loadout`.
3. **Build it** in `ctx.game.runtime.buildEquipment`: return `{ primary, secondary, rifle, install }`. `install` adds
   tools and unlocks.
4. **Its input context:** `ctx.inputContext({ id, actions: ['attack', 'heavy', 'lock'], keysFrom: 'weapon.melee',
   touch: { mode: 'melee', lockable: true, relabel: {} } })`. The baseline keys are Attack = Mouse0 / F,
   Heavy = Mouse2; `keysFrom` follows the player's rebinds. Add only your extra `keys`, or override a baseline action
   explicitly (`[]` unbinds it). The shell pushes the held weapon's context (named in `row.ui.inputContext`).
   Bind both actions in your weapon's `install`: `app.input.bind('attack', () => this.tryFire(), scope)` and
   `app.input.bind('heavy', () => this.swing(true), scope)`, gated by `this.enabled`. On touch, a still ATTACK hold
   raises `adsHeld`, fills your `charge` readout, and its true → false transition releases the heavy. A light tap
   already fires on touch-down; do not read `altHeld` for melee heavy (that field serves a bow's draw).
   The template's `TemplateWhip.install/update` shows both paths and cancels a pending charge when holstered.
5. **Its slot type:** merge the legacy slot into `EquipmentSlotMap` (`declare module '@wildshard/engine/combat/Equipment' { interface EquipmentSlotMap { … } }`: augment the module that declares the interface).
6. **Damage** goes through the pipeline (`blocks.melee(app.combat).hit(req)` or a family's own path). An effect on a
   hit is `app.effects.apply(actor, 'effect.poison')`.

**A Tool** (`extends Tool`) runs beside the weapon: `slot: 'offhand'` or `'tool'`, its own `actions`. Register it with
`ctx.rows.tool(ROW)`, add it in `install` (`equipment.add(tool, { locked: false })`), give it an input context and push
it yourself: `ctx.app.input.push('<slug>.lantern', ctx.scope)`. The template's lantern and Nine Dragon's Fei Zhua are
the examples. The kit's hoverboard (`tool.hoverboard`) is on every shard.

After changing `manifest.budgets`, run `pnpm gen --shard=<slug>` and commit your slug’s generated
`derived` entry in `budgets/ceiling-sources.json`. This command preserves every other slug and all measured
GL ceilings and approval evidence. The gate checks freshness before generation. Measured GL re-records still
require the lead’s approval and `scripts/budget-ceilings.mjs --accept=<approval>`.

## 6. Creatures

A creature is two rows plus, usually, a brain ([ENGINE.md §19](ENGINE.md#19-creatures-and-ai)).

1. **A `SpeciesRow`** (`species/<name>.ts`): `id`, `kind`, `label`, `variants`, `aggressive`, and `think` / `act`
   that call your brain. Simulation only: no three.js beyond math.
2. **A `SpeciesLook`**: `species`, `kind`, `rig`, `rigContract` (skeleton, sockets, clips), `build()`, `animate()`.
   Every creature needs `body` and `head` in `build().bones`, with `body` first, and both in
   `rigContract.sockets`. This includes flying / custom rigs: the bones anchor their hit capsule and head sphere.
   A ray can use a small head bone under `body` without a separate head mesh. Registration rejects missing socket
   declarations by species and bone name; the factory checks the built bones too. Use `rig: 'custom'` and your own
   `animate` when you do not use the default quadruped skeleton.
3. **A brain**: `class MyBrain extends CreatureBrain<'idle' | 'fight'>` with `think` (decisions) and `act` (the body).
4. **Strikes as data**: `StrikeSpec` rows with a shape (`arc`, `lane`, `ring`, `wedge`, `point`, `sphere`), timings, damage,
   tags and a utility `weight`. A `StrikeRunner` picks and runs them on the body clock.
5. **Register** in `kit`: `ctx.rows.species([...])`, `ctx.rows.speciesLook([...])`. List the kind in
   `manifest.species`.

**A flying creature** adds `flight: { altitude: 17, above: 'ground', climbRate: 7, diveRate: 28 }` to its species.
Its `act` calls `ctx.flight.steer(animal, yaw, speed, altitude, turnRate?)`; the engine owns position and samples
the ground at about 5 Hz. `above: 'world'` uses absolute altitude over islands or a void; ground-relative flight
also falls back to world altitude without a floor within 200 metres. Use `sphere` for actual 3-D strike contact,
and animate bones rather than writing `position`, `driven` or `yOffset`.

Model your creature facing **+Z**, with +Y up. `BoneDef.pos` uses **absolute bind-space coordinates**, not a
parent-relative offset: the factory subtracts the parent position. A child head at `[0, 1.2, 2]` under a body at
`[0, 1, 0]` is 0.2 metres above and two metres in front of the body.

A kit species (`BOAR`, `BEAR` and their looks) needs no code: register the rows. Spread a row to add a variant:
`{ ...BOAR, variants: [...BOAR.variants, { id: 'greyback', … }] }`.

**Encounters.** Register the ids in `kit` (`ctx.rows.encounter`, `ctx.rows.spawnTable`), then in `play`:

| What | How |
|---|---|
| an elite | `class MyElite extends EliteBrain<Animal>`; `ctx.app.encounters.elite(id, brain, ctx.scope).spawn()` |
| a boss | `class MyBoss extends BossBrain` with a `BossScript` and HP-threshold phases; `encounters.boss(id, brain, scope).arm()`; answer `death.checkpoint` |
| a spawn table | `ctx.rows.spawnTable({ id, table: { mode: 'each' \| 'weighted', rows } })`; `encounters.spawn(id, scope, { create, retire })` |

Creature tags are `creature.<kind>`. Quests and loot listen for `actor.died` and read the tags.

Push creatures with `animal.impulse(worldVelocity)` (metres per second), rather than writing their positions.
For worlds with a void, declare `world: { killY: 6 }` in the manifest; the engine kills creatures below it with an
`out-of-world` cause. Read `actor.died.req.cause` for the result. Omit `world` on normal ground worlds.

## 7. The look

Your look is a `LookStrategy` in `look/render.ts`, loaded through `manifest.render`
([ENGINE.md §13.1](ENGINE.md#131-lookstrategy)). It may declare its own `manifest.style` string.
`style` is a label; use `kitLook`, `creatures` and your
`LookStrategy` to declare rendering behavior, as Sky Reach does with `style: 'skyReach'` and `kitLook: 'toon'`.

- **`extend`** (most shards): add passes around the engine's chain; `c.engineChain('clean' \| 'cinematic')` is the
  engine's. Driftwood, Pine Hollow, Nine Dragon and the template extend.
- **`replace`**: build the whole chain (`{ chain: Pass[] }`). Nalati does, for its painterly composer.
- The parts: `backdrop` (sky and day clock), `sky` (`{ clouds, planet }`), `lighting`, `shadows`, `fog` (slot 300),
  `fogControl`, `terrainPainter`, `grass`, `frame`, `dispose`.
- Every shader edit goes through `patchShader(material, id, PATCH_ORDER.decorate, fn, { scope })`.
- Tier differences (FXAA on phone, no god rays) are tier knobs in the manifest, not code in the look.
- **No facade multi-draw** anywhere (E271): instance repeated geometry.
- Work the look in the mockup loop: a live capture, a mockup board, Jake's pick, then build to match. Driftwood stays
  low-poly; each shard's look is its own.

A custom `terrainPainter.build(terrain, field, scope)` receives the live owning level scope. Use
`scope.own` for resources you create and `patchShader(..., { scope })` for its shader edits; add your meshes to
`terrain.group`. The scope releases them on failed boot or level unload. Shared asset leases retain their own
ownership; do not also own those resources. See [ENGINE §13.1](ENGINE.md#131-lookstrategy).

## 8. Audio

- **Cues.** Weapons and the engine emit `cue.*` ids. Your cue map (`audio/cues.ts`) plays a sound for each:
  `runtime.play.cues.use((id, opts) => { … return true; }, ctx.scope)`. Return `false` for a cue you don't handle.
- **Ambience and score.** `manifest.audio.ambience` and `.score` name them; `preload` builds the audio profile. The
  kit has a forest ambience (`installForestAmbience`) and a silent score (`installSilentScore`).
  For **no ambience**, use `audio: { ambience: 'none', score: '<your score id>' }`, omit `bed`, and do not install
  forest ambience, sampled beds or ambient zones in your plugin. The label declares your choice; playback comes
  from the installed content. SFX cues, music and their `preload` can still be supplied independently.
- **New sound is made locally.** Music: MiniMax Music 3. SFX: MOSS-SoundEffect v2 and Stable Audio 3 Medium, the
  better take per sound. Both run under the shared model lock (AGENTS.md "Local models"). Put the files in
  `public/assets/music/<slug>/` and `public/assets/sfx/<slug>/`.
- The credits "Music: MiniMax-Music3" and "Powered by Stability AI" stay.

## 9. Budgets and tiers

- **Targets:** 30 fps on the phone tier, 60 on desktop. Memory: 1.8 GB while loading, 1.0 GB in the world, hard.
- **`budgets.ts`** holds inputs only: per tier `fps`, `variability`, `cpuMs`, `gcMs`, `systems`, `vertexShare`, `lanes`,
  `linkMs`, plus `load`. The engine derives draws, triangles, programs and GPU MB. The gate fails a shard over them.
  Copy the template's numbers and adjust the system split to what your shard runs.
- **Tier knobs** in `manifest.tiers.phone` / `.desktop` override engine defaults (`aa`, `ao`, `godRays`, `msaa`,
  `shadowFar` …). Declare your own with `ctx.tiers.knobs({ id, defaults })` and merge the key into `TierKnobMap`.
- Never cut render resolution to make a number. Optimise until it holds.

## 10. Saves

- Define a key with `ctx.app.saves.define({ key, scope, version, schema, initial })`. Keys are dot-case and prefixed
  with your shard: `<slug>.notes`.
- Shard state is `scope: 'shard'`; read and write with your slug: `slot.read(ctx.manifest.slug)`.
- The shared game keys (purse, progress, bosses, elites, compendium, owned) come from `@wildshard/game/saves`; bind them with
  `shardSave(purseSave, ctx.manifest.slug)`.
- Change a shape → bump `version`, add a `migrate` step. Never touch `localStorage`.

## 11. Strings

Every line a player reads lives in `strings.ts`, one `as const` object. Register it in `world` with
`ctx.strings(STRINGS)` and use `STRINGS.<key>` everywhere: card text, HUD labels, toasts, quest steps, Debug rows.
English only.

## 12. Quests, Bag, coins, compendium, feats

These are game mechanisms: list them in `uses`, then wire them in `play`.

| Mechanism | How |
|---|---|
| quests | `new QuestState({ id, title, completeFlag, steps }, new Flags(slug), ctx.app.events, ctx.scope)`; set flags from systems and events |
| coins, loot | `installLoot({ ctx, manifest, … })`; `CoinBurst` for a reward; rows `ctx.rows.lootTable`, `ctx.rows.shop` |
| compendium | `ctx.rows.compendium(row)` in `kit`, `installCompendium({ … })` in `play` |
| feats | `ctx.rows.feat({ id, name, goal, count, event, … })`; `progress.recordEvent(event, 1)` counts it |
| Bag | `manifest.bag.tabs`; `ctx.bag.tab(spec)`, `ctx.bag.fragment(tab, fragment)` |
| items | `ctx.rows.item(row)`; set `travels: true` only for an item that crosses shards |

For Wendell's quest presentation, use one call in `play(ctx)`:

```ts
import { installQuestPresentation } from '@wildshard/game/quest/presentation';
import { Vector3 } from 'three';

const view = installQuestPresentation(ctx, {
  id: 'template.quest', title: STRINGS.quest, completeFlag: 'template.quest.done',
  steps: [{ id: 'bell', title: STRINGS.findBell, done: { all: ['template.bell.rung'] },
    target: { position: new Vector3(12, 4, -20), label: STRINGS.bell } }],
});
// In the bell's authored interaction:
view.quest.flags.set('template.bell.rung');
```

This installs the objective chip, active minimap diamonds, styled world pins, MAP card, saved discovery at targets,
step toasts and a seven-second reward caption. A target can supply an `npc` (definition, head position, talk label,
speaker); `options.npc` is a persistent giver. Existing `QuestState` / `QuestDef` quests work too: retain
`startWhen` / `intro` and markers, with `options.place` for POI-local positions. Supply `flags` to share the
interaction store, `places` for authored discovery radii and `reward` for a held camera / clock view and award
in `finish()`; use `reward: false` when your finale owns that moment. Models, gestures, conditions and prizes
stay in the shard. The scope removes the presentation; map overlays coexist with loot charts.
See [ENGINE.md §20](ENGINE.md#20-the-game-layer-game) for options and the completion-card handoff.

## 13. Debug rows, playgrounds, Explore

- **Debug rows:** `ctx.debugRow({ id, group, label, choices, initial, change, note, ask: 'E<n>', reviewBy })` in an
  existing group. The row shows only on your shard and its value is saved per device. Every new row raises the
  Debug-row count in `lint/ratchet.json` (`debugRows.max`), which is outside your lane: ask the lead (an API gap) when
  you add one. When Jake picks a winner, delete the row and the losing code in one commit.
- **Debug handles:** `ctx.debug.expose('<name>', value)` puts a handle on `window.__wildshard.shard[name]` for
  captures and tests.
- **Playgrounds:** `ctx.playground({ id, title, blurb, icon, load })`; the class implements `Playground`. Its pieces
  are registry pieces with `active: () => this.entered`.
- **Explore:** `manifest.explore.art` and `manifest.roster`. Every model a player can see belongs in the roster.

## 14. Assets

- Your assets live in your folders: `public/assets/<slug>/`, `gpu/<slug>/`, `baked/<slug>/`, `music/<slug>/`,
  `sfx/<slug>/`, `horizon/<slug>-*`, `lut/<slug>.bin`, `title/<slug>-portrait.jpg`. List the extra ones in
  `assetGlobs`. An `/assets/…` path outside them fails `wildshard/shard-sandbox`.
- Declare every file the boot needs in `boot.files(tier)` / `boot.sources`, audio in `boot.audio`, Explore art in
  `boot.explore`. The loading bar and the offline cache read these lists.
- **Models:** follow the `mockup-to-model` skill. A Blender model is a script in `scripts/blender/<slug>/` with a row
  in `scripts/blender/targets.json`; commit the GLB, never a `.blend`.
- KTX2: once you bake KTX2 art, commit your `ktx2.generated.ts` and add `ktx2: () => import('./ktx2.generated')`.
- Commit images as JPEG; a `progress/` image over 500 KB is refused.

## 15. The guards it must pass

| Guard | Runs | Run it yourself |
|---|---|---|
| `wildshard/layer`, `wildshard/public-index` | pre-commit, `pnpm test` | `node lint/ratchet.mjs`. Imports: the modules `@wildshard/engine`, `@wildshard/game` and `@wildshard/kit` export (each name from the module that defines it, `docs/api/`), and `./` inside your folder. No other shard; no re-exports (`wildshard/no-reexport`) |
| `wildshard/shard-sandbox` | pre-commit, `pnpm test` | same. No `window` / `globalThis`, no window or document input listeners, only your own settings and asset folders |
| `wildshard/engine-words`, `wildshard/shard-names` | pre-commit, lint (hard) | what is particular to your shard (its creatures' labels and tuning, its places, its tree set, its pickups' and icons' ids, its strings) lives in your folder; reusable content goes to `@wildshard/kit`. The engine names no content and the game and kit name no shard (E405 LAYER-PURITY): when you need the engine to know something, hand it in as data (a species row field, `registerPickupLook`, `ctx.strings`, the manifest's `blender.area` / `forest.speciesTraits`) — ask the lead for a new hook rather than writing your slug into shared code |
| `wildshard/shard-services` | pre-commit, `pnpm test` (ratchet) | take the engine's services from `ctx` (`ctx.app`, `ctx.hud`, `ctx.game` …); importing `app`, `saves`, `hudSlots`, `practiceRoom` or `lockOn` from an engine module fails a new file |
| `wildshard/engine-internal` | lint (hard) | the game's own engine exports (`lint/engine-internal.json`: session, boot, title, installers) are not yours to import; what you need from the engine arrives through `ctx` |
| `wildshard/no-level-identity`, `no-shard-branch` | pre-commit, lint | they guard the engine and game against branching on your slug; in your folder, keep identity checks out of shared helpers |
| the hard rules (`no-raw-save`, `no-raw-input`, `no-raw-hud`, `no-raw-shader-patch`, `no-raw-animation-mixer`, `no-url-switch`) | lint, pre-commit | `pnpm exec oxlint src/shards/<slug>` |
| the ratchet | pre-commit, `pnpm test` | `node lint/ratchet.mjs`: a new shard's files start at 0 on every ratcheted rule |
| the layout check (AG9) | pre-commit when `src/shards/**` changes | `node scripts/check-shards.mjs` |
| the manifest contract (AG10): `load: () => import('./plugin')`, the cold-boot closure within its budget (`lint/manifest-closure-budget.json`; a new shard gets `default`, 40 files) | push gate, `pnpm test` | `node scripts/gen-shards.mjs --check` |
| the layer graph (AG7): no new layer pair or rising count, nothing outside your folder imports your files | pre-commit, `pnpm test` | `node scripts/check-graph.mjs` |
| `gen-shards --check` | pre-commit when a manifest changes, the gate | `node scripts/gen-shards.mjs --check` |
| node-safe manifest | `pnpm test` | `pnpm exec vitest run test/manifests-node-safe.test.ts` |
| the world contract (SHARD-PLATFORM SP4) | `pnpm test` | `pnpm exec vitest run test/world/world-contract.test.ts`: your ground stays inside the 500 m cell (250 m below and above the highway level) and is level with the highway across the 15 m road at each edge midpoint, 50 m in. A level that can't (open sea, floating islands) is listed in `lint/edge-exemptions.json` with the row that fixes it; the list may only shrink |
| your contract test | `pnpm test` | `pnpm exec vitest run test/shards/<slug>` |
| the lock | every commit (`commit-msg`) | commit only inside your allowlist |
| the pre-push gate | every push | `scripts/vercel-tree-gate.sh` runs check-css, gen, tsc, oxlint, the ratchet, vitest and `vite build` on a clean export |
| the gate | every push to main | one `macos-15` job per shard: boot, walk, combat, the leak test, budgets. A new shard's first run records its baselines |

Strictness holds: no `any`, `!`, `as unknown as`, ts-ignore, and no blanket `oxlint-disable`.

## 16. The checklist: template → playable → live

### Template copied
- [ ] Folder copied, slug = folder name, `status: 'experimental'`, ids renamed, unused verbs deleted.
- [ ] `pnpm gen`, `tsc`, your contract test and `node scripts/check-shards.mjs` pass.
- [ ] `README.md` says what the shard is (it grows with the shard).

### Playable
- [ ] Ground, spawn, bounds; the player walks with 0 stuck (`node scripts/physics-baseline.mjs --no-build --mode=walk`).
- [ ] The look: a `LookStrategy` matching Jake's picked mockup.
- [ ] At least one weapon (rung 2 or 3 for a new idea), its cues and input context.
- [ ] At least one creature with its own brain and strikes.
- [ ] One quest step and its reward; strings for every line.
- [ ] Budgets and tier knobs; it holds 30 fps on the phone tier in a capture.
- [ ] It boots on a served build (`scripts/serve-build.sh`) with no errors; unload and reload leave the census clean.
- [ ] Portrait iPhone captures of every new thing, as boards in `art/<slug>/` for Jake.

### Live
- [ ] The gate's job for your shard is green on every push.
- [ ] Jake has played it and picked the board items.
- [ ] Open leftovers are rows of the shard's plan (never ask files, docs/process/ASKS.md), linked from your README.
- [ ] `status` moves `experimental` → `earlyAccess` → `live` on Jake's word, one commit each. `hidden` is for the template only.
- [ ] The README lists what the shard declares, its custom code and why, budgets, look and open work.

---

## History: the pre-normalization shard guide

This is the guide as it stood before GAME-NORMALIZATION (E357), kept as written for its history: the three shards'
first looks and systems, the Wildshard fundamentals, and Driftwood's low-poly pieces. **Its paths and steps are out of
date** (`ChunkDef`, `src/chunks/`, `CHUNKS`, `main.ts` branches, `?chunk=` links). Follow the sections above.

### Shards — Driftwood Isle, Pine Hollow, Nalati Grasslands (and how to add a fourth)

The demo runs one Wildshard *chunk* (we call an authored chunk a **shard**) at a time. Every shard is a 500 m × 500 m
floating slab with its own biome, built by the same engine from a `ChunkDef` (`src/game/shard/manifest.ts`) and listed in
`CHUNKS` (`src/game/shard/registry.ts`). Shards are picked on the title deck (or with `?chunk=<slug>`), and the page reloads
to switch — chunks are not adjacent or streamed.

**The deck order is `CHUNKS`' order:** Driftwood Isle first (the default, `DEFAULT_CHUNK`; the user's rule PH-U19), then
Pine Hollow, then Nalati Grasslands. A shard still being built carries a flag the deck shows on its card:
`experimental` (a hazard-taped EXPERIMENTAL band, and "Experimental · rough edges" under ENTER WORLD) or `earlyAccess`
(an EARLY ACCESS tag; playable by everyone). A shard **graduates** by dropping the flag — Pine Hollow did at the end of
its remaster (PINE-HOLLOW-REMASTER PH-S2).

**Each shard keeps its own style** (PH-U1). The shards share the engine and the house *pipelines* (mockup loops, Blender,
image-to-3D, the learned LUT fit, horizon painting, the rig bake), never each other's shading. A fourth shard picks a
look of its own.

### The three shards

| | Driftwood Isle | Pine Hollow | Nalati Grasslands |
|---|---|---|---|
| Def | `src/shards/driftwood-isle/manifest.ts` | `src/shards/pine-hollow/manifest.ts` + `pineHollowLayout.ts` | `src/shards/nalati-grasslands/manifest.ts` + `nalatiLayout.ts` |
| What | A small island in a bright ocean: the pier, a sailboat, the hut, a ring shrine, the wreck in the cove | A boreal pine forest round a sheltered hollow: the ranger's cabin, a still pond under a granite ridge, the old-growth, the mill hamlet | A high Tian Shan steppe: the braided Kunes, the nomad camp, the golden bowl of the Sky Grassland, Snow Lotus Valley in the snow ring |
| Style | **Faceted low-poly toon** (`style: 'lowpoly'`) | **Photoreal PBR** (`style` omitted = `'pbr'`) | **Painterly** (`style: 'painterly'`) |
| Deck | first, the default | second (graduated) | third (EARLY ACCESS) |

#### Driftwood Isle — faceted toon

- **Look:** no textures at all — flat-shaded, vertex-coloured facets (`Terrain.ts` by height / slope, `world/lowpolyKit.ts`
  for every model); a two-band toon ramp with coloured shadows and a rim (`world/stylize.ts`); a stylized gradient sky
  with faceted cumulus (`world/StylizedSky.ts`) on a 20 + 4 min day (`world/DayNight.ts`); the learned 33³ LUT
  (`world/lut.ts`, `public/assets/lut/driftwood-isle.bin`); the painted 360° horizon (`world/HorizonMatte.ts`); a faceted
  sea (`world/Ocean.ts`). `?island=blender` swaps the spawn cove for the Blender-baked one (`world/BlenderIsland.ts`).
- **Systems:** the castaway spine (`game/quest/Spine.ts` + `driftwood.ts`: Wendell, the three shards, the altar) ending
  at the Drowned Captain (`game/quest/Finale.ts`); the island's enemies (`entities/Enemies.ts`: reef crabs, coconut
  monkeys, the drowned sailor at night); a sword; swimming and diving; the interactables table
  (`world/interact/driftwood.ts`).
- **Sound:** its themes, the `audio/IslandAmbience.ts` zones, `audio/IslandSfx.ts`.
- **Code:** the low-poly modules in `src/world/` (the table at the end), wired in `main.ts` under `if (chunk.ocean)`; the
  adventure through `ADVENTURES` in `game/quest/Adventure.ts`; `src/dev/driftwood.ts` is the reference wiring.

#### Pine Hollow — photoreal PBR

- **Look:** Poly Haven PBR sets on a splat terrain with the boreal ground shader; the Blender-built species set (the hero
  Scots pine, fir, the old-growth giants, birch, snags, saplings — `world/treeSpecies.ts`, `world/treeSet.ts`,
  `scripts/blender/pine-hollow/trees/`) baked into the card + impostor LOD; one shared wind (`world/wind.ts`); a full day from seven
  pure-sky keys blended on a dome that re-lights the IBL (`world/PineDayNight.ts`, `pineSkyKeys.ts`); dawn ground fog
  and rain showers (`world/PineWeather.ts`, `PineWeatherFX.ts`); the pond, creek and waterfall on one water program
  (`world/waterSurface.ts`, `PineStreams.ts`); the painted far country at infinity (`world/Horizon.ts`); the Ridge's
  granite skin, its crag kit and the bear cave (`world/PineCrags.ts`, `scripts/blender/pine-hollow/crags/`); the learned LUT
  (`public/assets/lut/pine-hollow.bin`).
- **World:** the three cabins (`world/Cabin.ts`); the mill hamlet, the fire lookout + zipline, the footbridge, the
  standing stones, the waystones, the dam and the canoe (`world/PineLandmarks.ts`; the image-to-3D hero props in
  `public/assets/models/pine-hollow-hero/`).
- **Systems:** the ranger's lantern quest *The Warden's Hollow*, the lodge's rotating contracts, the trader and the
  miller, amber resin / carved tokens / secrets, the night thralls (`src/shards/pine-hollow/quest/`); the Antler King
  (`pinehollow/antlerKing.ts`, `kingModel.ts`, on the engine's `game/Boss.ts`) and four elites (`pinehollow/elites.ts`,
  `game/Elite.ts`); generated, rig-baked creatures in PBR coats with rarity and legendaries (`entities/pineCreatures.ts`,
  `pineCoats.ts`, `pineCreatureRigs.ts`); the small life — ravens, the owl, a woodpecker, hares (`pinehollow/life/`);
  the crossbow, the lever-action and the Warden's Longbow (`pinehollow/loadout.ts`); the hunter's journal and the trophy
  wall (the engine Compendium: `ui/compendium/` + `shards/pine-hollow.ts`, `world/TrophyWall.ts`); 19 achievements
  (`game/achievements.ts`).
- **Sound:** theme 1 (pine calm / tension) + calm-night, the King's three stems and the dawn sting; zoned beds and
  interior reverb (`audio/ForestAmbience.ts`); the generated one-shot sprite and the NPC barks (`audio/PineHollowSfx.ts`,
  `public/assets/sfx/pine-hollow/`).
- **Code:** `src/shards/pine-hollow/manifest.ts` + `pineHollowLayout.ts` (every site), `src/pinehollow/` (installed from
  `main.ts`), the `Pine*` modules in `src/world/`. Captures: `scripts/pine-hollow-views.mjs` (the 9-angle anchors),
  `scripts/pine-hollow-perf.mjs` (the phone / desktop ruler).

#### Nalati Grasslands — painterly

- **Look:** every mesh on the painterly shading (`world/painterly.ts`); a painted panorama sky + a day clock, a cloud sea,
  fog, the grade and the zone tints (`src/shards/nalati-grasslands/look/`); its own spruce factory (`trees.factory: 'spruce'`); three zones,
  each in its own colour (the green valley, the golden bowl, the snow ring).
- **Systems:** its own kit — bow, sabre, spear (`player/nalatiKit.ts`) — and riding (`nalati/ride.ts`); the quest core
  with three chapters (`game/quest/nalati.ts`, `nalati/adventure.ts`); two bosses, the Golden King in his kurgan
  (`nalati/kurganBoss.ts`) and the Storm Titan (`nalati/stormTitan.ts`); elites, stealth, kokpar, the night riders, the
  storm (`src/nalati/`); generated creature hulls rig-baked to the species' skeletons (`entities/creatureRigBake.ts`,
  `public/assets/nalati/models/`).
- **Sound:** the Kazakh score and Nalati's sound set (`nalati/sound.ts`).
- **Code:** `src/nalati/`, `src/shards/nalati-grasslands/world/`, `src/ui/NalatiHUD.ts`, `src/dev/nalati-*.ts`. (On main since v0.3.0;
  the Pine Hollow branch picks it up when it merges main in.)

### What the shards share (the engine)

`bootstrap()` and the boot plan (`core/bootstrap.ts`, `boot/`), Rapier physics and the navmesh (`physics/`), the player and
the weapons, `Animal` / `AnimalManager` / the species registry (`entities/species/`), `Elite` / `Boss` and their bars, the
creature rig bake, the interactables kit (`world/interact/`), the quest core (`game/quest/quest.ts`, `QuestUI.ts`), the
Compendium, Progress + achievements, Explore World (`explore/`), the HUD and the title deck (`ui/`), the per-shard LUT.
The pipelines take the shard as an argument: `scripts/blender/build.sh <slug>/<target>` (`scripts/blender/<slug>/`), `fit-lut.py --shard`,
`scripts/horizon-matte/`, `scripts/img2mesh/`.

### Adding a fourth shard

1. **Pick its style.** Not one of the three (PH-U1). Run a mockup loop first (`art/<shard>/round-<n>-<label>/`) and let
   the user pick from a board.
2. `cp src/chunks/_template.ts src/chunks/<slug>.ts`, rename the export, fill in every field (the template comments
   explain each one; the table below says what each drives). Keep every coordinate in a `<slug>Layout.ts` beside it.
3. Art for the deck: a 640×360 `src/chunks/thumbs/<slug>.jpg` (no crossbow in frame) + the portrait and landscape hero
   backdrops. Until it is authored it can sit in the deck as a teaser (`src/chunks/placeholders.ts`).
4. Add the export to `CHUNKS` in `src/game/shard/registry.ts` — **after** the three (Driftwood stays first) — with
   `experimental: true` or `earlyAccess: true` until it graduates.
5. Bake it: `scripts/bake-chunk.mjs` (the terrain, fingerprinted), `scripts/bake-navmesh.mjs <slug>`, then the byte and
   pack tables (`scripts/bake-packs.mjs`).
6. Its own nouns on the loading screen: a `SHARD_STEPS` entry in `src/engine/boot/steps.ts` (each step names what it really
   builds there; `test/boot-plan.test.ts`).
7. Its game layer: an adventure (`ADVENTURES` in `game/quest/Adventure.ts`, or a `src/<shard>/` installer called from
   `main.ts` as Pine Hollow and Nalati do), an achievements table (`TABLES` in `game/achievements.ts`), a compendium
   (`ui/compendium/shards/<slug>.ts`) if it hunts, and its sound.
8. `npx tsc --noEmit`, `pnpm lint`, `pnpm test` (`test/chunks.test.ts` checks every def), then
   `http://localhost:5173/?chunk=<slug>&nolock=1&skipintro=1`; screenshot it headlessly (`docs/SUBAGENT-BRIEF.md`) on
   the phone and the desktop, and give it rows in `bench.budget.json`.

Nothing outside `src/chunks/` has to change for a shard that reuses the engine's pieces as they are; new trees,
creatures, dressing or a new style are engine work (below).

### What is fixed by the Wildshard fundamentals

E357 B83: the four original world-grid shards retain the four midpoint entry trails below; new shards (including experimental and hidden teaching shards) declare their own roads and need at least one trail starting in the spawn area.

These live in `src/engine/core/config.ts` and `src/engine/world/terrainField.ts` and are **not** per shard:

| Rule | Where it is enforced |
|---|---|
| Chunk is 500 m square, origin at the centre, spans ±250 on X and Z | `CHUNK_SIZE`, `CHUNK_HALF` |
| 100 m of rock under the surface (the floating slab) | `CHUNK_DEPTH`, `Terrain.buildSlab()` |
| A 15 m wide entry road at each of the four edge midpoints | `ROAD_WIDTH`, `entryRoadMask()` in `terrain.ts` |
| Each road reaches ≥ 50 m into the chunk (we use 60) | `ROAD_LENGTH` |
| Roads are level with no-man's-land (y = 0) at the boundary and ramp up inside | `buildTerrain().heightAt` |
| Terrain mesh resolution 256² | `TERRAIN_RES` |
| Boundary wall / no-man's-land warning at the edges | `src/engine/world/Boundary.ts`, HUD |

`buildTerrain()` applies the road levelling on top of *any* landscape you write, so a shard cannot
break the contract by accident — but keep the first segment of the four entry trails exactly as in
the template so the dirt texture and prop placement follow the road.

### What each `ChunkDef` field does

| Field | Drives | Notes |
|---|---|---|
| `id`, `slug`, `displayName`, `gridCoords` | HUD chunk panel, loading screen, title screen, `?chunk=` | `id` is `chunk://local/<slug>` |
| `seed` | every `Rng` / `Noise2D` in the engine (`SEED` in config is a live binding of it) | pick a fresh one per shard |
| `treeCount` | `Forest` places at most this many trees | `TREE_COUNT` live binding |
| `biome`, `blurb`, `thumbnail`, `heroPortrait`, `heroLandscape` | the title deck (the blurb is the card's tooltip: one pitch in the house voice) | |
| `experimental`, `earlyAccess` | the deck's EXPERIMENTAL band / EARLY ACCESS tag | dropped when the shard graduates |
| `terrain` | `heightAt/normalAt/splatAt/trailDistance/cabinMask/pondMask/waterLevel`, `TRAILS`, `CABIN_SITES`, `POND` re-exported by `src/engine/world/Heightfield.ts` | built by `buildTerrain(seed, spec)` |
| `terrain` spec → `landscape(x, z, noise)` | raw height before roads/pads/trails/pond | use the seeded `noise.n` / `noise.n2` |
| `terrain` spec → `trails` | trail beds, dirt splat, prop placement (`Props`), tree exclusion, animal placement | polylines in metres |
| `terrain` spec → `cabinSites` | `Cabins` builds one log cabin per site on a flattened pad | exactly what `Cabin.ts` expects: `{x, z, rot}` |
| `terrain` spec → `pond`, `pondFill` | basin dished into the landscape, `Water` surface, reeds/ferns/mist around it | omit `pond` for a dry shard (Water is skipped) |
| `terrain` spec → `splat(x, z, t, noise)` | four ground-layer weights for the terrain shader | any scale; normalised |
| `assets.groundLayers` | the four PBR sets blended by `splat` (DataArrayTexture) | ids under `public/assets/tex/` |
| `assets.groundTints` | per-layer albedo multiplier in the terrain shader | linear RGB |
| `assets.slabRock` | PBR set for the slab walls | |
| `trees.factory`, `trees.set` | which tree builder `bootstrap()` uses (`TREE_FACTORIES`), and the Blender species set it plants | `'pine'` (Pine Hollow; `set: 'pine-hollow-trees'`), `'spruce'` (Nalati) or `'none'` (no `Forest` trees: Driftwood's palms are their own builder, `src/shards/driftwood-isle/world/Palms.ts`) |
| `trees.bark`, `trees.twigAtlas` | trunk PBR set, twig atlas folder for the baked branch cards | |
| `trees.noun` | "2,600 pines" on the title screen | |
| `forest.*` | candidate spacing, clearing noise, slope limit, foliage HSL tint, big-variant share | see `Forest.place()` |
| `fauna[]` | `AnimalManager` herd plans: kind, count, optional anchor ring, canopy vs clearing, trail band, `variants` | `kind` is any registered species (`src/engine/entities/species/`: deer, boar, elk, bear, crab, monkey, sailor, captain); `FaunaKind` is `'deer' \| 'boar'` widened to any string, checked against the registry by `test/chunks.test.ts` |
| `sky.hdri` | HDRI for IBL + background; the sun direction is its brightest pixel | stems in `public/assets/hdri/` |
| `sky.sunColor/sunIntensity/envIntensity/bgIntensity` | CSM sun, environment and background strength | |
| `sky.fogSunColor`, `sky.cloudSunColor`, `sky.hemi*` | fog in-scatter tint, cloud layer tint, hemisphere fill | |
| `atmosphere.fog*` | exponential height fog + distance fog (`Atmosphere.ts`, also read by `Volumetrics`, `Water`, `Particles`) | |
| `atmosphere.volumetricSunColor` | god-ray colour | |
| `grade.*` | composer: saturation / brightness / contrast / bloom + `GradeEffect` split-tone | display-space |
| `spawn` | where the player stands on enter and respawn; `?x= ?z= ?yaw=` override | |
| `style` | `'pbr'` (default: textured splat terrain, PBR slab — Pine Hollow), `'lowpoly'` (Driftwood Isle: no textures at all — `Terrain.ts` builds flat-shaded, vertex-coloured facets by height/slope) or `'painterly'` (Nalati) | every lit thing in a lowpoly shard is `MeshStandardMaterial({ flatShading, vertexColors })` on non-indexed geometry |
| `weapon` | `'crossbow'` (default) or `'sword'` — the first-person weapon main.ts hands the player | |
| `ocean` | open water over the whole shard: `level` (sea surface, m), `shallowColor` / `deepColor` (linear RGB albedo — keep them dark, the midday sun + sky here add up to ~3×), `deepDepth` (m below the surface at which the water is fully deep) | `src/shards/driftwood-isle/world/Ocean.ts` (faceted, animated, depth-coloured, foam band) replaces `Water`; `Boundary` / `Horizon` sit on the surface and draw islets instead of ridges; pass `oceanLevel: ocean.level` to `buildTerrain` so `waterLevel()` agrees |
| `terrain` spec → `oceanLevel` | `waterLevel()` for an open-water shard (no pond dish) | the entry roads are still forced to y = 0, so a level a little above 0 makes them submerged sandbars under the piers |

### Tuning tips

- **Look first at the landscape.** `?chunk=pine-hollow&x=0&z=-235&yaw=3.1416&pitch=0&nolock=1&skipintro=1` is
  the south gate looking in; the pond pose is `?chunk=pine-hollow&x=-56&z=95&yaw=3.1416` (yaw 0 faces −z, away
  from the pond). The 9-angle cameras of five Pine Hollow anchors are in
  `art/pine-hollow/round-0-baseline/cameras.json` (`scripts/pine-hollow-views.mjs`). Take headless screenshots and read them.
- Keep the landscape within about −10..+40 m. Roads are forced to y = 0 at the edges, so a landscape
  that sits at +30 m near an edge gets a steep 60 m ramp.
- Cabin pads flatten a ~20 m radius; put sites on gentle ground, > 40 m apart, off the trails.
- `pondFill` above ~2 m floods the surroundings; the basin is dished ~3 m under the water line.
- `splat` weights are blended with a power curve in the shader; a layer under 0.1 barely shows.
- Sun colour + `fogSunColor` + `volumetricSunColor` + `cloudSunColor` should agree with the HDRI
  (pull them from its sun pixel), or the fog reads as a different time of day than the sky.
- The whole def is deterministic: same seed, same shard, every load.

### What is engine work (not a def field)

- **A new style** — `style` picks the terrain and material path (`'pbr'`, `'lowpoly'`, `'painterly'`); a fourth look is a
  new branch in `Terrain.ts` / `Sky.ts` and its own shading module, the way `stylize.ts` and `painterly.ts` are.
- **New trees** — `trees.factory` picks a builder in `TREE_FACTORIES` (`src/engine/core/bootstrap.ts`): `'pine'` (the baked
  card + impostor LOD; with `trees.set` it plants a Blender species set, `world/treeSet.ts`), `'spruce'` (Nalati) or
  `'none'` (Driftwood's palms are their own builder, `world/Palms.ts`).
- **A new animal** — one file in `src/engine/entities/species/<kind>.ts` ending in `registerSpecies({...})` (the contract is
  `src/engine/entities/species/registry.ts`); a def names it by `kind` in `fauna[]`. Generated hulls go through the rig bake.
- **Grass, undergrowth, props, particles** (`Grass.ts`, `Undergrowth.ts`, `Props.ts`, `Particles.ts`) use the shard's
  seed, terrain and pond, but their *content* is forest dressing; Driftwood and Nalati build their own
  (Nalati: `world/nalati/dressing/`).
- **The cabins** are the same log cabins on every non-ocean PBR shard (a def chooses only where, `cabinSites`); Pine
  Hollow adds the hamlet's buildings on the same kit.
- **The attract-mode camera path** (`src/engine/core/Tour.ts`) follows Pine Hollow's trails.
- **A shard's code as one module** (`ShardModule { build, look, quest, audio, fauna, loadSteps }`, ENGINE-FIT E5) is not
  built yet: each shard still branches in `main.ts` (moved to PINE-HOLLOW-FOLLOWUPS by PH-U32, archived `project/archive/2026-09-30-pine-hollow-followups.md`).

### Driftwood Isle — the low-poly pieces

The second shard (`src/shards/driftwood-isle/manifest.ts`, `style: 'lowpoly'`, `ocean`) is built from
flat-shaded vertex-coloured modules, each one mesh, each exposing `colliders` for
`player.colliders` and (where you can stand on it) `floorHeightAt(x, z)` for `player.platforms`.
`src/dev/driftwood.ts` is the reference wiring; main.ts mirrors it under `if (chunk.ocean)`.

| Module | What | Placement |
|---|---|---|
| `world/Ocean.ts` | faceted sea to the horizon, depth-coloured, foam band, `update(dt)` | `ChunkDef.ocean` |
| `world/Pier.ts` | jetty on rope-wrapped pilings, `bollards`, `posts`, `mooringsFor()` | the south entry road + `JETTIES` (N / W / E) |
| `world/Boat.ts` | moored sailboat, bobs in `update(dt)`, `ropes` mesh to the pier | beside the south pier |
| `world/Boulders.ts` | faceted rocks, `scatterShore(seed)` | the water line |
| `world/Hut.ts` | thatched stilt hut with porch + steps | `HUT` on the `PLATEAU` crag |
| `world/Palms.ts` | coconut palms with a vertex-shader sway, `scatterIsland(seed, n, avoid)`, `update(dt)` | beach top + groves |
| `world/Lookout.ts` | watchtower with stair and banner | `LOOKOUT` on the `HEADLAND` summit |
| `world/Wreck.ts` | beached two-master, cargo and driftwood | `WRECK` in `COVE` (east) |
| `world/Shrine.ts` | ring shrine on a dais with standing stones | `SHRINE` (north-west knoll) |
| `world/Bushes.ts` | shrubs with red hibiscus, `scatterIsland(seed, n, avoid)` | beach top + clumps inland |

The landscape is one function of the constants above (island disc, plateau, headland, cove,
shrine knoll), so moving a POI is a one-line change; the entry roads stay forced to y = 0 and are
the jetties' submerged sandbars. `scripts/bake-chunk.mjs` fingerprints the landscape into the bake
header and `BakedTerrain.ts` refuses a bake that does not match the live def, so a stale
`terrain.bin` (from before a def edit, or a service-worker copy) falls back to the analytic field.

The platform grid is assembled by `GridAssembly` from `game/grid/singleplayer.json`'s
separate `grid` section. Its stable instance ids own saves and facts; signed cells derive
render translations at 555 m pitch without entering local simulation state. Developer
and DEVSERVER replacements keep their existing slug identities. Missing outer neighbours
supply an open-sea, road-level edge and fog profile. Grid bounds pass a `grid` predicate
to `installBounds`: the grid driver owns horizontal traversal, while authored fall recovery
and standalone play bounds retain their existing behavior. Physics world changes and
fixed-step crossing notifications are supplied by the residency driver (SF18a).

Grid residency installs `game/grid/rules` with live cell-local provenance. Board cruise
is 30 m/s on the physical highway deck, easing across the 20 m strip to the admitted
`traversal.hoverCap` (default 15 m/s; an author may lower it). Standalone cruise stays
14 m/s. Visible neighbours are read-only: `gridCanAct` rejects their actions, and
`GridCombatRules` rejects damage before target reactions when either actor is outside
the writable interior or their stable instances differ. Terminal authored fall recovery
retains its separate path. Creature-only Rapier borders and the physics-owned movement
constraint cover ground, far and flying bodies. A scoped mounted passage suspends only
that home boundary; real WORLD colliders keep stopping the mount. `reframeGridUnit`
prepares rider and mount together without changing their velocity, yaw or separation;
the physics/residency driver commits their motors together.

A reload Debug row that changes the playable footprint or fall floor selects
`runtime.hooks.levelBounds(authored)` during world or kit setup. The game samples
it once before installing normal bounds recovery. Keep the manifest's shipping
bounds unchanged; the hook belongs to that session and never mutates a global
floor shared by another level.
