# Independent exact-strike adapter source review

2026-10-19. Verdict: **PASS for the bounded read-only opt-in adapter source. REJECT the authored complete motion.** No product, browser, build, deployment, visual score, phone or actual-world-contact acceptance is implied. No frozen source or production asset was edited by this review.

## Adapter safety

- The three existing-file diff adds readonly runner phase/time/admitted-ID access, strict optional pose selectors, detached numeric strike observations and conditional group lookup cleanup. No engine/format/SDK ABI, movement, combat, RNG, reward, save schema, clock or service changes were found.
- StrikeRunner getters return its existing state/time/spec. The admitted ID list is a fresh frozen array filtered against the existing catalogue. Pose evaluation does not call restart, restore, update, bind or owner construction. Group catalogue admission remains lazy on its existing first fixed step: an earlier opted-in read fails closed rather than admitting or advancing it.
- Optional selectors allow one or two distinct bounded IDs. Every requested ID is checked even while idle. Missing authority, nonselected current IDs, invalid phases and invalid elapsed values throw before joint writes. Cached rigs do not bypass validation. The current-null/nonidle combination is refused. Inactive alive/variant rows retain their existing no-write early return.
- Group disposal deletes the actor lookup only if it still references that exact control. Fresh single/group disposal and rebind tests pass; an old scope cannot remove the rebound controller. No broader group lifecycle was changed.
- Old rows never receive the strike owner and never perform the authority lookup. Candidate7 remains authority-free. Exact shipping parity tests pass for crab, thrall, sailor/captain and monkey, including native continuation. The implementation does add tiny detached per-call allocation even without opt-in; no performance or runtime-bundle claim is made.
- Runtime static-import traversal from borrowedDecisions covered 199 source files, with no unresolved imports and no path back to channelPrograms. Thus the new edge does not introduce a static runtime dependency cycle. Type-only imports were excluded.

## Fresh verification

- Original authority and preview focused suites: **10/10**, including real single/group snapshots, SimHost/RNG snapshot invariance, unchanged observed damage (10), strict negatives and conditional disposal.
- Independent negatives and legacy parity: **10/10** across three files. Added unknown/prototype/undefined phase and out-of-range/nonfinite elapsed checks after rig caching; 100 reads with unrelated presentation t/dt leave controls, world and damage unchanged.
- Final independent suite: **4/4**, additionally reproducing the exact shoulder recovery witness directly from the numeric evaluator without writing retained measurements.
- Source admission/tamper/strict-rejection suite: **3/3**. Transitive TypeScript and focused three-file lint: exit 0.
- All 17 frozen source files and all 14 original candidate7 pins verified. Exact hashes are in verified-source.json. Source receipt SHA256: 04109946cd9439e075b69ba911fc34067b5fcb23de021243c6bce3ca90bda420.

## Motion remains rejected

The independent two-pose witness on raptor-1, first-strike recover at 3/60 to 4/60 seconds, is **0.13444144375857628 radians**, exceeding 0.10. Even with ideal stance inputs, motionSourceGate returns false and requireMotionSourceGate throws. The existing characterization test being green cannot admit the motion.

Independent read-only arithmetic over the retained source gait samples exactly reproduced all stance metrics: foot/root ratios **0.8158865282, 0.2622255992, 0.7996249005, 0.2695208386**, and median speeds **0.9380406678, 0.2977463496, 0.9236276887, 0.3098316500 m/s**. Every foot fails both 0.20 limits. These are synthetic source fixtures, not actual-world contact or an improvement to candidate7's actual-run 1.010056 measurement. The full 1,324-pose characterization was inspected but intentionally not rerun because it writes a frozen evidence file. No curves or thresholds were altered.

## Reproduction and evidence

Run the existing node_modules/.bin/vitest with the complete-motion config and explicitly select test/mantis-complete-authority.test.ts and test/mantis-complete-preview.test.ts. Run the independent config in this directory for its independent tests and old public pose parity. Run node --test scripts/mantis-complete-motion-admission.test.mjs. Run node_modules/.bin/tsc --noEmit -p docs/reviews/mantis-complete-motion-plan/tsconfig.json and node_modules/.bin/oxlint on the three adapter files.

Fresh logs are under ignored tmp/mantis-exact-strike-adapter-independent/: authority-preview-direct.log, independent-legacy-direct.log, independent-final.log, admission.log, typecheck.log, lint.log, dependency.json, stance-recomputed.json. Initial pnpm-wrapper launches failed before tests because its automatic dependency check attempted an unavailable store path; direct installed binaries completed successfully. No install or permission change was needed. The Vite extension warning is nonfatal and unrelated to the adapter. No git write, product build, browser, model or engine edit was performed by this review.
