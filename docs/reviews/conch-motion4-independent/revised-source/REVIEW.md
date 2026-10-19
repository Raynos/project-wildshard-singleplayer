# Conch motion4 revision2: independent source re-review

## Decision

**Proceed to an isolated diagnostic build and complete-cycle capture, subject to root authorization. Do not promote or replace published motion3 yet.** The concrete early-damage/late-alignment source defect is corrected for the measured runner domain. The original rejected freeze and six independent negative-witness files remain unchanged. This decision supersedes the original source review's no-build decision only for revision2.

Freeze SHA256: `fb27b7ed8f16d3fe7455195c9b7d3f35067570be2cf0d3fb9c481a4cee820f0a`. Independently verified all55 listed file hashes. Source-check SHA256: `e11589453bd6f0ce8f4bc9a4d1641bbda4d4be4d11bdcb977811c2eb237ab17f`. No current source edit, app build, browser run, Git operation or publication performed by this reviewer.

## What changed and why the source block is cleared

- Rapier is aligned by windup−.10s and held through windup+.30s. Its forward motion begins during the last portion of preparation instead of requiring the target to wait35ms after active entry. A constant−.40rad shoulder-Y ready stance shares the inward turn; forearm active amplitude is reduced from−.80 to−.40rad.
- Real StrikeRunner tests evaluate fresh candidate weighted geometry at actual first damage, rather than querying one aesthetically chosen key. Verified the test loops and independently checked the report contains720 cases: two strikes × five dt values (5ms, the real FIXED_STEP,1/30,.05,.1) × three clock skews (−dt,0,+dt) × two structural actor update orders × three first-step offsets × four flinch values (0,.1,.5,1).
- All report the same aligned tip: x−.009436543,y.883615617,z1.986174129m. This is inside nominal ±.325m lane and z1.8–2.4m test bounds. There are483 additional dense plateau checks. No strike, AI, damage, reward, root, lower-body or death change is required.
- Rapier recoil is smoothly suppressed during the alignment plateau, preserving weapon presentation under residual flinch while head/shield retain recoil. After stage cancellation, normal arm recoil resumes. This is a reasonable bounded source correction, not proof of smooth interruption.
- Original shell/head idle amplitudes and guard-driven initial shield angles are restored. Stage4 preserves the guard brace after mechanical guard clears; stage3 clock0 starts from that same brace and releases it over .18s. It visually communicates the preceding block, not continued invulnerability. Source tests explicitly compare original guard/breathing at clock0.
- Strict128-node admission, allowed inputs, stateless consumer, lower-body bytecode equality and full tested death parity remain. Additional rejection tests cover extra pose-history data and numeric locals. `frame.attack` remains windup-only and is not misrepresented as a runner clock.

## Independent geometry cross-check

`verify-poses.py` independently decodes the frozen canonical payload and reconstructs all7,338 vertices through all four weights, bind inverses and the saved bone position/quaternion hierarchy for45 source snapshots. Every minimum is3.0000000000000027mm. Reconstructed ordinary/counter tips differ from the producer's saved tip traces by at most4.44e−16m. Output: `weighted-snapshots.json`.

This verifies the supplied snapshot geometry and skinning arithmetic; it is not an independent invocation of the candidate curve evaluator, a rerun of every producer sample, or captured world-transform evidence. The tests still describe mostly local-space sampled poses, not collider/planted/no-sliding acceptance. Producer geometry suite was not needlessly rerun.

## Remaining risks to expose in capture

- Exact arbitrary interruption continuity still fails. At ordinary .4s→stage4, shield X now matches, but another axis still jumps .39166rad at zero flinch (.25230 at half, .11294 at full). Counter .485s→rest has maximum .48rad at zero flinch, .46 at half and .52 at full. These maxima and per-axis values are preserved in `audit.json`. Do not report the shield-specific repair as a continuous full-body handoff.
- The new constant living shoulder-Y stance returns to motion3's original zero/folding death expression when death begins. Exact death parity therefore does not imply continuity from the new living stance into death. Inspect the lethal frame, actual poseInput and the preserved one-render onset behavior.
- Committed alignment is held200ms into nominal recovery, longer than the original proposed withdrawal. This may read as a sustained poke or premature full extension during late windup; only the encoded cycle can establish whether anticipation, active action and recovery are perceptually clearer.
- First-contact runner tests put the target in reach from the start. They do not demonstrate late entry into the active lane, cover becoming clear later, actor translation/rotation, changing targets, an actual player's collision footprint, or arbitrary variable-step schedules. Cancellation is separately checked for no later ghost hit, but it is not a full host damage-event regression. The five dt values and ±one-step skew are explicitly bounded hypotheses.
- Actor-order branches in the structural runner test principally vary the attack clock which the candidate does not read. They do not reproduce full AI/physics/view order. Actual host runner/behavior/pose clocks and locked world lanes must still be captured.
- Floor coverage is improved with54 gait/time/speed combinations, and blade-box checks total1,989 including first-hit/gait cases. These remain sampled edge/vertex-versus-torso-box checks, not all-part triangle collision or all-render contact. Death, hit knockback and footsteps require actual world weighted reconstruction.

## Capture acceptance and scores

Freeze exact product and host with the candidate, preserve complete failed and successful trials, and inspect every encoded frame in complete-cycle ranges using actual render cadence and authoritative state. Required cases: ordinary attack; guard-to-stage4-to-counter; early/late windup hits; active/recovery interruption; footsteps; idle; lethal interruption; persistent corpse; player defeat; Retry; isolated reentry and storage/reward reset. Compare with preserved motion3 on the same meanings and distinguish video frames from render/physics steps.

No five-point motion rating is assigned from source. Existing static3.57/5 remains untouched. Final scored domains remain readability, guard/thrust/counter tells, hit/recovery, death and grounding/contact. An improved exact capture with applicable functional/contact checks may earn **labeled WIP** promotion only; physical-phone and human-fun acceptance remain outside scope.
