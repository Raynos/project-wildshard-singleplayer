# Open plots

The grid's open plots are one data-only source shard with one product per
`outputs.json` row. Every current row declares a tiled layout. The platform
reads those rows through `scripts/shard-outputs.mjs`; `shard.config.ts`
exports their declarations and build programs.

`generators/plotBake.mjs` dispatches to the layout's tiled builder. A missing
layout or a retired placeholder flag refuses before reading art. The same build program paints
its map from the generated world and emits the normal tiles, collision,
edges and far proxy.

Each tiled layout names its kit families, landmark near/far models and
poster image. Art lives under `public/assets/open-plots/<idea>/`. Poster
filenames identify author inputs; SHARD SELECT art stays in `thumbs/`.
Real landmarks, posters, card art and their live generation tools remain.

The look retains the tiled materials and the live poster graph. The retired
showroom's hologram, floor, kerb, plinth, frame, rim and sign materials are
not emitted. Each plot still uses `farMode: 'replace'` for its stand-ins;
the SDK rejects the retired explicit `add` option. Other authored worlds
that omit a mode retain the normal static, undrawn and far-node proxy.
