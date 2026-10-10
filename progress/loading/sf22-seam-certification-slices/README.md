# SF22 / SF67: paint within native seam certification

2026-10-10. Platform loading already yields between complete strips, but a strip's
adaptive native floor certification is synchronous. The sliced path now yields
between the same subdivision and vertex-removal checks. The synchronous API drains
the same generator; result publication, order and local per-generation shape reuse
are unchanged. Partial meshes are never installed.

This changes scheduling only. No vertex, triangle, feature, colour, collider,
certification tolerance or native edge changes. The current four committed catalogue
hash fixtures (Developer / DEVSERVER variants) still match. A mixed 256/257 native
shore/cliff fixture captured before this change retains the exact complete mesh,
placement, feature and duplicate-origin SHA-256:
`fc30c110b70581434ba4691f96e02b2d0c0b4ad65f86968482312a6a87a31d89`
(13 pieces, 42,250 triangles).

A local Node diagnostic of that mixed fixture, with the existing 12 ms budget, took
1,492.4 ms total over 123 pauses; maximum measured work interval was 14.34 ms.
That is a work-unit diagnostic under current machine load, **not a browser loading
or phone timing verdict**. A cooperative slice can exceed its budget by one check.
The browser's remaining initial-boot tasks are still open pending exact CPU/source
attribution; this receipt does not assign its unmapped 678 ms task to a guessed owner.

Focused checks: 25 tests across strips, adaptive geometry, seam features and complete
catalogue hash fixtures; strict source/test projection and root-config typed lint of
all four touched TypeScript files green. No full suite, generated edits, geometry
rebake or input-only witness refresh. New generator bindings are documented in
source and ENGINE.md. No layer-edge increase.
