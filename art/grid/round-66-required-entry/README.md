# Required data entry · G721 regression investigation

The reported board collision regression reproduces on exact app
`0dd7ce4722d2dedda19b0201d6679cb442382108`, build `0dd7ce4-mvnc36gy`.
It is a required-tile scheduling bug, not the G721 terrain classification.

## Defining failure

Blender's planned road mouth is (-562.5, -281.25). Waypoint `1/2` is the
zero-based second, final in-cell point (-562.5, -352.5): the mouth was already
passed. Actual feet stop at (-562.46656, 0.45012, -306.51494).

The actual KCC collision is a native platform transfer cuboid, centre
(-562.5, 0, -307.16501), half-extents (15.08853, 8, 0.25), normal +Z. It is
registered `edge`, so both the pre-G721 ground-tag filter and the G721 terrain
filter include it. A real Rapier regression reproduces this contact and proves
the feet reach the unchanged 6 m crossing trigger. Do not remove this fence.

The real crossing already targets Blender and is `preparing`, without an issue.
Its required coarse/fine promises remain unsettled. All **eight** in-flight
slots belong instead to Sunscar L1 tiles: 3/0, 2/0, 3/1, 2/1, 1/0, 1/1, 3/2,
0/0. Blender has only six published L1s and no L0. No missing required Blender
tile can start while those background slots remain occupied. The native fence
correctly holds it outside the not-yet-ready region. [Failure capture](blocked.jpg).

The same saved cohort reports Ember Forge and Night Market stopped at their
corresponding transfer lines. Additional browser diagnostics distinguish this
from a parser/shader stall: all observed GLB parses and warmSceneRoots calls
complete, and no ring scope is repeatedly retired. These are diagnosis runs,
not timing or memory comparisons.

## Fix and actual entry proofs

`1138f0564cf53b57f293cc02eddaac9adc888361` prioritizes pinned tiles and their
parents. When required admission needs a full slot, it cancels only unfinished,
unpinned background fetches (not completed results or required parents).
Original leases still reject/discard late completions. The maximum eight slots,
resident budget, source checkpoints and readiness/publication fences remain.
This closes starvation exposed by required entry; it does not assume every
background producer can finish promptly.

Pinned `--devserver` preview build exits 0, build `1138f05-mvndi2ta`.
Three fresh muted iPhone 16 Pro phone-tier browsers, CPU 4×, run the original
`gridFloorPlans(..., 'cell', {roadApproach:true})` and declared entry route.
The sole seed is the original road approach. Travel uses real held input and
normal admission. The diagnostic ceiling is 60 s; no scene/physics overrides.

| Cell | Full road drive | Current / inside | Entry coverage | Errors |
|---|---:|---|---|---:|
| [Blender Template](blender-template.jpg) | 24.950 s | blender-template-1 / same | 12 L1, 13 L0 | 0 |
| [Ember Forge](open-plot-ember-forge.jpg) | 26.589 s | open-plot-4-1 / same | 16 L1, 15 L0 | 0 |
| [Night Market](open-plot-night-market.jpg) | 26.237 s | open-plot-nw / same | 16 L1, 15 L0 | 0 |

All three finish gameplay-ready, crossing settled, context intact. Times include
the complete 281 m road approach and final entry, not just the admission wait.
[Scalar route outcomes](summary.json). Browser HUD numbers are not accepted RAM
or frame-floor measurements. The broader related check overlaps these diagnostic
entries; no timing comparison is claimed. JPEGs only resize and add burned labels.

Regression: a stalled neighbour monopolizes a single-slot kernel before; after,
required entry completes within that same one-slot cap, required parents survive,
late cancellation results discard and all claims release. 18 focused cases,
1,705 ready related cases / 321 suites, touched engine/game layer types and
scoped typed lint pass. Fourteen missing-product suites are explicitly skipped
locally and remain in CI. CF1 independently passes 132 cases / 22 suites.
Browsers close after each case; the shared preview passes to sp-x8's own borrower
for its remaining two cells and official milestone. No additional floor here.
