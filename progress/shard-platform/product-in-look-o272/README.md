# The product in looks and Model Explorer specimens (2026-10-16, sp-o272)

P2a (`../p2a-runtime-data-api/README.md`) gives a shard's plugin hooks `ctx.product`. Two kinds of runtime code run
outside any hook, so the W2 rewire lanes (sp-o270 Pine, sp-o271 Driftwood) found no product there and kept importing
`shard.config` (o266's README, "Blocked on a product route"):

- **Looks.** `ShardManifest.render` builds the shard's `LookStrategy` (sky backdrop, `prepareWorld`, terrain painter).
  The engine awaits it in `Game.buildSky` and calls the factories with its own `WorldLookContext` /
  `SkyBackdropContext` (renderer, sky, scope). Driftwood's `runtime/look/{backdrop,terrainPainter}.ts` and Pine's
  `look/render.ts` pass `shard.config`'s Shardfile to the look-material hosts (`graphDaySkyBackdrop`,
  `prepareFacetedGround` → `runtimeLookMaterials`).
- **Specimens.** `ShardManifest.roster` lists the Model Explorer's live models; `listShardModels` awaits each entry's
  `prepare` (the birds' and wildlife preloads) and builds specimens with the engine's `ModelContext`. A model that needs
  product data has no way to reach it.

## The change: the game binds the product into the loaders it hands the engine

The engine is untouched. `LevelSpec.look` stays `() => Promise<LookStrategy>` and `LevelSpec.roster` stays
`() => Promise<RosterEntry[]>`; the engine never sees a product, a shard or a section (E405).

1. **`ShardManifest`** (game): `render?: (product: ShardProduct) => Promise<LookStrategy>` and
   `roster?: (product: ShardProduct) => Promise<readonly RosterEntry[]>`. A loader that ignores the product (Nalati,
   Nine, Sky, Signal, the shardfile sources, every `-legacy` manifest) still type-checks unchanged.
2. **`toLevelSpec(manifest, product?)`** binds it: `look: () => manifest.render(product)`, same for `roster`. With no
   product it binds `absentShardProduct(slug)`, so a look that reads one fails loudly ("run `wildshard build`") instead
   of silently importing source.
3. **Every boot that builds a look passes the product it already loaded before the first hook:** the standalone session
   (`session.ts` loads it at stage `product`; it now rides `SessionContext.product` into `world.ts` and the roster
   call in `loadout.ts`), `pluginLoad.ts` (`app.loadLevel`) and the grid's regional world
   (`shardProductFromAdmission(request.admitted, scope)`, the same cached product its `ShardContext` gets).
4. **Discovery** (`scripts/authored-manifest.mjs`): generated `render` / called `roster` bindings forward the product
   through a `callWithProduct` helper emitted in the generated file (type-only import, so an older revision's build that
   meets the file in a mirror still loads), which accepts a zero-argument export too: shards opt in by adding the
   parameter.

Data only (G454): the product is read-only data the game passes down; no shard callback crosses into a host, and the
hosts' signatures (`graphDaySkyBackdrop({ source })`, `prepareFacetedGround(ctx, source, …)`) do not change. The look
module becomes a factory of the product instead of a module-level constant.

## Proof call sites (this lane)

- Driftwood `runtime/look/render.ts`: `shardRender(product)` builds the backdrop and ground from
  `product.shardfile`; `backdrop.ts` exports `stylizedBackdrop(product)`, `terrainPainter.ts` exports
  `prepareGround(product)`. Neither imports `shard.config` any more.
- Pine `look/render.ts`: `shardRender(product)` hands `product.shardfile` to `keyedSkyBackdrop`.

Not here: the audio boot bindings (sp-x1, P3 async boot); the other `data/` imports in these files (`cumulusPuffs.json`,
`look/dayKeys`, `data/groundFiles`, `data/skyLook`) wait on custom sections (P2b, the rewire lanes); converting
roster models to read the product is the rewire lanes' work on this API.
