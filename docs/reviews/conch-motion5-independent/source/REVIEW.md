# Independent Conch motion5 source review

## Verdict

**Bounded source GO for preparation of a separate, root-approved exact host/product build and actual capture. Not runtime, visual, animation, interrupted-continuity, collider, grounding, or publication acceptance.** No source-admission blocker found in the reviewed frozen candidate. The current motion4 product/host/public Site must remain retained. This review itself does not change `buildAllowed: false` or authorize a build.

Reviewed 2026-10-19 against source freeze SHA256 `47025e87c28ceb164115df26348d3994153b3aaa32bc4ef0bbf59de2e87b0c44`. All 73 frozen file hashes matched before testing and again afterward. Motion4's 55-file freeze still matches, with no differing shared entries; every file in its reviewed-build pin still matches. Tested motion4 clip SHA256 remains `5258300c0de5b0e2504aca3dcca5b05179c00abb88615a2e28eb42309acc8f00`. No product/source edits, build, browser, Git or remote writes were made by this reviewer.

## Material limitations and regressions

- A separate Python interpreter of the frozen numeric instructions independently reproduces all 6,120 source interruption samples and the maximum **0.5199568283214883 rad**, at counter clock .215, incoming flinch 0 → hit flinch 1, rapier forearm Y. Motion4's rerun maximum is .55. The test's `< .75` bound is a broad safety bound, not a continuity bar.
- Lower overall maximum does **not** mean uniformly improved hits. Actual ordinary guarded hits at clock .20 have maximum local-axis jump **.36631255398 versus motion4 .16759259259**; clock .10 gives **.29283950617 versus .20990740741**. There are 75 regression rows among the test's saved sparse comparison rows (not a count over all dense cases). These examples deserve explicit real capture, not omission in favor of counter .485.
- Death pose parity does not preserve the living-to-death boundary: the candidate's weapon ready/active yaw can drop abruptly to zero on death. The independent sampled maximum is **.8 rad**; active ordinary clock .6 with zero incoming flinch also has this .8-rad yaw change. This is a capture risk, not a claim that motion4's death behavior improved.
- Distinct incoming poses collapse to identical stage2/4, clock0, flinch1 observations. A stateless mapping cannot preserve all incoming poses. The frozen design admits this honestly; arbitrary interrupted continuity remains impossible under this contract.
- No supplied or rerun source test establishes weighted **actual world** contact, physical stagger quality, foot planting, encoded cadence, runtime order, or appearance. The canonical actor is identity-rooted in the contact harness; its floor check subtracts root Y. There is no terrain/world tilt/scale sweep or actual player mesh.

## Source and admission findings

The changed phrase is confined to living upper-body numeric outputs. Ordinary/counter anticipation, weapon commitment, earlier torso release, recovery reversal/settle, breathing and guard are authored samples driven by existing authoritative stage/clock/guard/flinch/time inputs. No read-joint history, custom elapsed-hit clock, new frame port, persistent numeric local, root offset, AI timing, combat or reward change is introduced. Nine distinct input paths appear in the emitted program; 26 programs reach at most 95 nodes under the unchanged 128-node ceiling.

Stage2 resets the behavior clock each stunned tick; stage4 retains zero during stun. The hit bridge actually reads flinch at clock zero. `frame.attack` is not repurposed as a recovery clock. Ordinary pre-.6 hits legally route to guarded stage4; stage4→counter onset preserves the shield brace. Clock-zero decay/repeated-hit tests exercise real input values, but are discrete pose tests rather than a full behavior simulation.

Root/lower-body bytecode and scalar declarations remain exactly equal to planted motion3. All death joint snapshots, including stale attack/recoil inputs, match it. Geometry payload, native frame, measured torso metadata and admission closure are unchanged; native tuple mutation rejection passes. The actual candidate numeric export equals the frozen `poses.json` byte for byte. Strict consumer rejects extra top-level pose history and numeric locals. Existing numeric schema/consumer/format/SDK files are pinned and unchanged from motion4.

The isolated factory uses the real SDK preparation/validation path and the unchanged Conch gameplay catalogue. Tests compare all platform sections, all non-pose named blobs, and all source fields except identity to the planted baseline: only Conch, both strikes, one decision, no quests/encounters/ledger/world progress. This is source isolation, not a successful browser Retry/persistence observation. The factory accepts supplied bodies, so the forthcoming exact product/host admission must independently enforce the same native tuple; placeholder diagnostic bodies in catalogue tests are not product admission.

`tests/tsconfig.json` inherits the root's strict flags and adds scope for these tests/art sources without disabling strictness. Its exclusion is node_modules only; no candidate/test exclusion was added. Narrow Node-I/O and Vitest default-export lint annotations have explanations. Focused lint exits zero with type-aware repository settings and zero warnings. Art source remains outside the repository's lint scope; this is not a full typecheck/build or a claim of full-source lint acceptance. Neither the root config nor consumer guards were relaxed.

## Independent execution

- `vitest run --config tests/conch-motion5-vitest.config.ts tests/conch-motion5-admission.test.ts tests/conch-motion5-contact.test.ts tests/conch-motion5-catalogue.test.ts`: **3 files, 6 tests pass**, 82.13s. Existing Vite future-native-loader warning only.
- `node --test scripts/conch-native-admission.test.mjs scripts/conch-readable-admission.test.mjs`: **3/3 pass**.
- `oxlint --deny-warnings` over the three scoped test files and scoped config: **exit 0**, no diagnostics.
- Fresh output: 4,815 living snapshots; 5,300 parity snapshots; 7,338 vertices/94 blended vertices; 483 aligned-plateau checks; 2,231 conservative torso-box blade checks; 54 varied gait/time/speed snapshots; 260 clock-zero/repeated-hit snapshots; 20 two-sided authored-knot checks. All 720 actual StrikeRunner first-hit cases pass, using a structural stationary actor and bounded timing/order/skew hypotheses, not an actual host actor or reach obstruction test (`canReach` always true).
- Independent NumPy four-weight skinning of 45 fresh saved bone snapshots reproduces 3mm floor clearance and rapier tip coordinates to 4.45e-16. This checks transform arithmetic independently; bone snapshots originate in the fresh SDK test. The separate scalar interpreter checks candidate numeric evaluation independently.

## Required next-stage evidence

A new exact source/product/host closure and root build GO must precede the shared-heavy-lane build. Preserve existing motion4 and every failed attempt. Actual encoded captures must cover complete ordinary/counter cycles, early guarded hits around .10/.20 and late windup, counter preparation around .215, active/recovery interruption, clock-zero stun and repeated hits, subsequent complete cycles, approach/stop/resume, lethal onset/corpse, player defeat, Retry and isolated persistence. Capture actual authoritative pose inputs, runner/behavior clocks, root/joint matrices and render/encoded cadence. Independently inspect every encoded frame and fresh weighted world contact. Tests receive no visual or animation score.

Evidence: `vitest.txt`, `native-admission.txt`, `lint.txt`, `audit.json`, `independent-evaluation.json`, `weighted-snapshots.json`; reproduction scripts `evaluate.py` and `weighted-check.py`. Test-owned transient output is under its declared temporary directory. Review-owned files are confined to this directory.
