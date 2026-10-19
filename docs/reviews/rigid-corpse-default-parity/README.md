# Independent no-recipe ragdoll parity

## Verdict

**52 focused native tests pass; focused type-aware oxlint passes.** The opt-in extension leaves all sampled no-recipe rigid, upright, full quadruped and lite quadruped results exactly equal to the original implementation. This is a bounded native physics regression proof, not product adoption, a renderer/device acceptance test, or a claim about every possible world.

- Baseline: `540a4156ec261fe95e8bcf6b9f420d67bd9532ef:src/engine/physics/ragdoll.ts`, verified ancestor of tested HEAD `3f32029d33e0931cbe703b53d7065a7ad05dbf56`.
- Preserved baseline bytes: [ragdoll-540a4156.ts.txt](ragdoll-540a4156.ts.txt). Git blob `e40bda9544ad770150d2ce7654c0338c67b0464f`, SHA-256 `a385a470f0940b26c12d9cc255d78a0690882dfaec5eaad122ab471a21e257e3`.
- Test: [rigid-corpse-default-parity.test.ts](../../../test/rigid-corpse-default-parity.test.ts).
- [Verbose passing output](test-run.log), [focused lint output](lint-run.log), [source hashes and constant verification](provenance.json).

## Method and coverage

The unchanged baseline text is transpiled with the installed TypeScript 6 compiler into an isolated CommonJS module with a closed dependency whitelist. Current and old implementations use distinct native Rapier worlds, identical installed SIMD WASM, identical Three objects and identical initial conditions. The baseline's runtime `groups`, `query`, `fixedStep`, and `tier` dependencies are byte-identical to their historical Git versions. Both use today's Physics wrapper; its only change since the baseline is the read-only `disposed` getter. This is a paired ragdoll implementation test, not a rebuild of the complete historical application.

The real committed Driftwood creature bake is decoded through `packedCreatureBodies`: crab/small for rigid, monkey/monkey for upright, boar/boar for quadruped. No made-up replacement rig is used. The floor is a controlled flat native WORLD collider. Each input lacks `rigidCorpse` and `corpsePose`; the test verifies recipe absence. No product JSON or production source was modified.

- Four build modes × uniform scales 0.5, 1, 2 × 30/60/120 Hz rendering: 36 six-second paired traces, covering 15,120 rendered samples plus every intervening fixed endpoint. 30 Hz exercises two-step catch-up; 120 Hz exercises no-step render frames and interpolation fraction 0.5.
- Initial launch/spin, velocities, mass, COM, effective inertia, damping, collision and solver groups, friction/restitution, body/collider/joint counts, sleep state, root/bone transforms, root position, fastest motion, live counts and lifecycle states compare exactly.
- Both worlds step at 60 Hz. New `fixedPre` → native step → `fixedPost` hooks are exercised in production-bootstrap order, followed by render `pose`; old worlds have no added hooks. Defaults remain outside the new posed-corpse collection.
- Full quadrupeds retain 11 bodies, lite 6, rigid/upright 1. Non-unit scale is applied through real authored rigs.
- Four explicit native sleep tests prove freezing remains render-owned for defaults; fixed hooks do not freeze them. Frozen placement survives a simulated sink offset; frozen and live disposal are idempotent and release body/collider/joint ownership.
- Explicit quiet and forced-moving timeout cases retain the existing floating-point threshold frames: zero-based frame 30 and 300 at 60 Hz, respectively. These use the old no-clock interpolation fallback.
- Eight damage 0/1000 cases test throw clamps and zero horizontal direction fallback at scale 1.7, initially and after 12 native steps.
- Caps 1, 2 and 6 reject excess spawns and recover slots after freeze/disposal. Both exported phone/desktop caps and the current default constructor cap are checked.
- Throw, sleep, timeout, damping, righting, joint-limit slack and cap constant declarations are identical to baseline (recorded in provenance).

## Precision and limits

Assertions use exact exposed field equality, with **no numeric tolerance**. This is stronger than an epsilon comparison for the sampled values; it does **not** establish equality of all serialized WASM memory, internal contact caches or output on another CPU/browser. The test does not run mounted `AnimalView`/`AnimalManager`, species death animation, `Game` scheduling, actual browser rendering, sloped/bumpy terrain, device frame budgets, or a product opt-in. It mirrors the verified bootstrap order rather than booting the full composition. The separate pose-input-order tests own animation-input ordering.

## Reproduce

Run from the repository root, using only installed dependencies and one worker:

```
WS_VITEST_MAX_WORKERS=1 node node_modules/vitest/vitest.mjs run test/rigid-corpse-default-parity.test.ts --maxWorkers=1 --reporter=verbose
node node_modules/oxlint/bin/oxlint test/rigid-corpse-default-parity.test.ts
```

Direct Node invocation avoids this environment's `pnpm exec` dependency-status auto-install attempt. No package install, full suite, build, browser, Git write, checkout, worktree, copied repository or Mac operation was used. All test-owned native worlds and geometries are disposed.
