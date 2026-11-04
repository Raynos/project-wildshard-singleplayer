# Open plots

The grid's open plots are one data-only source shard with one product per
`outputs.json` row. Every current row declares a tiled layout. The platform
reads those rows through `scripts/shard-outputs.mjs`; `shard.config.ts`
exports their declarations and build programs.

`generators/plotBake.mjs` dispatches to the layout's tiled builder, or the
generic inactive placeholder. The retired hologram showroom is no longer
an accepted fallback for a missing layout. The same build program paints
its map from the generated world and emits the normal tiles, collision,
edges and far proxy.

Each tiled layout names its kit families, landmark near/far models and
poster image. Art lives under `public/assets/open-plots/<idea>/`. Poster
filenames identify author inputs; SHARD SELECT art stays in `thumbs/`.
Real landmarks, posters, card art and their live generation tools remain.

OP24 still tracks the emitted legacy look-material catalogue and its
hologram graph, plus the shared SDK's explicit `farMode: 'add'` contract.
Those are outside this unread-showroom/asset cleanup; no runtime look or
shared importer policy is changed by this slice.
