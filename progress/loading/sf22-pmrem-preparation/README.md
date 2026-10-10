# SF22 initial PMREM preparation

WebKit initial HDR and faceted-sky PMREMs now compile the exact offscreen
variants in painted slices, then execute every original draw in order with a
paint between passes. Captured tone mapping participates in the compile key.
Other browsers retain their synchronous factory path. A retained faceted
PMREM generator delegates normally for later day-clock refreshes. Cancellation
is fenced to the captured construction owner; generators retire on failure.
No shader source, sampler, target format, look or memory cap changes.

## Proof

- Four PMREM/owner/browser-policy fixtures plus four lighting fixtures PASS.
- Strict types and touched root-config typed lint PASS.
- Actual GPU comparison, muted Chromium and WebKit at iPhone 16 Pro dimensions:
  HDR and scene (coloured background + real mesh), 336×128 half-float targets.
  **0 differing half-float values**, nonzero output, **GL error 0** in all four
  comparisons. Each comparison: **2 programs before and 2 after**. The factory
  replay uses the same meshes/materials and exact native shader source.
- Fixture result SHA-256: `9432ece0dd15e8c4c36cfbab020ae5ddc9291bbdb2dd8bf34fff5b743e038d4e`.
  Scratch: `/private/tmp/claude-501/sp-builders/sp-x5/pmrem-pixels/`.
  Earlier fixture-only setup/readback failures carry no parity credit.

This is an exact-output scheduling proof, **not a Safari cadence PASS**. The
matched network-shaped desktop/Simulator route remains the next measurement;
its preceding clean result is in `../sf22-exterior-clean/README.md` (Safari
47/68 ms, 18 draw/driver calls). No local full suite; the serialized push gate
owns the full suite. Downward game→engine +2 defining ports (`offscreenBuild`
and `app/resources`); no new shard-specific branch.
