# Pastel Plain (`pastel-plain`)

SF59's first G169 fixture shard (SHARD-PLATFORM, E435): the real-GPU proof of the material-graph and post-stack path.
Developer only, placed on the grid's north-west plot (−1, +1). A copy of [`_template`](../_template/README.md) per
[SHARDS.md](../../../docs/SHARDS.md): the same playable level (the hut and its door, the blob, the elite and the boss,
the whip, the lantern, the jump course and the 500 m cell fill), with every `template.*` id renamed to `pastel.*`.

The look (`data/look.ts`) is the pastel alien plain admitted by `test/shardfile-g169-looks.test.ts`:

- **`ground`**: the terrain's material, an engine-owned painterly preset reference in lilac
  (`{ family: 'graph', preset, version: 1 }`).
- **`rock`**: every prop's material, an authored lit material graph (`data/rock.graph.json`: a pink-to-peach height
  gradient, a half-Lambert pastel ramp with a cool shadow tint, a mint rim, a sky / ground ambient and a lift grade).
- **`look.post`**: one authored pass, the lilac wash with a soft vignette.

All three draw only while Settings ▸ Debug ▸ Look ▸ "Graph materials" is on; with the row off the ground draws its
painterly family and the rock its plain fallback, and the post stack is not built.

The template binds terrain and props to one `pbr` material, so this shard keeps its own copy of the generators:
`generators/terrain.ts` bakes the terrain bound to `ground`, `generators/props.ts` (the template's props bake source)
binds the props section to `rock`, and `generators/bake.ts` returns both. Rebake with
`node src/shards/pastel-plain/generators/pastel-plain.mjs` (deterministic; writes `data/terrain.json`, `data/props.json` and `assets/`), then
rebake the map from a served build (`node scripts/bake-maps.mjs --url=<served> --shards=pastel-plain`).

The `shard.config.ts` project entry imports its author-only declaration in
`generators/product.ts`; follow that import to edit identity and rows.
`generators/build-product.mjs` shares SDK admission/emission with normal
builds. `assets/map.webp` and `data/productMap.json` freeze the authored
map and official stamp; refresh together after an official map bake. The
live stale-map gate remains unchanged. Whole-product comparison pins are
report-only and never grant cache activation or output removal.
