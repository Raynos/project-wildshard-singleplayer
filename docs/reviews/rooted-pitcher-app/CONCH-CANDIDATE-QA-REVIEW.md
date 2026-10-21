# Current-runtime Conch regression test review

2026-10-21. The exact four-only candidate completed smoke QA: all four exchanged genuine damage, remained fresh on Retry and shared one Game/canvas; Back/start, reload and browser persistence checks passed. This is not a complete-cycle or visual admission. Build receipt, served inventory and smoke report are retained under `test/proof/shared-arena/current-four-1553/`.

Root reviewed the separate `scripts/shared-arena/qa-conch-candidate.mjs`. It binds exact retained candidate bytes and archived build snapshot rather than pretending later test code produced the host. This candidate's Conch is the legacy PracticeCreature/AnimalView owner, not PracticeNativeActor. The test records actual clocks, borrowed strike/decision state, copied rig inputs, bone/world transforms, damage events, RAF cadence and a finalized portrait video.

Only ordinary touch attacks and explicitly logged diagnostic player placement are used. No enemy HP, state, clock, pose or forced callback writes. Bounded checks seek actual thrust/guard/counter, nonlethal and lethal interruptions, postdeath damage absence, Retry disposal/freshness, Back/shared Game and reload/store cleanup. Unobserved phases fail; frame samples are not every fixed tick. Health may regenerate after death, so nondecreasing health is paired with the independent absence of damage events rather than requiring exact equality.

Syntax, exact-host verify-only and selected type-aware lint are required before run. Root authorizes one bounded muted portrait regression after source checkpoint, with every failure retained. No public or model admission follows from the test source alone.

## First actual regression and corrected driver

The first exact-host run failed its planned counter and dedicated lethal-cohort checks. It did observe a complete thrust cycle, player damage, seven weapon hits including one kill in the guard-attempt cohort, nonlethal interruption, repeated cleanup, same Game, reload and empty stores. Its five requested guard hits arrived at active/recover with guard0, rather than proving a guard counter. The dedicated lethal loop incorrectly treated one temporary six-second phase timeout as a stopping condition; the surviving actor at36HP was not a post-death failure.

The separate `qa-conch-candidate2.mjs` retains every original. It observes an early natural guard window and sends genuine CDP touch immediately to the premeasured attack control, without another sample/save/actionability round trip. A bout-scoped pre-apply observer returns the identical unmodified damage request; queued event snapshots remain separately labelled. Temporary absent attack windows continue within a bounded deadline, and post-death checks run only after actual death. Seven timing-source files match the archived host snapshot. Root approves one exact-host rerun after syntax, selected lint and checkpoint; no runtime, clock, phase, HP or callback override is introduced.
