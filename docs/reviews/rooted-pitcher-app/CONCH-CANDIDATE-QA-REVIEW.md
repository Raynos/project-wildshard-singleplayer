# Current-runtime Conch regression test review

2026-10-21. The exact four-only candidate completed smoke QA: all four exchanged genuine damage, remained fresh on Retry and shared one Game/canvas; Back/start, reload and browser persistence checks passed. This is not a complete-cycle or visual admission. Build receipt, served inventory and smoke report are retained under `test/proof/shared-arena/current-four-1553/`.

Root reviewed the separate `scripts/shared-arena/qa-conch-candidate.mjs`. It binds exact retained candidate bytes and archived build snapshot rather than pretending later test code produced the host. This candidate's Conch is the legacy PracticeCreature/AnimalView owner, not PracticeNativeActor. The test records actual clocks, borrowed strike/decision state, copied rig inputs, bone/world transforms, damage events, RAF cadence and a finalized portrait video.

Only ordinary touch attacks and explicitly logged diagnostic player placement are used. No enemy HP, state, clock, pose or forced callback writes. Bounded checks seek actual thrust/guard/counter, nonlethal and lethal interruptions, postdeath damage absence, Retry disposal/freshness, Back/shared Game and reload/store cleanup. Unobserved phases fail; frame samples are not every fixed tick. Health may regenerate after death, so nondecreasing health is paired with the independent absence of damage events rather than requiring exact equality.

Syntax, exact-host verify-only and selected type-aware lint are required before run. Root authorizes one bounded muted portrait regression after source checkpoint, with every failure retained. No public or model admission follows from the test source alone.
