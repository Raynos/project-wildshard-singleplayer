# Puffer closed-anatomy rig1: independent attempt-2 review

2026-10-19. **Do not promote. Partial functional evidence; animation,
readability, settled physical death and the complete cycle are not accepted.**
The unchanged selected source's prior likeness reviews remain separate. No
runtime, product, build, recording, Git, fallback or publication changes were made.

## Important correction to the recorder's claim

The original movie includes genuine reload sword damage but **does not include
the claimed two rendered simulation-second outcome hold**. Its final encoded
frame 3604 (144.16 seconds) visibly labels `reload-final-outcome-hold`, `t=5.183`,
`f=28`. The telemetry continues to f41 at t=10.2272. The final checkpoint is at
t=10.2335, f41. A checkpoint is not evidence that its image reached the movie.

- First reload HP reduction: f19, simulated time 0.7836, 45→33; visible in
  encoded frame3486 (139.44 seconds), with sword slash and white hit flash.
- Final movie-labelled frame: f28, simulated time1.5941, HP33.
- Visible simulated progression after first damage: **0.8105 seconds**.
- Visible progression after damage checkpoint f20: **0.7105 seconds**.
- Telemetry-only progression f20→f41: **2.0105 seconds**, with 21 further
  frame IDs. This arithmetic is correct but does not establish a movie hold.
- Encoded time after the inspected hit frame is about4.72 seconds. Encoded
  duration, wall duration and rendered simulation time are different quantities.

The movie also does not visibly establish the second fresh Retry state before
reload: its late initial segment still displays40HP and a living-player hit,
then goes directly to reload/boot. Fresh initial f323–325 values exist in
telemetry; the explicit fresh-bout visual proof is the earlier Retry after kill.

## Inspection method and exact coverage

Read AGENTS.md, docs/process/GIT.md, the current DRIFTWOOD-ENEMIES STATE, recorder,
raw report, all initial/reload telemetry and the recorder review. Independently
rehash original movie/recorder/report, compare before/after pins and rehash all
137 current app and50 frozen product files. All match their receipts.

Decoded the original movie sequentially with ffmpeg into an in-memory RGB frame
stream. No native complete-frame PNG dump was created. Every encoded frame
0–3604 was placed, in order with its frame number, in37 JPEG overview sheets:
36 sheets of100 and one of5. Every one of these sheets was visually inspected.
Each full portrait thumbnail is78×169; overview coverage detects gross motion,
state transitions and framing, not subpixel defects or readable small HUD text.

Additionally inspected32 specifically selected full390×844 frames in eight
native-resolution four-panel sheets, using original-detail image viewing:
130,300,500,615,640,665,695,740,760,830,850,914,950,970,995,1015,
1040,1080,1100,1200,1208,1650,2155,2605,3030,3268,3315,3385,
3480,3486,3520,3604. Labels were added above, without covering source pixels.
**This is all-frame overview inspection plus32 native keyframes, not all-frame
native inspection or a real-time native playback claim.**

Movie:390×844,144.2seconds,3,605 encoded frames at25fps. These are not3,605 engine
renders. There are324 unique initial telemetry frame IDs2–325 and39 reload
IDs3–41:363 total, with no internal gaps. Lossy RGB decoding yields2,144 distinct
pixel hashes and31 adjacent exactly identical pairs; codec variation makes
pixel hashes unsuitable for counting distinct engine renders. Visually held
render output occupies many encoded frames.

Derivative evidence is in `tmp/puffer-closed-rig1-cycle-independent/`:
`overview-00.jpg`–`overview-36.jpg`, `native-00.jpg`–`native-07.jpg`,
`native-indices.json`, `decoded.json`, `verification.json`,
`pins-and-hold.json`, `world-contact.json`, and the bounded analysis scripts.
Original attempt1 failure and all original attempt2 evidence remain untouched.

## Independently verified functional results

- Five initial touch-attack actions were logged, but only four damaging HP
  boundaries occur: initial f61:45→33, f68:33→21, f75:21→9, f86:9→0.
  Do not claim five successful sword hits. Flash/recoil and final defeat text
  are visible; death begins at f86.
- Bout-local coins advance0→1 at f92 and1→2 at f93. Native encoded995 and1015
  read “Collected2 local practice coins.” Player placement for pickup was
  diagnostic, not natural locomotion proof.
- Retry after kill resets enemy0→45 and coins2→0 at f103, player100.
  Native encoded1100 reads “Fresh practice bout” and shows the living enemy.
- Player takes exactly five12-point damage changes at f116,163,211,258,304:
  100→88→76→64→52→40. Each damage HUD is visible in selected native frames.
  **Player never dies. Defeated-input blocking and Retry after actual defeat
  were not tested.** The subsequent touch attack damages the enemy45→33 at
  f319, confirming this is a living-player attack, not a defeated-input test.
- Second Retry restores enemy45/player100/coins0 at f323; telemetry supports
  fresh values, not preceding defeat. Reload independently starts fresh and
  then produces genuine45→33 damage at reload f19.
- All363 clock rows are live/unpaused, scale1, captureFps=null. Full scalar
  poseInputs, actor/controller state, local bone transforms and world matrices
  exist. Eight initial rows are stationary/alive/stage0;46 have positive flinch.
  Stages0/1/2 and dead stage5 occur. Phase titles alone are not assertions:
  the intended early “windup-attack-recovery” rows remain stage0.
- All ten checkpoint browser/world stores are identically empty; no page or
  HTTP errors are reported. Renderer records DPR2,780×1688 canvas, three enabled
  passes, one shadow cascade, no AO and authored-pose root flinch. These are
  configuration facts, not visual-quality scores or phone-performance evidence.
- Median frameRafTime deltas independently calculated:366.7ms initial/350.0ms
  reload. The recorder's367.9/343.2ms uses sample-arrival times instead. Neither
  cadence is physical-phone performance or evidence of smooth phone animation.

## Actual world-contact reconstruction

Reconstructed all10,458 runtime skinned vertex positions for every one of363
recorded rows using the recorded skin indices/weights, bind matrix and eight
bone inverse/world matrices. For attached binding the meshWorld and inverse
meshWorld cancel, leaving weighted boneWorld×boneInverse×bindPosition. This is
recorded-pose world geometry, not a new runtime simulation or collider test.
The arena slab top is y900. Vertices, not just actor/root origins, were checked.

- Living346 rows: minimum floor gap0.004000m, maximum minimum-vertex gap0.084739m.
- Dead17 rows: minimum gap0.024315m, peak gap0.496398m at f96.
- No sampled vertex penetrates the floor in either set, including a1mm tolerance.
- Death begins at f86/time7.9959 and ends at f102/time9.5458 before Retry:
  only1.5499 rendered simulation seconds. At the last dead row the lowest
  vertex is still0.346677m above the floor and descending.

The movie visibly rolls/lifts the body after the kill, but the close camera and
HUD obscure much of its underside. The creature has **not settled** in this
record. No claim of final grounded corpse contact, collision fit, absence of
between-sample penetration, or normal navigational collision is justified.
The living4mm clearance supports sampled floor safety, not proof of planted gait.

## Visual findings and separate scores

Scores are scoped to this actual recorded presentation, out of5. They do not
replace the selected model's reference-likeness review or round toward acceptance.
No policy/configuration check contributes to these aesthetic scores.

- **In-game visual presentation:3.5/5.** Strong readable teal/cream/orange identity,
  clear angry eyes and clean chunky spikes at medium distance. Broad faceted
  belly and paddle/toe fins remain legible. The diagnostic encounter distance
  makes the head occupy the lower half and clips appendages; the fixed-looking
  open mouth and limited angle coverage do not establish complete likeness.
- **Animation:2.5/5.** Approach visibly advances and mild fin/body motion exists;
  sword recoil tilts the head/body and recovers. However the long stationary
  attack segment reads close to the same held face, with weak whole-body
  anticipation/recovery. Sparse cloud delivery prevents judging smoothness.
- **Combat readability/tells:2/5.** Sword impact has unmistakable flash/sparks
  and hit marker. Enemy attacks are read chiefly through the player's red
  vignette/HP loss; close framing hides its lower pose and any floor-area cue.
  Controller stage changes do not establish a strong readable attack tell.
- **Death/contact presentation:2.5/5.** Genuine kill produces a clear lift/roll
  and defeated status. The movie ends this bout during airborne motion and
  approaches the corpse so closely that framing becomes obstructed. A settled
  final body/contact result is missing despite safe sampled vertex clearances.
- **Functional cycle coverage:3/5.** Genuine kill, coins, first Retry, damage
  received, reload and new damage are supported. Actual player defeat,
  defeated-input rejection, post-defeat Retry and a two-simulation-second
  visible final outcome are not. This score is coverage only, not visual quality.

Recommendation: retain the isolated unaccepted candidate and current public
fallbacks. The next evidence must show actual player defeat and its subsequent
input/Retry behavior; hold the recorded movie until its final labelled frame
proves the full required rendered interval; retain a readable whole-body/contact
view through enemy tells and a fully settled corpse. This review authorizes no
new recording or product edits.

## Identity pins

Original movie SHA-256:
`3d9484261f1fa40773f0fc68de2d90eac5dcbcf7ae96a7f2548ddb5d507fed49`

Recorder SHA-256:
`859aa2633d89d03c557d7242f6827c4769b4cc46743b7606db68a97cf099d993`

Raw report SHA-256:
`87df17969e46531adb5ac8c528a84e174796cfc53df297cfb8d3506bc7670143`

Frozen product sourceHash:
`99a69f9d3fc61912beaf08db8e7d67456756773976bb9a199dbd033910d610ed`
