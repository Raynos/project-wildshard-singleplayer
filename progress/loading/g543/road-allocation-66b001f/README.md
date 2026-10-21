# Road clipping allocation probe

`66b001ff18` skips allocation only for triangles with no strict interior bin
cut. The kept test pins the original builder's complete positions, UVs,
indices, cull spheres, LOD runs and admission counts across 81 triangles with
positive/negative coordinates and exact/near bin edges. It passes for the
original and optimized implementations, with strict typed lint.

A separate Node/Vitest micro probe uses 60,000 grid triangles with UVs and
four alternating original/candidate pairs after warm-up. Every pair has the
same complete-output SHA-256. Original clipping takes 31.7–35.0 ms; candidate
clipping takes 5.8–21.0 ms. `micro.json` retains every sample and hash. The
probe is diagnostic, with no flaky time assertion and no whole-entry claim.
Temporary original-builder and benchmark test sources were removed after
measurement. The lasting regression is `test/road-clip-parity.test.ts`.

The following `f8f5ee9a9d` cut replaces repeated LOD string-key comparisons
with vertex representatives; it preserves the same pinned byte plan. One
combined exact-SHA source and served-build proof follows both cuts.
