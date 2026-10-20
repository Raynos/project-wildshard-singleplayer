# Independent native handoff repair review

2026-10-20. Re-review of the three concrete findings preserved in
`INDEPENDENT-NATIVE-HANDOFF-WIP-REVIEW.md`. Read-only source/test/log inspection;
this review is the only authored file. No production edits, Git operations,
heavy checks, app build, tuning or selected-geometry work.

## Verdict

**The three reviewed must-fixes are resolved in these frozen bytes.** Accept the
repair checkpoint as default-off owner-integration engineering, not completion
of the whole proposal or admission of a selected creature/public Arena option.
No additional must-fix found within this repair slice.

1. **Frozen endpoint:** final publication now collapses previous/current local
   transforms, root position and physical quaternion. Frozen render reads use
   the exact current endpoint at every alpha. Physical alpha 0 and 1 copy their
   respective quaternion tuples directly; only interior blends use slerp. The
   new regression compares the final tuple captured before native removal with
   render alpha 0/.5/1 across later ticks, including all local joints.
2. **Post-publication fault:** any exception after capture begins now calls
   terminal owner failure. Live and final-freeze publication faults cannot leave
   a healthy owner with pending locals or an unpublished terminal endpoint.
   Tests assert closed ownership, no future ticks and cleanup. An actual-actor
   regression additionally forces persistent native removal failure: the exact
   body remains counted, overbooking is refused and explicit disposal succeeds
   after the fault clears, even though the original scope is already closed.
3. **Invalid native contacts:** corpse-bound prepared-hit entry checks amount,
   point, direction and prospective numeric scalars before evaluation or native
   allocation. NaN/Infinity tests cover nominal nonlethal/lethal requests, exact
   actor/pose/event snapshots, same motor state, retained reservation and a later
   valid killing hit. Validation is confined to this opt-in, preserving existing
   default-off behavior.

## Evidence checked

I inspected the saved negative-test log: **15 failed / 11 passed** before the
repairs. I also inspected the expanded repair log (**208/208 in 13 files**) and
the final actor/corpse/demo log (**42/42 in three files**, 29.44 seconds).
The expanded run preceded the final type-narrowing/test-style adjustments; the
final actor run covers the declared final bytes. These were writer-executed
runs whose logs I checked, not independently rerun tests.

Writer reports final strict TypeScript and isolated type-aware lint success;
the corresponding final logs contain no diagnostics. Earlier concrete lint
errors were repaired without suppressions. Root's actual checkpoint hooks remain
separate evidence. Per coordination instructions I started no competing heavy
process while the selected-motion lane owns checking resources.

## Frozen SHA256s verified

- `src/engine/entities/nativeCorpseOwner.ts`:
  `03fdba68e6912e3f0b22531818c8008603ffe4e20074b1f49d6f0f4a0889767c`
- `src/game/plugin/animation.ts`:
  `52e241e092e28e76bd4990109b9fcd6676367de8a3ae7866c761259333088d2e`
- `test/practice-native-corpse.test.ts`:
  `a484d73f8c256171722f34cc0eb1787ffc4048983ef78416e4ce61901b0f9426`
- `docs/reviews/conch-authoritative-motion-contract/NATIVE-HANDOFF-MILESTONE.md`:
  `63a71f70fddc05e130911454fc218d449caffe21098e53a1c256b322cf68147b`

## Remaining gates

The milestone honestly retains unfinished diagnostics and tests: bounded physical
quaternion/resource/tick diagnostic capture, full-cap actor admission refusal,
terminal activation/motor-retirement paths, deeper cadence/quaternion-sign and
phase-fault coverage, Retry during collapse/reselection/live exit, disposed-world
cleanup and physical-opt-in player defeat. The prior review's callback-fault
before post-publication case remains part of phase-fault coverage, not proved by
the direct publication-fault injection.

Synthetic hulls prove ownership only. Selected weighted-surface representability,
complete authored motion, contact/readability and any private build/capture or
public admission remain independent later gates. Physical pose-only historical
restore stays refused; these repairs add no rewind authority.
