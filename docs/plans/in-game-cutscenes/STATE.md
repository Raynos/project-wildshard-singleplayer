# IN-GAME-CUTSCENES — State (coordinator: none yet; ≤ 3 KB; overwritten)

**2026-10-10.** `draft`. The plan is written ([../IN-GAME-CUTSCENES.md](../IN-GAME-CUTSCENES.md), ask E475). Nothing is
built from a draft.

**Recommendation:** hybrid, in engine first (D1). An engine camera timeline (`src/engine/cinematic/`, exposed as
`@wildshard/sdk/cutscenes` data) carries every cutscene; generated LTX-2.5 portrait video only for one or two hero
moments per shard, always with an in-engine fallback. Generic hero in generated clips, no hero on screen in engine
shots for v1; outfits out of scope (D2). Everything behind Developer; comparisons as one Debug row (D3).

**Waits on Jake:** his go, and the three picks in plan §7 (hybrid; first moments = Golden King in engine, Antler King
generated, Driftwood finale; the generic-hero rule). Ask them with the question tool when the plan starts.

**Next when it starts:** IC0 (inventory clips of the five boss intros and Driftwood's finale) → IC1 (engine timeline
core) → IC2 (port BossBrain's intro and QuestRewardBeat with no visible change). IC7 (portrait LTX test) and IC8 (the
generic hero sheet) can run beside IC1–IC4.

**Open rows:** IC0–IC13 (all).

**Coordination:** IC3 and IC11 change the SDK and the shardfile schema: SHARD-PLATFORM's coordinator owns those.
