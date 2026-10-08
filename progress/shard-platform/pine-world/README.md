# Pine world conversion — G227 / E435

State: in flight. This first slice witnesses existing source inputs; it does not switch a boot path or claim a baked product.

`node scripts/bake/pine-world-inventory.mjs` reproduces `inventory.json`. The committed native WSTR256 terrain is authoritative: 65,536 Float32 heights, four byte splat channels and the retained undergrowth placement log. Its exact byte hash is `73135bc55e9acc06475f7e13c6bd9a907ed9ba2c0524a24275617f877dfd562d`. All four 8 × 15 m footprints have 54 native corners at y = 0. Existing declared edge rows are millimetre-rounded; the report pins their exact native counterparts separately and records the rounding error.

The source is `layout.ts`, the real world/model/look builders, the Pine authored hero/tree/crag assets and committed baked inputs. The inventory is an input census, not a complete emitted placement/collider census or a residency estimate. Shared scan and texture dependencies referenced by those builders must also be resolved during extraction.

Next slices: shared SDK native-lattice triangle slicing without collision resampling; exact static placements/instances and material/texture dependencies; immutable L0/L1/far product and admission report; then the existing default-off hybrid world handoff. Cabin doors, sluice, zipline, animation and gameplay retain separate runtime ownership. Pine's splat PBR terrain and forest presentation require the Opus renderer seam. No content/material may be omitted to conceal an overage.

Per-category caps are report warnings (L0 4 MB / 40k triangles / 8 draws, L1 2 MB / 10k / 2, far 1.6 MB / 8k / 1); total playing 1 GB and loading 1.8 GB remain hard. Proof before switching: repeat bake byte identity, native samples/edges unchanged, actual collider/entry/ray checks, seeded two-tier visual/walk parity after upload readiness, allocator totals and unload census zero.

Validation: three focused inventory tests and scoped typed lint pass; root TypeScript passes. Negative witnesses change an interior entry corner, a boundary sample and placement bytes independently. No renderer, physics world, browser, build or boot was allocated for this slice.

Shared slicing slice: `src/sdk/bake/nativeLattice.ts` takes original positions, explicit triangle indices and up to 16 channels (up to 64 scalar components per vertex). It emits 64 L0 or 16 L1 meshes, retaining empty tiles and interpolating cuts with a canonical edge order for exact shared boundaries. It does not allocate or change collision. Four focused tests cover both real Pine/Nalati native bakes, all 65,536 source vertices, splat/UV/normal and surf/rdir/zone preservation, area conservation, holes, deterministic output and malformed input refusal. L1 currently retains the native geometry; this is not a simplification or an admitted full product.
