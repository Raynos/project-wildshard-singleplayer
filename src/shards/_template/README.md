# Template shard (`_template`)

Run `pnpm gen` in the repository before copying this folder to start a
shardfile project; see [SHARDS.md](../../../docs/SHARDS.md)
and [SHARDFILE.md](../../../docs/SHARDFILE.md). Install `@wildshard/sdk`, edit the
identity via the documented `shard.config.ts` entry (follow its import to
`generators/product.ts`), then run `wildshard build <folder>` and
`wildshard validate out/_template`. The prepared copy includes its immutable assets. Cheap CPU outputs are
regenerated from retained authoring sources through SHA256-pinned cache jobs;
curated skins remain author inputs. The map is generated from the declared terrain
and props by `generators/bake-map.mjs`, using the style in `data/map.json`.

`data/` declares terrain, props, exported creature skins, brains, encounters, items,
water, look, HUD, audio, ledger and interactions. `behaviour/` holds admitted numeric
AssemblyScript for the door and item hooks; `data/quests.ts` declares the adventure. Stable
state-field IDs and item handles preserve the script ABI across declaration reorder.
`generators/` and `data/layout.ts` are build-time source metadata, never client runtime. `generators/cell.ts` fills the
500 m cell (G220): a road from each entry socket to a square loop around the yard, a set piece just inside each entry
(north gate, south container yard, east signal mast, west covered drive), four hub corners outside the loop and lamp
posts, all dev-map boxes on ground the terrain levels to y = 0. `generators/districts.ts` (pass 2) fills the plane between
the roads: a hover test course, a block district, a ziggurat and an overpass in the corners, a scaffold yard, billboard
row, hangars and crate yard in the side strips, a second set piece at each entry, and four 40 m copy plots that a grid
copy fills with its own seeded landmarks (`src/game/grid/copyLayout.ts`).

The first-party manifest keeps the canonical `_template` slug, grey picker art and
`template-solo` save identity, and points at `/shardfiles/_template/shard.json`.
The existing Game admits the product before its normal world/kit/play stages, sharing
one player, physics world, fixed-step driver and HUD. There is no custom runtime chunk.
`shard.config.ts` includes build-time `data/card.ts` metadata;
`generators/output.ts` declares named blobs and platform sections. Budgets live in `data/` too. Root
`manifest.json` is a temporary discovery bridge only: P3 catalog activation
removes it, together with the generated discovery module. Runtime code never
imports `data/card.ts`. Keep bridge metadata synchronized until that switch.

The T2 reference in `behaviour/boss.as` binds the `combat/encounters` row
`template.boss` through the single `sim/scripts` row in `generators/output.ts`.
`data/bossDecision.ts` declares its capabilities, actor, move, strike, timers and
durable state. The SDK compiler generates the typed bindings; no handwritten
transport or runtime module is needed. It approaches, alternates timed strikes and moves,
accelerates at the second-phase threshold, wins on death and resets on stop.
The fixed-step engine owns the declared `actors/moves` and strike mechanics.
`template-boss-decision` compiles one fixed Wasm page; the scenario at
`test/scripts/_template-boss.test.ts` runs those built bytes through the real
DecisionHost, including a logical save restored into a fresh host. The
Template stays runtime-free. Event-only decisions run on the 60 Hz host's sixth
tick, at most 10 Hz; timers use simulation time. The scenario also checks that
every call respects that cadence, including calls after a save is restored.
The scenario does not compile AS or invent a second motion implementation.
From the repository root, run
`pnpm exec vitest run test/scripts/_template-boss.test.ts`; its setup prepares
only the Template product. For another shard, copy the scenario and replace
the product folder, script id, player fixture and expected commands with that
shard's declarations. `scenario()` reads the built `out/<folder>/` product;
it never imports authoring modules or recompiles the script inside the scenario.

A copied author project does not need a custom runtime. If one is necessary,
use `runtime/index.ts`, `runtime/sections.ts` for custom-section schemas and
`runtime/const.ts` for local constants; every runtime import stays inside that
folder or names a public platform module. Read content through the admitted
product. Build-time code never imports `runtime/`.

Four native proofs under `test/proof/_template/` cover boot, 10,000 fixed ticks,
checkpoint replay and ledger dedupe. Weapon input/replay and HUD regressions use the
declared item runtime. The installed-client proof covers real door/lantern input,
tile driving, cached/offline revisit and scoped unload.

The complete author-only producer is `generators/build-product.mjs`. It
uses the same declaration, admission and immutable writer as the normal
SDK build. `assets/map.webp` and `data/productMap.json` are generated together
with the public raster by the `template-data-map` job during `pnpm gen`.
The live stale-map gate checks the generated stamp against its data inputs.
The generation catalogue pins every complete product byte for restoration.
Output removal still requires a fresh complete-product clean room, preserving
every admission refusal and the official stale-map gate.
