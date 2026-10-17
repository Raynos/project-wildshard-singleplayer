# Official map refresh, 17 October 2026

Nine maps are officially rebaked, with matching world-input hashes, decoded
pixel hashes and existing authored-product companions. Nine Dragon stays with
its geometry/glyph lanes; this commit does not edit its map.

The final source carrier is `ac722f90c449d9d9383a9e339324382478c1f3ab`.
Earlier captures whose world-input hashes still match that carrier are retained.
The final capture includes the schema-forward fix and OR's river palette repair
`8690559a6`. No map stamp is edited by hand.

## Pixel comparison

Decode the old map from a16850298 and the official replacement to RGBA8 at
1000 x 1000. Mean channel delta is absolute RGB difference on the 0–255 scale;
changed pixels include alpha. Full measurements are in [pixel-deltas.json](pixel-deltas.json).

| Product | RGB mean delta / 255 | Changed pixels | Capture revision |
| --- | ---: | ---: | --- |
| _template | 0.020181 | 0.9912% | a16850298 |
| blender-template | 0.000000 | 0.0000% | a16850298 |
| driftwood-isle | 0.000000 | 0.0000% | b310b7199 |
| far-reach | 0.000000 | 0.0000% | a16850298 |
| ink-cel-valley | 0.000000 | 0.0000% | a16850298 |
| nalati-grasslands | 1.578352 | 63.6773% | ac722f90c |
| pastel-plain | 0.000000 | 0.0000% | a16850298 |
| pine-hollow | 1.956446 | 75.2333% | 83f547a26 |
| sunscar-dunes | 0.000000 | 0.0000% | 83f547a26 |

Six rasters are pixel-identical. All alpha channels are identical. Template's
small localized difference, Pine's ground/foliage shifts and Nalati's changed
colours are shown on the [labelled phone board](maps-board.jpg) (900 x 1950).

Same-build repeats of the original Template, Nalati and Pine captures were
pixel-identical. The first Nalati bake exposed the pale river after the earlier
WaterSurface graph conversion (4c967cd0f); its mean RGB delta was 2.636018.
The coordinator queued the colour-space row, and OR's map palette repair
8690559a6 restores the blue river classification. The final official capture
verifies it visually and lowers the delta to 1.578352. Remaining colour changes
are reported, not claimed as whole-image parity.

## Reproduction

Use `scripts/serve-build.sh --head` or its pinned `--rev` equivalent and
`scripts/browser-lane.sh node scripts/bake-maps.mjs --url=<preview> --shards=<slugs>`.
Blender Template uses `scripts/bake-map-glb.mjs` because its settings name an
authored world GLB. Capture passes stay in ignored task scratch, not Git.
The official browser bake is muted and closes its browser when finished.

Template, Pastel and Signal's complete-product producers are rerun after
publishing their map companions. The same commit refreshes only their output
lists and pins in scripts/generation-jobs.json, including every emitted
validation.json. This prevents stale packed-map paths from breaking clean gen.
Other lanes' catalogue jobs are preserved through a private index.

No runtime files or custom shard lines are added or deleted by this hygiene
change: per-shard net is zero. Existing performance budget warnings remain
report-only. The source-basis inventory is measured from the complete products.

## Final checks on ac722f90c plus these maps/pins

- Clean `node scripts/gen.mjs --proof`: pass.
- `node scripts/build-shardfiles.mjs --reuse`: all 10 products pass, with no
  stale-map (SF66) warning.
- Root and layer TypeScript projects: pass.
- Typed lint for map/product/headless contract tests: pass.
- `catalog-build`, `template-source-layout`, `shard-headless`: 3 files,
  22 cases pass, including all 17 headless cases.
- `sourceProgressInventory` from scripts/shard-platform.mjs: complete
  source-basis inventory, no custom-line delta from this map-only change.

The 83f547a26 and ac722f90c served previews remain alive for the source lane's
exact-parent parity receipts. The carrier pusher owns release after that fence;
there is no CI/deploy wait in this map task.
