# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W2 at 20:25Z `5e9f5387e`: Pine 71.28 %, Driftwood 67.16 % custom** (target ≤ 20 %; 19:30Z 74.72 / 69.70; start 107.6 / 104.2). 0 unknown. W1: Sky 9.71 (rose 0.13: sdk shaderEdits became Sky-only after DW/Pine left it; o237 retiring it), Signal 9.73.
Pine/DW: C1 4052/4374 · C2 1461/1934 · C3 162/0 · C4 3667/2159 · C5 2091/1337 · C6 2793/1109 · C7 12/0 · C8 356/185 · C9 532/432.
Pace last hour: Pine about −3.7 pt/h, DW about −2.7 pt/h, both above G432's ~2.4 / ~2.1.
Since 19:30Z: NPC skins `79e52a41f` (−363), shared day clock `4e2ea6e2c` (Pine −115, DW −120), swept melee on the native host `b02ecca67` (DW −120), King clips `5a7f30425` (−217), tree set `89f056cc9` (−62), Wendell head `51be29824` (−61), painted bake `abd51c2a1` (−51), perch profiles `155b2c175` (−40), quest beats/payouts `b5cd694da` `5e9f5387e` (−38), island placements `6e8b94f7e` (−25), DW kit + palms `538eef095`, bridge/fish/counter `1adb9ffea`; engine: per-draw CPU `8b0436fdd` (−51 %), builder release `34a8842ff` (creature heap −320 MiB).

**Lanes (G432 5 Opus while Claude < 50 %; Codex 5 + pusher; slots G435):**
- Opus: o231 DW cover/island/sway kit (landing, G436); o236 Pine painted bake (landed); o237 ref sweep + timbers/creatures (dev)/castaway, then Sky shaderEdits; o238 Pine viewmodel looks.
- Codex (G440 one task per turn, hourly check-ins): x1 next C6 adoption; x4 ambientLife adoption; x5 next Pine C5 (size survey); x6 DW quest.ts → QuestHost; x7 push, maps, refs; x8 UBO race B, then weak-cache, then the graph CPU list.
- Slots: check = x1 x5 o231 o236 · check2 = x4 x7 o238 · check3 = x6 x8 o237 measure.

**End-of-plan lists:** memory (G433/G434): Pine cabin props (+1.47 MB GPU), DW piers (+6.58 MB), map correction `bf2f3fcb2`, weak image cache. Perf (G436/G437): graph per-draw CPU (first cut `8b0436fdd`, cove -51 %; rest queued to sp-x8 per the planner's explainer), DW cover/kit graph cost.
**G439 refs:** DONE. Zero refs under refs/parked, refs/sp-lanes, refs/wip; `main` is the only local branch (audit `c3b1296be`). Last held ports landed: DW cover `ce9b2d31c`, cove `98753efbc`, sway kit + rocks `dd994628e`, creatures for everyone (sp-o237).
**New platform features (G438):** QuestViews.panelHold `b5cd694da`; swept melee phases `b02ecca67`; SDK dayClock/daySky + SkyEnvironment `4e2ea6e2c`; HeldPlayback.bindOutputs `b1ba58d41`; ModelLibrary channel aliases `89f056cc9`; shared runtime equipment/loadout (x5, landing); environmentIrradianceAt (x8, building).

**Waves:** W2 → W3 (Nalati + Nine) starts by itself at Pine and DW ≤ 20 % + G420 (G434). In force: G415–G435.

**For wildshard-v:** the engine's graph-material per-draw CPU cost now gates the biggest DW look ports (island, creatures, kit): sp-x8 takes it right after II. G433 `dc01e03fb` received; G435 slots in use; no memory constant touched by my lanes.
Paused rows: SF22, SF57, SF67.
