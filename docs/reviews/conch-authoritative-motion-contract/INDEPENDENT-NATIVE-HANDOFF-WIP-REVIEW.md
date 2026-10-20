# Independent native actor handoff WIP review

2026-10-20. Read-only review of the 14 frozen actor-handoff paths below.
Only this review was authored. No Git, source/test edit, app build, tuning,
remote write or selected-geometry work. This preserves negative evidence before
repairs; later green evidence must identify its changed bytes separately.

## Verdict

**Not accepted for integration: three concrete must-fix findings.** The new
physical owner is a useful default-off WIP checkpoint, not completed admission.
The writer confirmed the first two defects and proposed repairs, not yet present
in these reviewed bytes. Existing passing tests do not cover these failures.

### 1. Frozen corpses keep interpolating their last step

`NativeCorpseOwner.post` captures/freezes and then calls `publishCorpseRoot`.
That publication preserves the old previous endpoint and writes the final current
endpoint. Subsequent post calls return immediately for `frozen`, so
`NativeCreaturePose.copyPublished` repeatedly interpolates this stale last interval
as frame alpha cycles. A moving maximum-age freeze can visibly oscillate forever;
local joints and physical root quaternion have the same stale-history problem.

Required repair: collapse previous/current local, position and physical quaternion
endpoints in the final frozen publication. Regression: force a nonzero last
interval, freeze, then render alpha 0/.5/1 over several later frames and require
one identical final pose. The existing demo test only checks alpha 1 after freeze.

### 2. Final publication failure can strand a healthy-looking frozen owner

`resource.capture` can remove the body and release capacity before
`pose.publishCorpseRoot` runs. If publication throws at that boundary, the catch
only closes owners whose resource is `failed` or `disposed`, not `frozen`.
Future pre/post calls skip the frozen resource forever: final physical root
never publishes, actor.position remains stale and prepared locals stay pending.
Live post-publication faults also leave pending locals after hulls already moved.

Required repair: define all exceptions after capture starts as terminal owner
failures, or implement an explicit safe publication retry. The writer's proposed
narrow terminal policy avoids a new rewind/retry phase. Keep recoverable detached
pre refusal distinct: it may retain old locals and publish the actual physical
root. Regress both live and final-freeze publication faults, including removal
failure/quarantine while closing the owner.

### 3. Detached native hit data is not fully validated

`AnimalSim.applyFinalDamage` copies amount, point and direction into the new
record. `NativeCorpseOwner.prepare` passes amount/direction to the resource, but
never checks point. `CombatPipeline.hit` has no upstream finite-vector validation.
A lethal hit with NaN point.x can therefore commit and enqueue an invalid contact
receipt. The native nonlethal preparation path also lacks amount validation: NaN
amount yields NaN HP because the lethal comparison is false. This includes an
inherited native-input weakness, not solely a new physical-path regression.

Required repair: native prepared-hit entry validates finite amount/point/direction
and prospective state before any evaluator, allocation, HP or history mutation.
Test lethal and nonlethal malformed values, unchanged actor/pose/clock/FIFO,
unchanged reservation and subsequent valid hit. Preserve default legacy behavior
unless a separately reviewed change intentionally broadens validation.

## Sound boundaries observed

- Activation occurs before HP and publication copy. The concrete token disables
  the exact existing motor, enables the prepared body and retires the disabled
  motor only at pre/disposal. `restoreEnabledState` forces both native/cache state.
- Admission reserves before exposing native targets. Mixed legacy contention uses
  the shared slot. Existing pre and post scheduling does not add a physics step.
- Detached next-pose law uses copy preparation rather than historical restoration.
  Physical quaternion drives FK and final view quaternion, not only diagnostic
  storage. Quiet view/query reads do not call the evaluator.
- Loot explicitly copies lethal position rather than following later corpse
  actor.position. Exit retains the native reference if cleanup throws, allowing
  an explicit retry rather than silently discarding failed cleanup ownership.

## Remaining implementation gates, not asserted new bugs

Physical snapshots still emit legacy v2 without bounded previous/current
quaternions, resource state and tick identity required by the proposal. The writer
explicitly identifies this as unfinished; pose-only restore is correctly refused.
Add the diagnostic envelope while preserving default-off v1/v2 bytes.

Still require terminal real-actor rollback/quarantine/disposal tests, full-cap
admission refusal without targets/onBegin, absent/default-off regression coverage,
fixed-clock/pose cadence comparisons at 30/60/120 Hz with quiet-read variations,
duplicate phase refusal, and interruption/Retry throughout collapse. Also exercise
faults in post callbacks before physical publication so a previously accepted
pre step cannot leave permanent pending state or physics/FK disagreement.

No independent executable test was launched for these bytes: root requested
source-only review during isolated lint/hook memory contention. Writer reports
26/26 focused actor/demo tests and strict TypeScript; these are attributed reports,
not this review's independent evidence. Type-aware lint was still pending.
Synthetic test hulls remain ownership witnesses, never selected Conch acceptance.

## Frozen source identity

```text
a0bf9ec4091c720a60954f2a8eabbe18b5966c05445d0728ae6117a8000d5828  src/engine/entities/AnimalSim.ts
e2042825e2bc80e0a486788423773c99aef795509b877c87ab9d67ebc33eb7d8  src/engine/entities/animalPose.ts
2c5cf169e8d39f527337a8433ab9a7accf51c89a209e400dc0c5c31b54b4cfd9  src/engine/entities/animalRig.ts
0ac6232ea381974d0772da5775a5b5fadda59ca5425dbd017200397b93bf0561  src/engine/entities/nativeCorpseOwner.ts
33bc129f6b6d9506c68ec07051bc51eac95e1c91926622cb58451ebb4c79ac6f  src/engine/physics/CharacterMotor.ts
e1c68412436d36399b10feb607e69ab808093b799f506ad0fb6208d639ab725f  src/engine/sim.ts
ec96c326999353148e3635c654d88d33d517db6bed75afa88111b8f9d0d9c3e1  src/engine/package.json
10e7830246a318ad1889c48b5470fd804078b3dbe61aaa69552a10586681aa8d  src/game/plugin/animation.ts
c70ed1056ff42edfc8feaec7c5c5a86d948c824161153c9159a97370c4e73e9a  src/game/practice/PracticeNativeActor.ts
9d742690dcb6a3472a3a376c19ea2f28ee72284fd9f83ed8db1cf31fd14df7dc  src/game/practice/PracticeCreature.ts
736775911996a7b2f250dc486b09669a03810b9f45df38f0604655ca428567aa  src/game/practiceDemo/startPracticeDemo.ts
851f2dbed47301c7c2cdbccb3b9eb6066bb4e1a78d68c1436893c6458cacc5ca  test/practice-native-fixture.ts
eba371e0fbf52e4f55971bfa0456cc6137767acf5b7fcb19cb928622816ba0b8  test/practice-native-corpse.test.ts
f1a1e9576eed6511df1473e372a93d4c4915bcc51759ca283de6e1ca4da21f5b  test/practice-demo-native.test.ts
```
