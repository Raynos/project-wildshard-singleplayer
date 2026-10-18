# V57 motion2: actual-runtime animation evidence (WIP)

2026-10-18. Owner reported that the playable looked rigid. Source inspection
confirmed the previous native preview authored only three belly-scale channels,
capped at 1.10; idle, limb gait, tail, hit and death channels were absent. Functional
damage/reward tests did not establish animation quality.

## Scoped correction and provenance

The `attack` preview now authors upward body breathing, diagonal fin lift, tail
sway, fin windup/burst accents, body hit reaction, and whole-body death roll/flatten.
It uses actual frame time/speed/gait/flinch/death and the AI strike clock, not a
standalone showcase timer. Head stays bind-local under belly; no legacy head
translation or 1.57 inflation. Rest/1.05/1.10 diagnostic modes remain unchanged.
The 2.1-second strike timing and gameplay parameters are unchanged.

- Motion2 pose/test source checkpoint: `07e88721a8ff7283e16b71f4b2d7a1b02b95dfa3`.
- V57 native asset checkpoint: `d416b961d57f70a5d6a77753a72aba0b2d19db12`.
- Engine baseline: `c4339d90a93ccc289540e3a72c1e9cbf221d98fb`.
- Pose source: `src/shards/driftwood-isle/generators/pufferNativeClips.ts`, SHA256 `73eb5a123aa55fd5a358f893d6fb05fbe87d87a92ba13ba76231264757230b02`.
- Test source: `test/puffer-native-preview.test.ts`, SHA256 `150ddcbca13efc66c6eec946fff4a69fd39f5d43238e0b75b729f23f7fe66f8b`.
- V57 native SHA256 `c3dc5595bce7180ed39b0c8156833afcdc6b4ac1000eab08078037cb5bb16187`.
- Motion2 product source hash `36221fafd07e02542c12005516f529e009a3758ae76386bce3e8724865fdeec0`.
- Six focused pose/product tests pass, including real numeric-channel execution for idle, gait, windup/burst, flinch and death. Typed lint passed before the final numeric death-lift correction; the correction was then covered by the six-test rerun.

## Genuine recording and observed changes

Raw recording: `page@8efd90846e38fbbdb336a43466921fd5.webm`, SHA256
`ce918dd3954537762c2378d84f7c410eddc65031b340f7cf55f7f1556fa1cf93`.
The original remains preserved separately for delivery; compact complete-cycle
clips and the independent every-frame review are pending. No visual acceptance
is claimed here.

Run 20:27:46.788–20:28:44.206 UTC. Real keyboard approach/retreat and touch attacks,
with actual opponent defeat and two collected local coins. Zero JavaScript errors.
No game state or speed injection. A read-only elapsed-time overlay aligns the
recorded image to [bone/vertex telemetry](motion2-telemetry.json).

The video is 390×844, 58.6 seconds, encoded at 25 fps. It does **not** demonstrate
25 rendered fps: 200 read-only samples over 51.45 seconds had a median gap of
0.2327 seconds. Software WebGL plus recording/measurement overhead caused sparse
updates/repeated encoded frames. This limits smoothness and short-event judgment;
it is not phone-performance evidence. Telemetry targeted a minimum 45ms gap but
was constrained by the actual browser animation-frame cadence.

Measured local changes: belly scale 1.00–1.10; front-fin X 0 to −0.126 radians;
tail Y −0.369 to +0.387; body flinch X down to −0.046; death body scaleY 0.60,
roll 0.35 and height 0.69. All head local transforms stayed constant throughout.
Fourteen actual weighted vertex probes moved. Maximum probe displacement within
selected telemetry windows: pursuit 0.387m, attack 0.151m, idle 0.041m, hit 0.051m,
death 0.476m. These establish deformation, not good animation or attachment quality.

Transform-inferred phase windows use the on-screen capture clock, not encoded
video timestamps: first complete swell 13.787–16.591s; alert/idle 16.591–24.210s;
pursuit 24.210–27.565s; hits around 29.225–30.004s and 30.822–34.068s; death starts
35.785s. They are not direct AI-state telemetry. The reviewer must select and
inspect complete encoded frame ranges before assessing continuity/readability.

## Grounding and remaining risks

The separate reproducible actual-vertex grounding audit under
`art/driftwood-isle/approved-puffer/audit_v57_animation_grounding.py` samples the
frozen formulas. It reports no sampled floor penetration, with tightest combined
transition clearance 1.158mm. This is sampled numerical evidence, not a continuous
proof. Maximum fin-root motion about 4.39cm still needs visual attachment review.

The current short diagonal lift may still slide; the small swell may remain too
subtle at close frontal framing; tails and feet may be occluded by the body or
controls. Full-cycle independent frame review is required. Actual arena toon,
AgX and grade remain under fixed empty-look lighting without a LUT; no full Noon,
all-angle rig certification, human-fun or production acceptance claim follows.

## Improved first-person visible-body recording

A second exclusive-lane capture used a real 30px downward LOOK touch drag and
short W/S taps to keep about 2.1m standoff. Both front feet/body are visible above
the controls. After actual attacks killed the enemy, the player retreated using S
and recorded ten seconds of corpse settling. No diagnostic camera or actor-state
injection was used. Source/build stayed exactly motion2.

Raw `page@8f962476bf502c3178b5bb21ba6f2788.webm`: 59.2 seconds, 25fps encoded,
390×844; run 20:34:57.509–20:35:55.454 UTC. The separate
[motion2-visible-telemetry.json](motion2-visible-telemetry.json) records 226 samples
from the existing `arena.activeTargets` actor API: authoritative HP/alive/state,
AI stage/clock, speed/flinch/deathT, and full root/bone world matrices. It has no
weighted-vertex probes. Stage memory remains 2 after death, so alive/deathT identify
death rather than assuming a stage5 event.

Actual first attack stage1 starts at overlay15.693s and stage2 at20.794s. Death
is HP0/alivefalse at40.930s. A 2.1 simulation-second strike therefore took about
5.1 wall seconds in this capture. The low rendering cadence produces simulation
slowdown consistent with frame-delta clamping; no time-scale setting was changed.
Encoded25fps is not real-time25Hz animation. Independent every-frame review must
retain this limitation.

Root worldY peaks900.7068 then settles899.9399. Source tracing confirms existing
`AnimalView.startRagdoll` chooses the custom rigid-ragdoll path; `ragdoll.ts`
applies an upward throw (1.3 × clamped2–2.5m/s) and spin on a killing hit. Custom
bone death animation continues while physics controls the mesh root. The local
vertex grounding audit excludes this moving root and cannot prove corpse-floor
contact. Final appearance still requires the video review.

Cadence comparison: first probe run median sampled rAF gap0.2327s; an overlapping
hook/video-only run0.2412s is confounded and excluded from causal claims. A clean
exclusive-lane no-probe standoff run measured0.22375s (~4.45Hz mean), and the improved
visible-body run0.2233s. Removing weighted probes did not materially improve this
capture. Rendering/recording appears dominant, but GPU versus encoder cost was not
separately profiled. Production render scale and simulation settings were unchanged.
