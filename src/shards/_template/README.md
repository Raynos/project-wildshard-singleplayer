# Template shard (`_template`)

Copy this folder to start a shardfile project; see [SHARDS.md](../../../docs/SHARDS.md)
and [SHARDFILE.md](../../../docs/SHARDFILE.md). Install `@wildshard/sdk`, edit the
identity in `shard.config.ts`, then run `wildshard build <folder>` and
`wildshard validate <folder>`. Included immutable assets make the copy buildable.

`data/` declares terrain, props, exported creature skins, brains, encounters, items,
water, look, HUD, audio, ledger and interactions. `behaviour/` holds admitted numeric
AssemblyScript for the door and item hooks; `quests/` declares the adventure. Stable
state-field IDs and item handles preserve the script ABI across declaration reorder.
`generators/` and `layout.ts` are build-time source metadata, never client runtime. `generators/cell.ts` fills the
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
A copied author project does not need the platform picker manifest or budget metadata.

Four native proofs under `test/proof/_template/` cover boot, 10,000 fixed ticks,
checkpoint replay and ledger dedupe. Weapon input/replay and HUD regressions use the
declared item runtime. The installed-client proof covers real door/lantern input,
tile driving, cached/offline revisit and scoped unload.
