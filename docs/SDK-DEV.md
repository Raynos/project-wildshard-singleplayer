# Build and preview an author project

`@wildshard/sdk/runtime/audio/weaponVoices` exposes `sharedWeaponVoices` and
`declaredWeaponVoices` from the game-owned audio recipes. They preserve the existing
sample-first selection, authored melee-cue precedence, audio RNG order, timestamps
and mixer parameters. These are trusted runtime systems, not commons build imports.
`@wildshard/sdk/runtime/audio/silentScore.installSilentScore(music, scope)` mutes
only the score output and restores its previous gain on disposal; other sound buses
and the user's volume setting are untouched. Neither module installs on import.

The trusted `@wildshard/sdk/runtime/viewmodel/rigArms`, `armClips` and `armRig` modules expose the
platform first-person arm player, clip alias tables and arm IK measures by binding the defining game
systems; they own no second parse cache or mixer and carry no commons content.

The trusted `@wildshard/sdk/runtime/audio/combatCues` system routes stable equipment
cues into a supplied mixer through `sharedCombatCues`. It preserves existing sound
recipes, surface routing and silence policy without installing services on import.
This runtime module contains no commons content or build-time code.

The [SDK API catalogue](api/SDK.md) is generated from the package's defining public
modules and their JSDoc. The [schema and ABI reference](api/SHARDFILE.md) lists every
compiled shardfile field, every public SDK `*Schema` constant (including the
build-only `WorldSourceSchema`), and every admitted Wasm import/export call.
SDK schema paths use `$sdk["./module"].Schema`; `$` is the compiled shardfile.
Types, optionality, defaults, literals, union branches and bounds come from the
actual accepting schemas. New public schema constants are discovered through
`src/sdk/package.json`; they cannot silently miss the reference. Missing,
duplicate, obsolete or stale entries fail checks, and the serialized pusher
regenerates the appendix from committed source. Custom predicates remain named
opaque checks; [SHARDFILE.md](SHARDFILE.md) explains reference integrity and runtime
ownership, including `runtime.binds`, spawn homes/bosses/one-shot actors,
runtime-bound state, ranged/thrown contexts and native tools with no toggle action.

Use the installed SDK's `wildshard dev <project> [port]` to preview the normal
game client with the project's shardfile. Port 0 (the default) chooses a free
local port. The CLI prints the URL. It validates and builds a static product;
editing config, data, behaviour or source assets rebuilds it and reloads the
page. A failed rebuild keeps the last good product visible and reports the
error. Ctrl-C closes the watcher, HTTP server and temporary products.

The SDK distributes two compiled clients. `wildshard build` copies the
production client; `wildshard dev` copies the author client compiled with
`__DEVSERVER__=true`. A build option can choose a client directory or skip
copying the client (`buildProject`'s third argument, `{client:null}`), for a
repository that already builds its own normal game bundle. The immutable
shard data/asset product is the same format in both modes.

In this repository, `scripts/serve-build.sh --devserver` builds the game in
that mode and serves the resulting build. Without that flag it uses production
mode. There is no Vite development server. `__DEVSERVER__` is a build define,
with its declaration in `src/engine/build.d.ts`; URL parameters, storage and
requests cannot enable it in a production client.

`build-flags.json` records the mode, and each entry chunk carries its exact
runtime stamp. `node scripts/check-devserver.mjs <output>` refuses enabled,
missing or unsubstituted flags in a production artifact. The revision polling
endpoint and reload script exist only in the author server's disposable HTML.

`pnpm build`, the clean push gate and Vercel build every folder under
`src/shards` containing `shard.config.ts` through the workspace's author CLI.
These product-only builds populate `public/shardfiles/<folder>` before Vite
copies public files. Both the ordinary production build and the push gate run
the flag assertion against their compiled output. Unit fixtures deliberately
forge a true runtime flag under false metadata and must fail that assertion.

`wildshard validate <shard.json>` first admits assets and budgets, then runs
60 fixed ticks through `createShardfileSim`. It installs the authored terrain,
prop colliders, brains, script bindings, quests and encounters. Trusted item
handles share that one script lane. It rejects failed scripts and nonfinite
actor positions, then walks 92 overlapping capsule paths covering all four
15-metre edge entries for 50 metres inward. An actual wall, steep ground or
submerged route fails even if the edge metadata claims the route is clear.

The browser full loader borrows its existing physics, player, event bus, clock,
combat and fixed-step driver. Its callback runs systems once; the existing
client owns physics stepping. Existing water and prop ports can be borrowed.
Standalone snapshots reinstall adapters with `bindShardfileSim` and
`restoring:true`, reconnecting collider handles after world replacement without
allocating duplicates. Borrowed snapshots belong to the client world owner.

The build-only `@wildshard/commons/packs/bag.starterBagPack({credit, licence})`
emits the ten starter harvest rows as immutable JSON for the existing commons
catalogue/build hook. It owns their ids, labels, icons and travel flags. The game
expands the same pack into a gitignored literal table during every `pnpm gen`;
boot never imports commons code. Trusted runtimes normalize bag metadata through
`@wildshard/sdk/bag.normalizeItemRow`, whose default remains `travels: false`.

`@wildshard/sdk/runtime/effects.bindPlayerEffects` exposes the engine's existing
scope-owned status binding directly: movement lock/scale use independent channels,
periodic damage uses the supplied combat pipeline, and death/disposal cleanup ends
with the owner. It adds no HUD or visual policy; status-icon presentation stays
separate. Importing the module installs nothing.

## Trusted renderer-free headless runtimes

`HeadlessSimulation.create(source, assets, checkpoint, { trustedRuntime: { module: fileURL } })`
loads an explicitly selected local ESM entry inside the same isolated worker and deadlines as the
data-only simulation. This option is host policy, never inferred from `source.runtime` or untrusted
asset data. The entry exports `prepareHeadlessRuntime`, typed by
`@wildshard/sdk/headlessRuntime`. It receives validated source/assets and initialized Rapier and
returns a `SimLevel`, optional ground ports, and `install(host, context)`. The SDK owns the native
host. Install runs synchronously before snapshot restoration; register controller continuation
through `host.onStep` adapters and native reconnection through `physicsRestored`.

`context.commands()` reads the current admitted batch. `context.emit()` buffers facts/coins until
the tick commits; installation cannot emit gameplay effects. Rendering and browser globals do
not belong in this entry. Complete snapshots use the existing strict native codec and include
actors, motors, controllers and pending events. An optional `proveEntries(host)` performs real
entry validation: without it `finish()` refuses, while stepping and exact replay remain available.
The ordinary data-only path is unchanged.
