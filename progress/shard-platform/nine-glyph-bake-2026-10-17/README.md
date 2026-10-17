# Nine glyph atlas bake

SHARD-PLATFORM G465/G466/G467/G468/G469: one whole-module conversion.

The glyph rasterizer, Zhang–Suen thinning, signed distance transforms and
RG8 atlas packing run offline. `runtime/signs/glyphField.ts` is deleted.
`world/words.ts` is also deleted: generators author the words in
`data/words.ts`, and the world reads them from the admitted glyph metadata.
The neon renderer reads the named metadata and lossless deflate chunks
through the existing first-party product reader. It creates the original
RG8 DataTexture with the original mipmaps, filters, wrapping and anisotropy.
No engine or SDK host was added or extended.

## Source-basis result

The build mirror's `sourceProgressInventory` reports **14,139 → 13,963**
Nine custom lines, **−176 net**. Every other shard's total is unchanged.
Baseline: `6e12772ab`; candidate source tree:
`9691b456b481dff8fc9e07d50ff3e83f91523cae` (parent `bae731dcd`).
The intervening parent change fixes the shared fog compiler; both rendered
comparison builds use that fixed compiler.

| Charged source | Before | After | Net |
|---|---:|---:|---:|
| runtime/signs/glyphField.ts | 192 | 0 | −192 |
| world/words.ts | 8 | 0 | −8 |
| data/words.ts | 0 | 7 | +7 |
| data/signs.ts | 149 | 153 | +4 |
| runtime/signs/neonText.ts | 296 | 326 | +30 |
| plugin.ts | 149 | 140 | −9 |
| tier.ts | 12 | 8 | −4 |
| world/build.ts | 311 | 307 | −4 |

The retained generator algorithm is the original rasterizer and distance
transform, with its synchronous constructor's iteration moved into
`bakeGlyphField`. Generated code is excluded under G467; the table retains
the charged author-data and reader lines.

## Exact raster and metric proof

A private reference extracted from the original runtime module at
`6e12772ab` ran beside the retained generator in the same macOS WebKit,
emulating iPhone 16 Pro. Both tiers match **every original RG8 byte and
glyph rectangle, with zero tolerance**. The original hash fixture is
`test/fixtures/nine-glyphs.json`. The final producer was also rerun with
`--check` and the original reference; it reports exact pixels and metrics.

| Tier | Texture | Decoded bytes | RG8 SHA-256 |
|---|---|---:|---|
| phone | 1024 × 1024 | 2,097,152 | `57bb90eb15dafb8379e0c2dda0aeea013723b78814ec3f6960b13854cf20b01c` |
| desktop | 2048 × 2048 | 8,388,608 | `3ece61de47c4dc9a8be8fbbc0c1ebe04fed8bf0f0153087fd5c19771d9038dbc` |

All glyph rectangles hash to
`fb311be8e56814f8c75a9065911d108a4cf9629d91b1fdc5bbf3011e05138678`.
The original Kai system-font stack and weight 700 are retained. The bake
captures WebKit's system-font result; normal product builds use its saved
bytes and need no native font rasterizer.

## Storage and admission

The retained generated JSON is about 2 MB, below the 5 MB JSON cap. It
contains losslessly compressed pixels, glyph rectangles and layouts.
The output sidecar emits named binary chunks and named metadata JSON.
Each chunk expands to 2,097,152 bytes; decoded and mipmapped GPU costs are
explicitly admitted. The page uses native `DecompressionStream('deflate')`.

| Tier | Chunk wire bytes | Total wire bytes |
|---|---|---:|
| phone | 282,685 | 282,685 |
| desktop | 2,069; 171,124; 533,754; 538,491 | 1,245,438 |

Every blob is below 1 MB; no large-file pin is needed. The chunks reconstruct
one texture per world, preserving the RG8 format and texture allocation.
The native bake recipe is registered as `nine-glyphs` in
`scripts/generation-jobs.json`. Run it through `scripts/browser-lane.sh`.

## Verification

The immutable candidate tree built all ten official products. Root and
layer typechecks and changed-source typed lint passed. Five selected test
files passed **28 cases**, including all **17 shard-headless cases**, the
three glyph cases, cloth buffers, Jian geometry and world installation.
The glyph cases verify original pixel and metric hashes, texture settings,
blob costs, missing-glyph refusal and independent texture ownership.

The matched macOS WebKit render proof also passes at zero tolerance:
`bae731d-mvc2af4u` versus `d44f75d-mvc39nnp` (isolated candidate tree
`d44f75d58488743d47241687a5511fcc3441cc18`). Phone and desktop poses A,
B and C match every pixel, draw and triangle. Linked programs stay at 109
(phone) and 123 (desktop). GPU bytes stay at 278,220,779 and 519,934,959;
all 489 colliders retain the same hash. Observed CPU backing bytes do not
rise. The complete scalar receipts are `poses-before.json` and
`poses-after.json`. These are real world renders with the same frozen
clock, cameras, hidden movers and hidden held item on both sides.

The official `scripts/bake-maps.mjs` refresh ran against the isolated
candidate build and is included with its generated stamp. The stylized
1000 px map is 13,408 bytes. Its pixel hash is
`614633f0d2d2d2dd9bff13947974914e4cb64a80e41aeb964d3a4a9189740d8c`;
its source tiles hash is
`a9bb8de5478fa5e0d789bd77c36719d33adf10157619664d2b23007eb4146712`.
The image matches the preceding official map; the source stamp advances.

## Exact remainder

`runtime/signs/signAtlas.ts` remains unconverted: its mono/colour canvas
painting and packing, SignBuilder quad collection, boards and light
reporting still run at load time. Its existing Explorer/model and mover
consumers remain. This landing deletes the complete glyph-field module;
it does not claim the remaining atlas/board path is irreducible. Nine's
sign shader programs and authored ink look are unchanged by this slice.
