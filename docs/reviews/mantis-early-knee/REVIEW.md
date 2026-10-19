# Mantis candidate6: early knee death-fold source study

2026-10-19. **UNACCEPTED, source-only.** Preserve public candidate4 and failed candidate5 byte-for-byte. No build, browser, publication, physics change or runtime acceptance occurred. Root checkpoint and fresh independent review are required before a build decision. Final exact-source run:7/7 focused tests; existing/new preview run10/10; exact old/new admission/tamper8/8; changed-file type-aware oxlint exits0. Full app build/typecheck and browser were not run.

## One chosen anatomical change

Candidate6 keeps candidate5's entire live animation and attack-onset behavior. Only the four knee death-roll outputs use K=smoothstep(clamp(2.5×deathT)) in place of D=smoothstep(clamp(deathT)) in the existing expression side×(.38K+2K(1−K)). The live knee gait contribution still uses the original D. This compresses the same tuck-and-settle motion from 0.8 to 0.32 seconds, moving the knee-weighted lower legs/tarsi inward before the unchanged body/hip collapse. No coefficient search or alternate curve was run.

Both exact endpoint rotations (0 and side×.38 radians) and the original maximum amplitude (.70805 radians) are retained. The curve is C1, with zero endpoint speed; it reaches its final knee orientation earlier. This is a proposed anatomical sequencing choice, not a guarantee that 0.32 seconds looks natural.

Body/neck/head/abdomen/hips/wings/raptors, root transforms, geometry, dimensions, active-onset behavior, flinch, strikes, AI, decision memory/cadence and host are unchanged. New source names, preview plumbing and exact candidate6 admission are isolated. No engine exemption or wildcard was added.

## Baseline and sampled results

The actual numericCreaturePose evaluator reproduces candidate5 HUD390 exactly across all 22 local transforms using boutTime15.917499999999974, deathT.1103749999962747 and flinch.6152971236343303. Candidate4 evaluated at those same inputs is also identical. Full captured meshWorld and native weighted vertices reproduce the known −102.229490739mm knee failure.

The chosen curve changes that knee from −.078290667289 to −.374148485574rad. With the same full world transform, all parts clear the floor; the lowest is the same knee at **+59.176055740mm**. All other local transforms remain untouched.

All 469 candidate4 and 1,355 candidate5 recorded orientations were tested. Every recorded knee pose matches its baseline evaluator inputs exactly. Candidate knee quaternions are substituted into the recorded full skeleton, preserving all other captured channels and meshWorld, before reconstructing every native vertex. Minimum all-part clearance across all frames is +.672828108mm for candidate4 and +.671694238mm for candidate5; these near-zero minima are living poses, not the failed death sample. Both entire captured death neighborhoods have positive clearance, including the earlier return to .38rad.

This is exact **knee-input parity plus captured-world substitution**, not full candidate4 scalar replay or paired runtime evidence. Candidate4 did not record boutTime; its full replay is deliberately unclaimed. Candidate5 has five full scalar-replay mismatches in the complete trace. In particular HUD389 updates flinch after animation: using its previous captured flinch reproduces the lethal pose exactly, whereas using the current flinch does not. The failed HUD390 has zero full replay error. All raw mismatch values remain in results.json.

## Angular change and intersection limits

Maximum adjacent sampled early-death knee change rises from .233606 to **.395484rad** on candidate4 and from .227666 to **.374148rad** on candidate5. Candidate5 HUD391 then changes .332220rad, followed by a .268861rad return at HUD392. Nonuniform samples cannot establish visual smoothness; C1 continuity is not perceptual acceptance.

A 1,001-point normalized local sweep finds peak angle .708043956757rad and maximum .004936716423rad change per .001 deathT (about6.17rad/s at the actual .8s normalization). All 101 retained dense poses and all captured substitutions were screened for triangle-surface crossing between different walking legs. Zero newly introduced crossing pairs were found. This is actual triangle geometry with AABB broad phase and separating-axis narrow phase, not bone-endpoint distance; it does not prove solid containment is absent or certify collisions with other body parts. All-part floor clearance is measured separately.

**Synthetic interpolation reveals a warning:** candidate5 reaches −10.032655001mm between its lethal/first-death captures; candidate4 stays at least +21.246430566mm. This negative diagnostic is preserved, not tuned away. It is not a measured runtime failure, but fresh capture must specifically resolve it.

Synthetic between-sample diagnostics interpolate recorded root translation/scale and quaternion orientation, plus unrelated recorded local transforms, while evaluating the authored knee curve. Their results are retained separately. These invented paths are not measured physics trajectories, and cannot establish continuous clearance, especially around the lethal animation/state boundary. A fresh actual-engine capture must review every encoded frame and exact posed vertices before acceptance.

## Evidence and reproduction

- test/mantis-early-knee-study.test.ts: baseline, endpoint/channel parity, both full trace sets, angular changes, triangle crossing, dense local curve, synthetic interpolation, compiled DAG identity.
- test/mantis-early-knee-preview.test.ts: ordinary isolated source catalogue.
- scripts/mantis-early-knee-admission.test.mjs: exact tuple, payload tamper, receipt self-authorization refusals. Existing candidate4/5 admission tests remain intact.
- results.json: complete measurements; focused-test.txt, preview-test.txt, admission-test.txt and lint.txt: commands' outcomes.
- preservation-before.json and preservation-check.json: all old candidate4/5 files and85 closure entries unchanged. Root separately screened diagnosis-only focused-test.txt and evidence-closure.json during this study; original bytes/closure remain preserved by root, and no evaluator/test/result/gameplay changed. See the diagnosis public-screening.json and original-evidence-closure.json.
- source-closure.json: this frozen source/proof set; candidate6 admission is separately pinned by exact SHA256.

Run focused Vitest on the two new test paths and node --test on the new admission test. Source-only checks do not authorize executing build-mantis-early-knee-preview.mjs. No physical-phone, host-performance, hit fairness, collider or quality-complete verdict is made.
