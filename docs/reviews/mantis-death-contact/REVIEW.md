# Mantis early-death contact diagnosis

2026-10-19. Candidate5 stays HOLD; preserve public candidate4. Recommend one isolated anatomy change: redesign the existing knee death-fold curve so the early tuck develops before the torso/root tips, preserving living and settled-corpse endpoints. Do not implement root translation/rotation changes, collider padding, global solver changes, clocks/AI changes, new architecture, or engine exemptions. Bellback is outside scope.

## Exact-input reproduction

Product `984bfeb67b6fbd80371783923ccfbdff0a942d77ab83b3fcc4ad616a1ac5e962`. Rechecked all 23 source-closure and 28 capture-closure entries: zero mismatches. No gameplay source changed. One focused installed Vitest evaluates the actual `numericCreaturePose` for both `mantisFoldedClips` (candidate4) and `mantisOnsetClips` (candidate5), against native 22-bone binds and recorded complete world matrix. Results: `evaluator-results.json`; runner: `focused-test.txt`; preserved test: `evaluator.test.ts`.

At trace385/HUD390: deathT .1103749999962747, flinch .6152971236343303, speed0, gait .9117436717979435, stage5, observed phase0/clock7.6. The pose-owned time is **boutTime15.917499999999974**, not gameTime34.19939999999118. `PracticeCreature.ts:207–230` advances elapsed and passes it to `animal.update`; `AnimalView.ts:348–356` supplies that time and the updated death/flinch values to the custom-rig evaluator. The captured delta .0883s advances deathT from0 to .110375 and flinch1 to .615297. `numericCreaturePose` copies current context and scalar reads at `channelPrograms.ts:80–138`. Unread fixture fields (seed/state/look etc.) do not affect these programs.

**Candidate4 versus candidate5: exactly zero across all local translations and quaternion components. Candidate5 versus all 22 recorded bones: exactly zero.** Using gameTime instead yields maximum mixed-component error .00709711545 (a component comparison, not a claimed distance). Stage5 disables the only onset changes: `mantisOnsetClips.ts:24,29–33,78–84`; candidate4 has identical death/body/knee expressions. This is evaluator parity at captured inputs, not a paired candidate4 runtime capture.

Native weighted vertices reconstructed with captured meshWorld, complete posed hierarchy, and absolute bind subtraction reproduce **−.10222949073886411m** for `leg-1_1_knee`, 98 vertices below floor. All other parts are positive; next-lowest is `leg-1_0_knee` at +.226631104291m. The recorded mesh root Y is900.1441132811673; actor position Y is900.154296875. They are not interchangeable. Mesh world contains coupled pitch/roll; yaw plus actor position is not the recorded transform.

## Counterexamples and mechanism

Every following counterfactual retains the actual failed world matrix except the explicitly labeled upright-root diagnostic. These are geometric diagnostic substitutions, not simulated futures or accepted edits.

- Remove flinch alone: **−.110241545764m**, worse. Flinch suppression does not fix this sample.
- Remove death folding alone (deathT0): **−.131107615753m**, worse. Existing folding helps but is insufficient early.
- Retain all failed local transforms and root translation, substitute upright root rotation: **+.199964159680m**. This identifies the importance of the actual tipped root; it does not propose modifying it.
- Replace only the failing knee's rotation with its already-authored next-frame value: −.078290667289rad → −.290298348177rad; **+.006680955833m**, zero below-floor vertices across the rig. No root/body/hip/other-knee change. This is one anatomy-local existence proof, not a parameter search or a proposed step discontinuity.

`mantisOnsetClips.ts:22,73–75` uses D=smoothstep(deathT), hip roll=side×1.4D and knee roll=side×(.38D+2D(1−D)). At this frame D=.0338586039548, so the knee has only .07829rad of tuck. Its onset derivative is zero, while the rigid root receives an immediate throw/spin (`ragdoll.ts:211–244`). The native long knee-weighted lower leg/tarsus is still extended as that root tips. This is a demonstrated local-anatomy/actual-root-trajectory mismatch; it is not evidence of an onset regression, numerical solver failure, or host bug.

The candidate metadata has no rigidCorpse entry. `AnimalView.ts:335–339` therefore selects the ordinary rigid root without a fixed corpse-pose owner; local collapse runs at render update (`348–358`). `ragdoll.ts:329–365` separately publishes/interpolates root transforms. No fixed-pose assumption or Bellback lifecycle should be imported into this diagnosis.

## Lifecycle boundary and limits

HUD388,390,391,392,399 reproduce exactly from current captured inputs and boutTime. **HUD389 does not**: its lethal scalar state already says flinch1/deathT0, but bones still contain the earlier animation result (maximum mismatch .089925818488m in body Y). The post-animation hit updates state (`AnimalSim.ts:248–258`); replacing only HUD389's decoded flinch with the previous recorded flinch reproduces its bones exactly. This boundary mismatch must remain explicit; do not claim full-trace scalar replay. The actual failing HUD390 is not that mismatch: all 22 poses are exact.

Measured actual adjacent contact: HUD389 +.011565653370m; HUD390 −.102229490739m; HUD391 +.041571169770m; HUD392 +.276343240801m. Nonuniform compositor samples do not establish continuous clearance. No paired same-host candidate4 capture exists; no physical-phone, visual smoothness, collider, or runtime acceptance follows. Root physics was held fixed in substitutions, not rerun.

## One next scope

Implement a candidate-only **early knee death-fold curve redesign**, using the existing deathT input, with living and final corpse rotations unchanged. Keep public candidate4 intact. Aim to bring the lower-leg/tarsus inward before this captured tipped-root pose, without changing body height, hip/root motion, attack onset, hit/AI timing, or the host. The next-frame substitution demonstrates that this joint has enough local articulation to clear the failing world transform; it does not select coefficients or certify other trajectories.

Required proof for that separately assigned implementation: preserve exact baseline reproduction including the lethal-frame exception; test the failed pose and complete captured early-death neighborhood with the full world matrix, preserve both endpoints and all unrelated channels, then review continuous animation/contact in a separately authorized capture. Reject a discontinuous snap or other-leg penetration. No further parameter sweep or implementation occurred in this diagnosis.

## Reproduce the focused evaluator

From repository root, copy `docs/reviews/mantis-death-contact/evaluator.test.ts` to `test/mantis-death-contact-diagnostic.test.ts`, run `node_modules/.bin/vitest run test/mantis-death-contact-diagnostic.test.ts`, then remove only that temporary copy. Relative imports deliberately target that execution location. The test writes `evaluator-results.json`; capture runner output separately. It does not build, start a browser, install packages, or mutate gameplay. The diagnostic's retained hashes are in `evidence-closure.json`.
