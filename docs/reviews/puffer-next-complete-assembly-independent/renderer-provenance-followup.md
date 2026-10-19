# Renderer provenance follow-up

2026-10-19 19:09 UTC. This follows the completed blind/comparator review and changes no scores or visual verdict.

**The original-versus-resumed renderer code-equivalence qualification is resolved.** The parent identified an immutable earlier checkpoint after the original review was written. I independently read the renderer from commit `0897feb6c37e76ce9a07fdb8b6efb704f4637162`, path `art/driftwood-isle/puffer-complete-remaster/next-complete-assembly/render_matched.py`, and separately read Git blob `28a26f72b1431b9c5e93802fffbd8415645524bc`. The bytes are identical and SHA-256 is `3dcff53dd20c68914a9bae176aa4a7125bea0252db11cc20bbda89c5f7a9c720`, exactly the first-renderer pin in the recovery receipt.

I inspected the complete diff against the submitted current renderer, SHA-256 `a456ff10b3eee42d1880fda1a5b16d7a3980eefdcaae42c4c7d14fdc4ea949bf`. Changes are restricted to:

1. Resolving the output directory to an absolute path before directory and receipt operations.
2. Reading recovery metadata and verifying the preserved raw image's SHA-256.
3. Resuming only the exact preserved frame rather than rendering it again; otherwise rendering the missing frames.
4. Recording original/current renderer provenance per capture.

The entire source span defining input models, geometry conversion, scene, materials, lights, render parameters, cameras, targets, scales, view loop and model visibility is byte-identical. No geometry, color, camera, light, sample, seed, denoising, view-transform, or framing change appears in the diff. The original selected hero raw SHA already verified against the recovery receipt. Together, these establish matching scene/settings code across the recovered first capture and the nineteen remaining captures. This is code/receipt/raw-byte verification, not a rerender or a blanket assertion about unrecorded external environment state.

The earlier README and verification JSON retain the review's original chronology: the first renderer was absent from the submitted package at review time, but its immutable Git copy is now verified. This follow-up supersedes only the unresolved renderer-code qualification. The geometry-audit limitations, no-runtime/no-animation scope, frozen scores and recommendation to retain selected remain unchanged.
