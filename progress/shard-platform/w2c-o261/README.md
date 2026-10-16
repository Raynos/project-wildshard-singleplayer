# W2c, Driftwood half: look graphs built at build time

2026-10-16, sp-o261. Rows: W2c (Driftwood `groundLook`, `coverLook`), plus every
other Driftwood look-graph builder that play code reached.

## What moved

All 14 Driftwood graph builders (46 `look.materials` graphs) moved out of `data/`
and into `generators/*Graphs.ts`. The `driftwood-look-materials` job
(`generators/lookMaterials.ts`) emits them as
`data/lookMaterials.generated.json`. The file is gitignored and `pnpm gen`
rebuilds it. `shard.config.ts` reads that JSON into `look.materials`. `data/`
keeps only the ids and rows that play code reads.

| Commit | What | Driftwood custom lines | Port % |
|---|---|---:|---:|
| `f47bec606` (parent) | | 13,893 | 80.93 |
| `c5d842aa9` | ground, cover, baked cove | 13,760 (−133) | 80.15 |
| `683e3b27b` | the other 11 builders | 13,201 (−559) | 76.90 |

The numbers come from `scripts/shard-platform.mjs --json` in the build mirror
(slot check3), each commit measured against its exact parent.

## Same look, same cost

Parity run: `scripts/proof-driftwood-look-parity.mjs`, iPhone 16 Pro DPR2,
phone and desktop tiers, 6 poses each. The before build is `f47bec606`. The
after build is `4e58c2159`, an unreferenced commit made of `f47bec606` plus the
W2c paths only.

- Unchanged: draws and triangles at every pose, programs (phone 186, desktop
  198), GPU bytes (phone 188,135,393), colliders and pixels.
- `look.materials` deep-equals the old TypeScript output, with −0 and
  undefined keys checked.
- One difference is in shader text. `tan(36°)` in the smoke and firefly
  graphs is computed by Node at build time instead of by the browser at
  runtime. It differs in the last double digit (…609 vs …608), which is the
  same float32.

Pairs (labelled, phone tier): `before-after-beach-sea.jpg`,
`before-after-lookout.jpg`.

## Where P2a plugs in

`shard.config.ts` imports `data/lookMaterials.generated.json` only until the
loader passes the product. After that, play code reads
`ctx.product.section('look/look').look.materials` in place of `source`. These
are the call sites:

- `runtime/hybrid.ts`: `runtimeLookMaterials(…, source, …)`
- `look/terrainPainter.ts`: `prepareFacetedGround(context, source, …)`
- `look/backdrop.ts`: the sky graphs
- `runtime/index.ts`: the arms graphs

Once those read the section, the JSON import in `shard.config.ts` can be deleted.
