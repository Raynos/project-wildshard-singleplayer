# Retired shared compressed-upload paints

E435 / E451: `buildPacing = shared-paints` is removed together with its
implementation. Ordinary `on`, `off` and `uploads` remain. Saved retired
values fall back to `on`. The default two-paint compressed-upload queue,
GL error round trips, cancellation and first-real-draw mip fences remain.
There is no quality, resolution, sampler or texture-format change.

Same-pin Pine road arrival at 30 m/s on `3ab73b7e2`:

| Surface | Setting | Edge wait | Drive p95 | Maximum | Frames > 50 ms |
| --- | --- | ---: | ---: | ---: | ---: |
| Desktop | on | 0 ms | 16.8 ms | 133.3 ms | — |
| Desktop | shared-paints | 0 ms | 16.8 ms | 133.3 ms | — |
| Simulator | on | 4967 ms | 44 ms | 210 ms | 28 |
| Simulator | shared-paints | 6351 ms | 53 ms | 196 ms | 51 |

No measured shipping benefit justifies keeping the option. The lower
Simulator maximum in the second arm does not offset its worse wait and
p95. These are single matched runs, not a statistical speedup claim.

Simulator caveats: Auto's capability probe rejected the available KTX2
targets and selected Images in both arms. The runs therefore do not
establish compressed-path efficacy. Both console logs also contain the
same `graph:material` GLSL3 `varying wsCoarseXZ` compiler failure. The
harness game-error list was empty, but that is **not** a clean-render or
GL pass. sp-x1 owns the graph/probe follow-up. No context loss was reported;
no frame became visible before readiness.

The Simulator pair ran 23:34:35–23:38:05 UTC, after the clean hero capture
in the same isolated window. Load at start: 10.95 / 8.10 / 8.41. Settings:
Developer on, 2×, phone tier, graphMaterials on, memorySaver off, live clock.
All owned capture browsers, Inspector workers and Simulator resources
closed before explicit release. The earlier rejected Simulator attempts
(missing fixture) remain marked unavailable in [summary.json](summary.json).

Desktop ran 22:35:31–22:38:14 UTC, load 7.09 / 8.60 / 9.95. sp-x1 later
attributed and fixed its shared 133.3 ms play spike to a hidden minimap
base repaint; the unprofiled check reached 83.4 ms. That later source is
not part of this same-pin comparison. Pine's arrival wait, short travel
and the 210 ms afterPlay frame remain separate failures.

The discarded scheduling fixture saved boundary paints, but that was
never arrival or frame-floor credit. A physical-device default-flip row
is unnecessary because the experiment is retired.

Retirement checks: 138 focused tests across 16 files, root strict and
touched typed lint pass. One official Node recapture regenerated all six
physics bakes and Driftwood/Pine spots on the source candidate. Every
canonical payload was byte-identical, excluding only inputs, revision and
build fences. Their exact payload hashes are in the scalar summary.
