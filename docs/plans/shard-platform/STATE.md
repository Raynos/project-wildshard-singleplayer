# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order:** live reds + the P0 phone entry → Nalati COMPONENT BY COMPONENT (G613: lock each in its last cut; C4 + C9
last) → CI speed (G609) → the rest. G612 D5: land on types/lint/focused tests only. D3: 5-min waits fail, no retry.

**Census (official 6c80f62227, sp-x1):** every shard 0 except Nalati and open plots (20 local, unclassified).
Nalati C4 1,118 (arenaScript 483, eliteEncounters 213, pageGroups 134, elitePage 122, balbal 59), C6 8, C9 826
(state 145, nativeManager 109, binding 96+29, groupRuntime 92, index 80, shared manifest 74). Its C1 47 / C2 186 /
C8 156 "regrowth" is a census-harness error (ruler slot lost Nine/Pine/DW generated discovery, so shared exports
looked Nalati-only); sp-x1 corrects the count + adds a missing-discovery refusal. Locks stand.

**Routes:** C6 + balbal -> sp-x9 H4 actor binding (502d55f73b shared ABI2 module, 8 scripts). C4: Titan -> sp-x6
life/tell snapshot + sp-o4 view (~-11); elites: two routes measured net-0, no honest cut yet; L5 pack/herd sims ->
sp-o4 pure AS module, needs a group step from sp-x9. C9: taming -> sp-x8 (AS on v2 world actions; G415 tolerance).

**Grid-ready:** DW + PINE (b9d191e259) + NINE latched (G598 done). Cold first crossing ~200-267 ms at 4x is mostly
GC/native (e0d24f014b allocation cuts; harness now samples grid.current()). Nine->Nalati 283 ms frame: sp-o5 GC trace.

**P0 (Jake's phone):** live ab93dccfe0 pinned (sp-x7). Floor 0ea6fb46f0 (fixes: f7b3e4b66d quest bind, a672369245
King rules, f112d6c62f + 0ea6fb46f0 tests, 8c5189879b tuple); release on CI + exact smoke. Chromium 4x region start
~13.0 s tap->play (shaders after play, home warm-up first-frame only, CSM chunking a128352530). ROAD START
70e0bbd4bd + 53b57e917b (Debug row 'Start of play', default region): tap->play 5.0 s; tap->inside home 21.5 s vs
13.0 s, as the home builds at in-play budget; sp-o1 raising that one build's budget. Node-build reuse 92bba7c1ba
(sp-o3, default-off, on/off reading next).

**Lanes (5 Opus at Claude weekly 35 %; 5 Codex + sp-x7):** sp-x2 CI speed (16 behaviour partitions 4341449733,
model max 146 s; f84 wall 16m17); sp-o2 themed ground (Night Market holes fixed 401a2821ea).

**For wildshard-v (Jake pick):** start new players on the ROAD (play in ~5 s, home ready later) instead of in the
home region (~13 s)? sp-o1's final numbers come with the faster home build; yes/no. The audio question is dropped
(no gain measured).

**Hazard:** 40+ stale working copies; land only own hunks from HEAD. Mirror slots clear generated outputs (c007).

**Rules:** G605 Opus steps (50 % 3, 70 % 2, 80 % 1, 90 % 0). G492; never herdr wildshard-v; no net-0 moves (G571).
