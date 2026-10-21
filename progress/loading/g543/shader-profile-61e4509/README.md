# O5 scoped child snapshot measurements

Baseline: `f8f5ee9a9dd3dd49020c18b6c3bb7715eaa629aa`.
Candidate: `61e45099ae3afba4bd35261ebb0a9be92bc36128`.
Both use muted iPhone 16 Pro Chromium at CPU 4x on cold entries.

| Path | Node builds | Logged build CPU before / after | Sampled build-subtree CPU before / after | Whole entry before / after |
|---|---|---|---|---|
| SHARD SELECT | 67 / 67 | 6171.2 / 5481.2 ms | 5916.9 / 5290.2 ms | 22.8 / 19.5 s |
| Grid | 74 / 74 | 2724.6 / 2725.3 ms | 2665.2 / 2671.8 ms | 20.7 / 20.4 s |

The material/object name multisets and build counts match exactly. Grid
build CPU is effectively unchanged; SHARD SELECT is lower in this run.
These are sequential shared-machine measurements, not an isolated A/B.
The changed-source range also includes quest entry refactoring and a
separate retirement slice. Whole-entry changes cannot be assigned solely
to child snapshots. The original first-frame pause is retained separately.

Each mapped table lists exclusive self samples inside the complete node
build subtree. Source-derived method boundaries cover both the old build
and the candidate wrapper/buildProgram split. Nested inclusive durations
are never added. The retained baseline maps were captured before its
owned preview was retired; the later candidate maps use its actual dist.

The baseline samples identify stock getChildren/_getChildren allocation
as 558.2 / 291.0 ms. The candidate removes those default property/index
descriptors and self-ignore Sets while keeping eager ordering and custom
collector fallback. Generated shader sources, uniform declarations and
keys retain the focused parity checks in ../node-traversal-61e4509/.
The remaining graph build cost is visible in these tables.

The full candidate matrix in ../performance-61e4509/ passes all six cold
entries and all three real road returns, including native first frame and
enabled desktop AO. Every stage sum, actual-wire byte comparison and real
detail-update cadence check passes. CPU-4x phone grid is 20.4 s, alongside
the coordinator-accepted approximate 20 s O6 target at 20.7 s.
