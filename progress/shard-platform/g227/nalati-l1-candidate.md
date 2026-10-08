# Nalati offline native L1 candidate

This is an offline product-pipeline candidate, **not a live LOD choice, fidelity verdict, independent Hausdorff bound or memory-retirement credit**. It consumes the shared `simplifyNativeLatticeTile` (`6038ae37e`) with an explicit target ratio **0.25** and maximum appearance-error estimate **0.25 m**. L0 GLB bytes and critical WSTR bytes remain unchanged. Surviving positions and painterly channels remain source values; the shared tool locks tile/hole borders. The actual error is carried into each emitted tile row instead of reporting zero error for simplified geometry.

| Ground only | Full-detail 16 L1 | Candidate 16 L1 |
| --- | ---: | ---: |
| Wire bytes | 6,819,744 | 5,057,252 |
| Decoded bytes | 6,819,296 | 5,056,804 |
| GPU bytes | 6,795,936 | 5,033,472 |
| Decoded + GPU | 13,615,232 | **10,090,276** |
| Candidate triangles | | 99,458 |
| Maximum tool appearance-error estimate | 0 | 0.24999759931874427 m |

The ground representation decreases **3,524,956 bytes** against the unsimplified tiled candidate. Largest-40 L0 plus all-16 L1 ground becomes **19,703,560 bytes**, before textures, far and cache. This still exceeds the native ground CPU+GPU array estimate **12,558,384 bytes**. It does not establish any net native-world saving or the G227 100 MB target. Per-tile bytes, hashes, errors and source provenance are in [nalati-l1-candidate.json](nalati-l1-candidate.json). Full native detail remains the existing witness path; the new asynchronous candidate entry points require an explicit policy and are not selected by any live caller.

Reproduce with the environment/cleanup sequence in [the planning estimate](nalati-residency-estimate.md), replacing `bakeNalatiGround(source)` with `await bakeNalatiGroundLod(source, {targetRatio: 0.25, maxErrorMetres: 0.25})`. `bakeNalatiWorldRowsLod` emits ordinary combined rows with the unchanged critical native authority and the same named texture-dependency path. Static props in this slice are not simplified or expanded. Rendering-owner fidelity review, combined static packing, complete dependency/entry residency, actual retirement and admitted-product proof remain open. Plan-State: unchanged.
