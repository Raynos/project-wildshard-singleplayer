# Nine Dragon geometry kit audit

The tangent shell is entirely offline. Its runtime writer and facade
wrapper are removed; `restoreLayout` now hands the existing layout GLB's
shell geometry directly to `buildFacade`. No attributes are repacked and
no new shared host is introduced.

## Call-by-call classification

| Kit / caller | Inputs and timing | Verdict |
| --- | --- | --- |
| Tangent: `generators/facadeGrammar.ts` (`quad`, `quad4`, `boxAxes`) | Tower, wall and street grammar; committed dimensions, palette and seeded RNG; runs in `nineLayoutSource` | Static; existing layout bake owns the complete shell |
| Tangent: `generators/facadePieces.ts` (`append`) | Fixed facade pieces, recorded placement matrices and tints; merged offline | Static; already included in the same shell |
| Tangent: `world/facade/dressing.ts`, `world/layoutBake.ts`, `world/facade/batch.ts` | Previously empty construction, `fromBake`, counts, `build`, `release`; no primitive authoring calls | Direct baked `BufferGeometry` ownership replaces the entire runtime writer |
| Ruled: `world/entries.ts` (`box`, `cyl`, `hipRoof`) | Fixed four deck frames; `opts.caps` selects standalone or grid at load | Two static variants, still convertible; no player or simulation state enters geometry |
| Ruled: `look/signs.ts` (`boxAxes`), called by `world/build.ts` | Baked sign slots, glyph words, seeded `Rng(4242)`, style-derived board dimensions | Fixed boot assembly for each selected word/style inventory, still convertible; must preserve board placement and word/RNG ordering |
| Ruled: `world/layoutBake.ts` (`fromBake`) | Existing layout geometry plus the additions above | Baked base; builder remains only because the deck/sign additions still call it |
| Swept: `world/layoutBake.ts` (`fromBake`) and `world/hero/kitx.ts` (`merge`) | Existing layout geometry and the fixed per-kit merge order | Static; baked adoption/merging needs no sweep or ellipsoid construction |
| Swept: `runtime/kit/propGlb.ts` (`mesh`) via `models/crowd.ts`, `models/lion.ts`, `world/jian.ts` | Four fixed walker/sitter ramp combinations, one fixed lion ramp, one fixed guard fit computed from the guard GLB bounds | Static source assets and options; still convertible to prepared buffers. Preserve normal accumulation, AO/ramp arithmetic and signed zero; retain guard fallback behavior |
| Swept: `sweep`, `ellipsoid`, `card`, `curve` | No remaining runtime caller constructs these primitives | Only the generator copies author these shapes |
| `runtime/tools/hookCourse.ts` (`build`) | Authored course row, with origin translated to the host spawn | Geometry is static relative to its room origin; baking only it cannot delete the whole mixed module |
| `runtime/tools/hookCourse.ts` (`update`, `padUnder`, `place`, `restart`) | Current player feet, grounded/hover state, clock, reached pads, last checkpoint and best time | Live gameplay; remains shard-owned with its existing host |

The retained ruled and swept writers are not classified as irreducible
live geometry. Their remaining consumers need a further complete data
conversion before those whole files can disappear. This landing removes
the largest already-complete static path without moving any authoring
code into another runtime file.

## Byte proof

`test/nine-facade-shell.test.ts` runs the real offline layout writer,
restores its layout through the runtime path, and compares every packed
attribute's bytes, constructor, item size and normalization, the index,
and both bounds. Facade placement and merged-piece inventories survive
the same restore. The page transfers ownership of that geometry to its
mesh and clears the temporary reference, as the former kit's `release`
did, without disposing the drawn geometry.

Phone check: production composite `72d8ab71c` (including the neon graph landing), iPhone 16 Pro portrait
(402 × 874 CSS pixels), muted, Developer on. The scene loaded without
browser errors and visibly retained the facade fabric, signs and street.
The rendered `facade-shell` had 115,636 vertices and 57,818 triangles,
with position, normal, colour, face, pattern, misc and tangent attributes.
The browser was closed after capture and inspection.

## Source-basis measurement and checks

Measured in the shared `check` build mirror at final candidate
`204f9bd95`, preserving the separately landed glyph, neon graph and
shared specimen catalogue work:

| This batch | Custom lines before | After | Net |
| --- | ---: | ---: | ---: |
| `runtime/kit/tangentKit.ts` | 251 | 0 | -251 |
| `world/facade/geo.ts` | 12 | 0 | -12 |
| `world/facade/dressing.ts` | 18 | 17 | -1 |
| `world/facade/batch.ts` | 107 | 108 | +1 |
| `world/layoutBake.ts` | 190 | 189 | -1 |
| **Nine Dragon** | **13,694** | **13,430** | **-264** |

Other shards: zero custom-line change from this batch. Generator comments
are authoring-only and do not enter the source custom numerator. The
measurement uses `sourceProgressInventory` and `codeLines` from
`scripts/shard-platform.mjs`; the CLI report was also collected against
all ten built products. This is a source-basis inventory, not a claim of
closed shardfile runtime output.

Root types, layer types and typed lint passed in that immutable mirror.
All ten first-party products built. All 17 shard-headless cases and the
three focused shell/install cases passed (20 cases total).

The final official map bake includes the separately landed neon graphs
(`43915465d`) and this tangent conversion, from immutable `72d8ab71c` after
full proof generation. Its source stamp is
`252f259d9de4ebdc31f1d6ac966b221899c0916371077f3e64ce8e0d9824d4a1`,
and its 13,438-byte WebP has RGBA hash
`f7085ba94438fec4fb9e1090d48a19862cca1c21bb7a187bffc281bc7d3b5bfb`.
The neon landing changed the mapped world inputs, so its official map
supersedes the earlier glyph/tangent bake. The final map browser, portrait
browser and all three task-owned previews were closed afterward.
