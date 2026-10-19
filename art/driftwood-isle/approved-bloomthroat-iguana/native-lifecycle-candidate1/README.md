# Bloomthroat Iguana native lifecycle candidate 1

Frozen rejected WIP, 2026-10-19. **No playable admission or quality acceptance.**
Selected source is unchanged complete-character-next (independent preference
3.0025 versus earlier fresh-v3 2.625). This pass advances complete editable
combat/AI/product source and measures a real native physical death blocker.
It does not claim a complete in-game lifecycle, damage/reward or phone proof.

## Complete source candidate

- `bloomthroatIguanaCombat.ts`: one isolated 65 HP grounded stalker, .7 speed,
  one cover-checked 1.9 m arc bite, 12 damage, .75 s windup / .16 s active /
  .9 s recovery, three bout-local coins. These are new unaccepted authored
  values, not a rebalance of another enemy.
- `bloomthroat-iguana.as`: actual bounded one-page AssemblyScript guest,
  approach, bite, cooldown, stun response, denied-strike recovery, death and
  stop. Compiled through existing SDK/DecisionHost in focused tests.
- `bloomthroatIguanaNativeClips.ts`: numeric authored transforms on existing
  27-bone rig. Reads current strike phase/local elapsed through the existing
  strict `strikeIds` facility; never changes a gameplay clock, root or scale.
  Tell/bite/recovery align exactly with the authored strike durations. Earlier
  source-only iguanaClips and its model remain untouched.
- `bloomthroatIguanaNativePreview.ts`: normal isolated shard-file product
  author, one actor/decision/pose, existing materials and arms, no island
  placement, quest, ledger or save writes. No shared host/UI was modified.
- `scripts/bloomthroat-iguana-native-admission.mjs`: exact source pins plus
  explicit fail-closed admission. Build script cannot publish an app by
  treating source integrity as collider acceptance. No product/app was built.

## Native death results and harness correction

First run accidentally supplied RigidCorpsePose without a rigidCorpse recipe.
The actual Ragdolls constructor ignores that argument on the default path.
Therefore those results are **frozen lethal local pose controls**, not a full
animated-death result. Exact initial test and summary are retained under
`rejected-harness/`; original raw rows remain in the fresh ignored task output.
Their four fixed minima were -1.461440, -1.183095, -1.045172 and -1.568280 m.
The original summary's method/acceptance labels must be read with this
correction; it cannot support a default animated-death claim.

One corrected pass follows AnimalView.updateRagdoll's near-custom path:

1. The actor root starts at ground origin with unit scale and no lift. Source
   absolute +Y-up/+Z-forward binds are converted once into parent-local bones.
   Body bind stays (0,.78,-.2). Four-influence skin is evaluated in world space.
2. No rigidCorpse recipe or RigidCorpsePose is supplied. Existing rigid default
   allocates one root body with box half-extents (.55,.39,.64), collider centre
   (0,.468,0). Ground plane top is exactly Y=0. Scale is applied once.
3. For 480 steps per trial: unchanged fixedPre, Physics.step, fixedPost;
   render-owned custom death advances by dt/.8, capped at1, at dt=1/60;
   attack becomes -1, speed/strafe zero, flinch decays exp(-dt*5.5). Existing
   source numeric animation runs, then default r.pose(dt) owns root physics.
   Endpoint alpha1 and alpha.5 share the same rendered local joint pose.
4. Stop/freeze is owned by existing Ragdolls; no forced freeze, collider
   enlargement, mass/solver/impulse changes or contact patches. Damage20 and
   four horizontal directions are controlled test inputs, not game events.

Corrected fixed minima: **-1.451638, -1.129256, -1.045700, -1.588590 m**.
Interpolated minima: -1.451791, -1.128911, -1.045187, -1.586576 m.
All four fail the5 mm flat-floor gate and end frozen. The box does not cover
this long-tailed upright-chested animal when it tumbles. This is a genuine
native physics measurement, not an app/gameplay capture.

`skin-parity.test.ts` independently checks the manual contact transform
against actual packed-loader geometry and THREE SkinnedMesh.applyBoneTransform
under translated/rotated roots at three death poses, tolerance1e-6.
Remaining harness limits: near actor, fixed/render both60Hz, flat floor,
zero initial translation velocity, one scale, no terrain/obstacles and no
real weapon event. Corpse fade is excluded so contact is measured before
presentation sinking. New live strike choreography was not exercised through
an admitted actor; the death test deliberately uses the preserved source
clips, whose death transforms match the new candidate.

## Living-hit coverage, distinct from corpse support

`measure-live.py` resolves component order and actual rest capsule/head union:
108/492 continuous trunk/chest corners miss the body capsule;54 also miss the
head sphere. Four more dorsal corners miss both. Thus the prior2,688 per-state
count (112 repeated24 times) is not solely decorative. No failure is waived.
A rest-only complementary body radius would be .6983552105 for the trunk,
versus retained .623, using the same center/half-length and existing head.
This is a possible **source-derived proposal only**, not an applied fit or
proof across animated head/neck poses. Merely enclosing all body corners in
one capsule would require .8947066558 and cross below ground. New geometry,
source-derived support or authored pose changes require a separate complete
contact design; do not enlarge the box or lift the root around this failure.

## Verification and reproduction

Passed: two Node source-integrity/fail-closed tests; three focused source tests
including actual AS compilation/DecisionHost scenarios and isolated author;
one actual numeric DAG phase-boundary/dead-stability test; one packed THREE
skin parity test; one completed four-trial physics measurement. A successful
measurement test is not a passing contact gate. Source lint passes on the
three new shard generator files. Initial scenario failures were test setup:
scenario strike state was not explicitly denied, and a restarted nearby target
immediately attacked. Logs are retained; corrected tests keep those cases
explicit. No full typecheck, full suite, app build or browser was run.

Run installed Vitest with this folder's explicit test names and vitest.config.ts;
run `node --test scripts/bloomthroat-iguana-native-admission.test.mjs`.
Raw rows/logs live under the fresh ignored `tmp/iguana-native-lifecycle-candidate1`.
Only concise summaries, editable sources and hashes belong in publication.
All original source, references and failed evidence remain preserved.
