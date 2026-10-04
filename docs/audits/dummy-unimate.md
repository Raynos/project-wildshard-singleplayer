# UniMate dummy pilot — E336

**State:** 2026-09-30 — trial implemented and verified, live in `d1cdcee-munun0hj`; visual preference awaits Jake's review.

This is an offline motion trial on the existing wood, straw/cloth and wood/steel practice figures. Their appearance,
positions, topology, 18-joint bind skeletons and textures are preserved. UniMate generated six two-second clips per
figure: faint idle, body hit, head hit, left hit, right hit and heavy recovery. The arena blends those upper-body
poses with immediate directional hit springs; mass controls the impulse and playback rate. Damage, headshot volumes,
stagger timing and projectile attachment keep their existing behavior. Procedural/legacy fallbacks remain supported.

The raw generations were not ready to ship. They exposed existing voxel-weight leakage from torso into arms,
sharp skin gradients and abrupt orientation changes. The approved candidate uses source-controlled Gaussian skin
weight smoothing (0.065 m radius), arm/torso influence cleanup, original parent-frame retargeting, fixed root/legs,
head/side/heavy masks, rest-to-rest envelopes, quaternion smoothing and a maximum four-degree change per 30 Hz frame.
The hit springs use 20% travel on the humanoid rigs so clips and impulses do not double joint motion.

This produces restrained motion on anchored practice targets, not a new visual design. UniMate's usefulness here
must be judged against the existing springs in actual footage; passing numeric gates alone does not prove a better
feel. NPC/creature rollout is a separate draft decision in [ANIMATION-REMASTER](../plans/ANIMATION-REMASTER.md).

## Measured evidence

| Check | Result |
|---|---|
| Local generation | 18 finite candidates, 450.271 s total; warm samples ~20 s; 2.620 GB peak footprint |
| Clip sweep | 18/18 clips, 61 evaluated samples each; all vertices and meaningful triangles |
| Runtime sweep | 12/12 actual controller + spring combinations, 61 samples each: light sword, charged sword, body bolt, head bolt on all three |
| Original geometry / topology / bind / rest parity | Pass; weight edits only |
| Maximum triangle edge stretch | 1.65235×; gate (E388): no more than the figure's shipped springs alone, measured in the same run (wood 1.83×, straw 2.07×, wood/steel 2.05×) |
| Minimum triangle area vs rest | 6.9169%; gate (E388): no less than the shipped springs' minimum (2.2 %, 6.5 %, 10.9 %) |
| Fixed base vertices / root / legs | Zero movement/rotation |
| Loop seam | <7.7e-8 source units |
| Maximum quaternion frame step | 4.00224° (120.067°/s), the bake's 4° per 30 Hz frame; gate (E388): joint speed no more than the shipped springs' (300–326°/s) |
| Weights / indices / finite poses / quaternion norms | Pass; the weight sum within its float32 rounding (4 × 2⁻²⁴) |
| Existing geometry exceptions | 20 degenerate and 48 numerical sliver triangles, explicitly counted; meaningful-area threshold 1e-8 matches the earlier Blender gate |
| Focused runtime tests | Seven checks across clip data, repeated additive blending, hit springs and Rapier target behavior passed |

Full [skin report](dummy-unimate-skin.json) retains failed first-take evidence and exact asset/source hashes.
[Generation provenance](dummy-unimate-provenance.json) records prompts, seed, sampling, pins and postprocessing.
Reproduce the approved asset checks with `node scripts/practice/verify_unimate_skin.mjs`.

## Reproduction

1. Follow [localai's animation reference](../../../../localai/docs/animation-models.md) for the pinned checkout, isolated
   dependency overlay, canonical weight store and machine-wide model lock. No checkpoints enter this repository.
2. Export each original ordered rig with `scripts/practice/unimate-rig-input.mjs` (wood source is `wood-wood.glb`).
3. Run `scripts/practice/generate_dummy_unimate.py` under the shared lock. Save raw candidates in the local work area.
4. `scripts/practice/bake_unimate_clips.mjs <generated.json> <motion.glb> <provenance.json>` retargets and constrains them.
5. `scripts/practice/repair_dummy_weights.mjs <original.glb> <shipped.glb>` repairs weights once. For a full asset
   rebuild this post is wired into `scripts/practice/build_dummies.sh`; do not repeatedly smooth an already repaired file.
6. Run the numerical verifier and focused tests. For the HUD capture, run
   `BROWSER_LANES=3 scripts/browser-lane.sh --max 8 node scripts/practice/capture_unimate_arena.mjs build progress/e336`.
   The capture builds after acquiring the lane and closes its browser and owned preview afterward.

`progress/e336/offline-preview.jpg` and `.mp4` are an earlier candidate **offline Blender studio** preview, with actual
generated body/head/heavy clips and no HUD, additive springs or combat layer. They are not the final game verification.

`progress/e336/arena-reactions.mp4`, `arena-*.jpg` and `runtime.json` show the final candidate in the real HUD arena,
at portrait phone tier on Chromium Metal. All three models bound 13 upper-body joints and all five reaction clips;
no page errors or dummy loading warnings occurred. Hits were scripted damage calls, followed by rapid repeats.
This verifies integration and provides visual review; it is not a physical-iPhone performance reading or a recording
of weapon input. The capture closed its browser and owned preview.

Implementation `3ad39bbd` passed the full clean-export gate; push CI `36690133455` and release `36690327249` succeeded.
Production `/version.json` reported `d1cdcee-munun0hj`, and the deployed motion SHA256 matched the tested asset.
