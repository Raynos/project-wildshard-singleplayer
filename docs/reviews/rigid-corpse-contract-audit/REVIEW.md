# Independent rigid-corpse contract audit

2026-10-19. Unaccepted, opt-in implementation only. No product recipe was enabled by this audit. No source, Git state, build, browser, Mac, or remote work was changed; these ordinary review files are the only authored deliverables.

## Frozen identity and outcome

Reviewed implementation tree: `661647c747d62a3b3308dd1b4ca0fd2f3cd835bc`, manifest parent `d6a2af7cb71c139b443133c28fcdb68d97029aa6`, initial implementation commit `7a450187a6fd717efdc7f970ab5d4a7ea01e12e1`. All eight SHA-256 entries in `tmp/dot-audit/combined0650-manifest.json` matched working bytes immediately before the exact-byte test run. `source-hashes.json` additionally pins the event/clock/source files used in this review.

**Verdict: keep the study unaccepted and product opt-in disabled. One concrete correctness defect remains in the new path: its death-input snapshot permanently retains pre-death decision memory.** The bounds, rigid transforms, mass policy, collider ownership and fixed-endpoint implementation otherwise have useful focused evidence; that is not product contact or full lifecycle acceptance.

## P1 before product adoption: death-event memory never reaches the corpse

Locations:

- `src/engine/entities/rigidCorpsePose.ts:20-24` copies and freezes memory once at construction; `:35-39` subsequently advances only the new clock/flinch before evaluating that unchanged copy.
- `src/engine/entities/AnimalView.ts:331-333,390-394` constructs it in `died`, before the damage callback.
- `src/engine/entities/AnimalSim.ts:255-258` calls `died` before `damaged` on the lethal branch.
- `src/game/shardfile/decisions.ts:169-178` converts later damage/death events into decision events.
- `src/shards/driftwood-isle/behaviour/bellback.as:2-5,40-48` resets the visible pose to 6 and its clock to zero on death.
- `src/game/practice/PracticeCreature.ts:217-230` flushes applied hits, executes decisions, and only then updates the animal view. Thus the legacy animation can see the reset while the immutable new snapshot cannot.
- `src/shards/driftwood-isle/generators/bellbackTuckedClips.ts:16-32,43-44,56-63` gradually blends attack envelopes out using `1 - smooth(deathT)`, rather than switching them off with `alive=false`.

This is an actual Bellback result, not only a hypothetical arbitrary numeric program. `reproduce-stale-death-input.mjs` runs the unchanged numeric compiler and Bellback anatomy3 program against identical clocks and skeletons. It compares a pre-event snapshot (then mutates its original memory to the real death reset) with a snapshot that already contains the reset. `stale-death-input-results.json` records:

- Pulse tell (`tg-state=1`, clock `.96`), first fixed tick: bell rotation differs by `-0.13982024016203706` rad and clapper by `-0.6991012008101851` rad. At deathT `.5`, clapper still differs by `-.35000000000000026` rad.
- Echo tell (`2`, `.68`), first tick: bell `+.1198459201388889` rad, clapper `+.5992296006944444` rad.
- Stomp tell (`3`, `.68`), first tick: foreleg local Y differs by `+.2130619421580855` m; after six ticks it remains `+.06661834716796877` m.
- These sampled differences converge to zero by deathT 1. That does not undo intervening collider changes or resulting contact impulses.

The script isolates the numeric consequence and the constructor-copy boundary; it is **not** a full mounted combat/decision integration test. Event order is independently established by the source locations above. Existing native shape tests initialize memory directly in death state 6, so they cannot detect this failure.

### Bounded recommended repair

Keep combat callbacks and event phase ordering unchanged. At each owning fixed boundary, make an owned, finite scalar observation snapshot from the actual actor state required by the already-admitted numeric program, then evaluate once and publish its bone/root endpoints. Render must continue to interpolate only those endpoints, never read mutable actor memory or evaluate the program. This preserves detached evaluation while allowing the legitimate post-lethal reset to reach the next collision publication.

Simply deferring the initial copy once is insufficient for a retained decision owner scheduled in fixed.post, after corpse fixed.pre. A fixed.pre may legitimately precede its event delivery; a permanent pre-event snapshot must not. Regression cases should cover pulse, echo and stomp lethal hits with callback delivery before the next pre (practice) and in fixed.post after one pre (an explicitly retained owner). Assert that the next owning boundary after event delivery sees the reset, render calls do not republish it, each physics step consumes one endpoint, and no gameplay/event order or post-death attack behavior changes.

### Important page-world ownership qualification

A further source check found that actual Driftwood page-world ownership differs from practice. `src/shards/driftwood-isle/runtime/index.ts:68` uses `pageDecisionAuthority`. In `src/game/shardfile/borrowedDecisions.ts:75`, that owner requires `actor.alive`; at `:185`, it disposes the guest before running its queued callbacks when the actor has died. Thus the actual page-world onDeath reset cannot be assumed to execute on the next fixed.post. Practice retains the corpse by target membership (`PracticeCreature.ts:150`), and native decision owners similarly use retained entity identity, so the demonstrated practice defect and the general fixed-boundary requirement remain valid. A fixed.post regression must name its retained owner; it must not falsely model page-world lifetime or silently change that existing lifetime behavior. This audit does not classify the pre-existing page-world retirement policy as a new recipe defect.

## Reviewed invariants and evidence

- Strict inert schema: unique 1–8 bone parts; 4–128 points each; total <=512; finite 3-tuples within +/-20; strict objects/exact optional property handling. No material, mass, groups, callback or collider-kind payload is admitted. Pure-data and native preparation reject non-volumetric hulls.
- Bone identity/rig checks: packed admission checks bones and refuses upright recipes; AnimalFactory requires actual custom rig and registered numeric animation. Physics checks the requested build, named bones, ancestry, unit bone scales, positive uniform root scale and identity root parent before body creation.
- Scale/physics: hull vertices and root-relative translations are each scaled once. Convex descriptors are prepared once; fixed.pre updates only local translation/rotation. One rigid root gets legacy mass 5, COM and cuboid inertia via additional mass properties; each hull has mass zero. Collision and solver groups both retain DEBRIS/world-only masks, with original friction/restitution/damping.
- Transactional allocation: optional hull preparation precedes body allocation; failure on every collider index removes the root and attached colliders; live count increments only after constructor success. Fixed publication computes all relative transforms before applying them. Unsafe pose publication restores the prior bone endpoint and retires the corpse body; it does not leave a live partially updated compound.
- Endpoint ownership: fixed.pre restores the last current endpoint before numeric evaluation, so interpolated render bones do not feed the next step. fixed.post captures every body endpoint, including multiple steps within a frame. Render interpolates bone and root endpoints without changing deathT. Near/far render gating no longer gates this opt-in physics path.
- Freeze/lifecycle: quiet/sleep freeze waits for complete collapse; MAX_T remains a bound even for incomplete pose; root/bones freeze at the same current endpoint. Repeated retirement, scope-owned body removal, world-free disposal and cap reuse are covered by focused native fixtures.
- Defaults/living: absence leaves the original cuboid/upright/quadruped branches and legacy render path in place. The synthetic 180-tick AnimalSim pair compares serialized state, head/body analytic volumes, motion/attack/damage memory and local-storage cardinality with/without inert recipe. It does not prove every real weapon, melee reach, decision host or store lifecycle.
- Original asset fixture: all 13,374 original vertices, eight bones and 435 proposal points are present. It checks local collider translation for 48 ticks and mesh-versus-proposal support at sampled poses/directions. It does not assert actual native collider rotation/support against every rendered interpolation or run the original asset through ground contact.

## Clock composition: no additional defect established, missing integration proof

Bootstrap (`src/engine/core/bootstrap.ts:159-161`) and practice (`src/game/practiceDemo/startPracticeDemo.ts:119-121`) each register one pre/step/post trio. `Game.runFixed` (`:671-687`) suppresses steps while paused, uses real unscaled delta, clamps to three steps and drops remaining backlog. `Game.runPhase` (`:649-665`) also skips paused phases. This supports the intended pause and hit-stop ownership by inspection. Existing creature animation is likewise on unscaled time, so the new fixed death clock does not itself introduce a visual hit-stop multiplier.

The focused clock test's 6-Hz case manually executes every accumulated tick; it does not call the actual three-step-capped Game loop. Its pause/hit-stop case changes worldTime and merely omits step calls. Those are useful unit tests, **not evidence of complete bootstrap/practice composition**, repeated mount/dispose/retry, scheduler scope transitions or real pause/resume/backlog behavior. The native fixture directly invokes pre/physics/post. Add an actual-phase integration fixture before treating these gates as passed.

Other missing coverage, not newly proved defects: exact default rigid/upright/full-and-lite quadruped traces; full living melee/reach and gameplay/loot/retry/storage cycles; real original-mesh varied-hit/yaw/scale/terrain and interpolated support/contact measurements; exact-build 0-stuck physics walk; phone performance/visual review. These remain acceptance gates. No source inspection or synthetic flat/slope tetrahedron test replaces them.

## Reproduction and checks

From the repository root:

```
node --experimental-transform-types --import ./scripts/bake-loader.mjs docs/reviews/rigid-corpse-contract-audit/reproduce-stale-death-input.mjs
NODE_OPTIONS=--max-old-space-size=4096 WS_VITEST_MAX_WORKERS=1 node node_modules/vitest/vitest.mjs run test/rigid-corpse-clock.test.ts test/rigid-corpse-physics.test.ts test/rigid-corpse-schema.test.ts
```

The exact final-byte recipe run passed **68 tests / 3 files**, 14.45 seconds. No install, full suite or build was run. The source manifest match covers the final optional-chain rewrites, rather than relying on the earlier 83-test receipt.

The follow-on exact-byte run also passed **15 tests / 4 files**, 23.21 seconds:
`test/packed-creature-bodies.test.ts`, `test/animal-model-preparation.test.ts`,
`test/practice-creature-support.test.ts`, and `test/practice-demo-entry.test.ts`.
Total rerun: **83 tests / 7 files**, all passing on the frozen pre-fix bytes.
These passes do not cover the defect demonstrated above. This review and its
recorded differential are frozen to the listed source hashes; later repairs need
an explicitly separate verification and must not be interpreted as reviewed here.
