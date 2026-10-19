# Conch V10 shell preflight and repair

2026-10-19. Static model study only. No independent likeness result yet.

The initial frozen V10 cage passed a topological edge-count check but failed a stronger geometric check. Bidirectional segment/triangle tests found 88 proper nonadjacent shell crossings. The early one-direction test had found only 53. This demonstrates why a closed mesh alone is insufficient.

The repair preserves the new substantial whorl architecture while moving the recessed throat toward the shell's actual offset axis, and raising the low mouth edge above the basal seat. It does not return to V9's narrow cone or add a Boolean, separate lip plate or internal ribbon.

Both source-geometry and actual exported-GLB crossing checks report zero proper nonadjacent crossings for the repaired unified shell. These tests exclude shared-vertex pairs and coplanar contact and are not an exhaustive collision guarantee. The actual GLB shell has 466 triangles, zero coordinate-welded boundary edges, zero nonmanifold edges and zero degenerate triangles. The complete study has 1,818 triangles across 39 meshes. Eye/nostril overlay boundaries remain as recorded in the full topology audit.

## Exact provenance

- Rejected preflight source: `art/driftwood-isle/approved-conch/build_conch_lowpoly_v10.py`, SHA-256 `0032b3ca2837ae1e21029606baa6e27623393d5723d28f546bbe58534298f068`.
- Repaired capture source: `art/driftwood-isle/approved-conch/build_conch_lowpoly_v10_repair.py`, SHA-256 `dc4323505e4c18652505ecca9362a097b5f348e55a1f03d348bf89717bd7d358`.
- An intermediate source named V11 was a naming-only duplicate of this V10 construction repair, exported without rendering before the naming clarification arrived. It is retained for provenance, not counted as a separate visual iteration. Both no-render export sessions ended at terminal 0.
- Actual repaired hero render ended at terminal 0. Nine-view capture remains in progress at this note's freeze. No actual rendered evidence was produced from the rejected V10 source.
- Crossing test implementation: `art/driftwood-isle/approved-conch/audit_conch_crossings.py`.

All prior source revisions are retained. Actual GLB/renders remain in ignored task output pending storage admission. No runtime integration, animation, performance, fun or visual acceptance is claimed.
