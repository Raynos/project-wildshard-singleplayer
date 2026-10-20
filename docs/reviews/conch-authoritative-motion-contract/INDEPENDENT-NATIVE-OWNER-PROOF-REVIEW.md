# Independent native owner-proof review

Date: 2026-10-20. Scope: default-off single-root native ownership only.

## Verdict

No remaining concrete must-fix found in this bounded source slice after the
placement repair below. This is not selected Conch geometry, authored motion,
contact, animation-quality, browser or public/shared Arena admission. The
canonical synthetic fixture proves ownership mechanics, not selected content.

## Findings and resolved defects

- **Placement was not failure-atomic.** Native placement changed actor position,
  and bound-view placement changed actor/mesh position, before the physical pose
  refused its reset. Both supported entry points now check readonly placement
  permission before any write. Live and frozen tests compare exact actor, body,
  pose and view state after refusal. This adds no physical teleport capability.
- The cap test fills the real shared legacy/native capacity and checks precise
  admission refusal, target/resource/controller census and cleanup. It now
  instruments the actual optional onBegin callback through the demo factory,
  rather than inferring no callback from unchanged status. Releasing one slot
  permits a fresh valid entry. Post-reservation construction failure rolls back.
- The initially vacuous snapshot assertion called a nonexistent API. It now
  calls actual snapshotSimHost and requires the borrowed-world refusal reason.
  Terminal-fault tests now require AggregateError plus the exact injected nested
  causes and relevant spies, rather than accepting any exception.

## Source and assertion audit

- Version 3 observations are restricted to corpse-bound poses; older unbound
  envelopes remain. Diagnostics expose bounded quaternion/resource/tick state
  without advancing physics, animation or ownership. Restore stays refused.
- Persistent removal faults retain the exact surviving body and its capacity;
  closed scope cleanup remains retryable. Tests distinguish before/after-effect
  removal and controller failures, and activation failure before adoption.
- Real demo collapse Retry, reselection, exit and player defeat paths exercise
  ownership cleanup and fresh state. No fabricated death callback or synthetic
  event publication was used to satisfy these lifecycle assertions.
- Cadence compares three paired deliveries: 30Hz/0 reads, 60Hz/1 read and
  120Hz/100 reads. These are not nine Cartesian combinations. The first 120
  owning fixed endpoints match; boundary catch-up may deliver an extra tick.
- Duplicate/mismatched tick refusals use specific reasons. A between-pre/physics
  lethal hit preserves event elapsed zero while publishing the moved body.
  Antipodal physical quaternion tests require exact endpoint tuples and a
  shortest-arc interior. No solver, timing, contact threshold or hull tuning.

## Evidence boundary

Independently inspected source and assertions; verified all nine frozen hashes.
Inspected writer's 13-file regression log: **224/224 passed**. That execution
preceded only the test's explicit Bone instanceof type-narrowing correction.
Writer reported strict TypeScript passing before that final test-only change;
writer subsequently reported final isolated type-aware lint EXIT0 on the exact
frozen eight TypeScript paths, with an empty diagnostic log.
No independent executable rerun, app build or renderer inspection was performed
for this slice. Final exact-byte checks/checkpoint remain root-owned gates.
Earlier review repairs (frozen endpoints, terminal post-publication failure and
finite native hit validation) remain prerequisites, not newly inferred results.

## Frozen source manifest

```text
5b57865f6360640cf70cd401945fa183901354089eac0b237b8c7f9dab814ffd  src/engine/entities/nativeCorpseOwner.ts
992297716eb5c835002b1fc76e43766aaebdb6dba271699dc2432ce1ebc0d15a  src/engine/entities/animalRig.ts
41ca8067d6d07fabc46db3d0bfcb8471799eab77546cab7c91522ff0021df4c3  src/engine/entities/AnimalView.ts
9547b0d2ab5b39eb5efe6a759b12ddfdc308e29519e92d8ecbc51b7f703cf2e5  src/engine/physics/ragdoll.ts
df01e6b8f11475d8d1ceef998678f5285d983017ba56d4624ebb0f0d4d714349  src/game/plugin/animation.ts
00771ac48e743ee8d8b5448b493559e141e5b7cdc1b6a8e87ccd9351160d958e  src/game/practice/PracticeNativeActor.ts
e7cc47878f37645c3837d7a0723822b5690bac46a92a05bd18a786f063dff448  test/practice-native-corpse.test.ts
4f372b0397c6fa9b0f98d2e8454063c411d76a58da5013cb882e60cec3340c0e  test/practice-demo-native.test.ts
1afe5e099ab880a84dd600d6a062e8e4cb17003a71d96a0fc3ec1d42c82a543c  docs/reviews/conch-authoritative-motion-contract/NATIVE-HANDOFF-MILESTONE.md
```
