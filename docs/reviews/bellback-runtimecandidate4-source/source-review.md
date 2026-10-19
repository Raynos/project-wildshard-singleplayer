# Bellback runtime candidate4: source-only admission

2026-10-19. This is a separate runtime candidate, not a new art version. Frame2
geometry, eight native bones, 13,374 vertices, anatomy3 clips, living dimensions,
AI, combat data and attack timings remain unchanged. The only metadata delta is
optional `dims.rigidCorpse`, exactly the frozen study's eight bone-local convex
parts, 435 points. No large box, root lift, axis switch or geometry adjustment.

## Canonical proof

`verify-canonical.py` inflates the canonical 38,768-byte payload into its 695,448
native geometry bytes, reads offsets and typed attributes, and verifies all
13,374 positions against the preserved native JSON. All skin weights are exactly
one unit to the corresponding bone. It verifies every original vertex lies inside
its proposed convex part and every hull point is an exact original vertex. Every
vertex of the canonical convex hull is retained, establishing equal convex hulls
and hence equal support in every direction at the same rigid pose. Maximum
halfspace residual is 8.88e-16; measured facet support gap is zero.

This does not prove clock publication, interpolation, dynamic contact, final
settle, slope behavior, impulse stability or physical-phone performance. The
anatomy3 full-combat failure remains preserved: rolled carrier/body penetration
reached -0.856456 m. Its earlier scoped pass is not erased.

## Isolation and checks

The new Following generator imports the original Tucked clips directly. Its
output is byte-equivalent to the prior generator for identical metadata, including
the unchanged combat catalogue and WIP species label. Candidate identity lives in
preview provenance and the separate preview title. Build and app entry reuse the
strict SDK shardfile/receipt route and the isolated practice host. They neither
import the world generator nor enable any public product.

Focused canonical Python verification passed. Six Node tests pass, including
rehashing a tampered recipe, living dimension, axis, rig or foreign metadata and
still refusing admission. Three Vitest tests pass real packed native loading,
independent nested recipe copies, living-dimension identity, isolated-source
parity and exact emitter parity. Admission enforces exact canonical pins and an
exact required source set, not only an attacker-editable receipt.

Engine independently reviewed by root at source commit
55625ac80684edfc88e282702c967a3c17210c3d; candidate-specific actual build and combat
remain pending. Root authorized an isolated build/capture only after this source
freeze. No acceptance flags are true. Root owns production/public decisions.

## Reproduction

- OPENBLAS_NUM_THREADS=1 python3 docs/reviews/bellback-runtimecandidate4-source/verify-canonical.py
- node --test scripts/bellback-following-admission.test.mjs
- WS_VITEST_MAX_WORKERS=1 node_modules/.bin/vitest run test/bellback-following-preview.test.ts
- New build only under scripts/heavy-lane.py; no build or browser evidence is implied by these source checks.

The manifest pins complete editable sources and exact byte lengths. Existing
sources and failures were not modified. No Git operations, remote publication,
Mac use, services, installs, archives or chunked backup files were performed for
this source preparation. Later authorized isolated capture evidence is separate.
