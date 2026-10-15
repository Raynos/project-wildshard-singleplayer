# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W2 at 22:20Z `7e9b4f31e`: Pine 68.93 %, Driftwood 61.36 % custom** (target ≤ 20 %; 21:20Z 70.67 / 65.02; start 107.6 / 104.2). 0 unknown. W1: Sky 9.58, Signal 9.73.
Pine/DW: C1 3932/4096 · C2 1314/1374 · C3 162/0 · C4 3607/2047 · C5 2034/1327 · C6 2653/1079 · C7 12/0 · C8 355/185 · C9 558/425.
Pace last hour (G441 hosts landing): Pine −1.7 pt, DW −3.7 pt.
Since 21:20Z: DW cove on engine instancing `e3137bb6b` (−206), toon patch retired `0b64213ef` (−120), owned intake `014e16932` (−55, Nine), library models pier/wreck/shrine/boat/hut/lookout (−52), creature intake `ecf05bc8e` (−41, Nalati), species context `7e9b4f31e` (−36), zipline `109778a4f` (−31), sea `2688880d4` (−24); Pine reading roster `6b37d5db7` (−57, Nalati), forager `013a0c5ed` (−59, Nalati), GLB reader `b3b1bef49` (−49, Nalati), weapon display `06ba8d736` (−46), crag cull `4aef5f011` (−40), lever `a7ab09c6b` (−31); both: shared day-sky + overcast `0418b7d11` `d29e42b54` (−63 / −64). Graph CPU list (G437) done.

**Lanes (G432 5 Opus while Claude < 50 %; Codex 5 + pusher; slots G435):**
- Opus: o243 DW creature facet contrast (G442). Visual W2 targets are thin now; Codex lanes carry the G441 hosts.
- Codex (G440 one task per turn, hourly check-ins; G441 hosts): x1 projectile presentation (Nalati javelin); x4 creature host survey; x5 King presentation on the boss host (Nalati stormTitan); x6 next DW host; x7 push, maps (batch now), refs; x8 Pine C1 placement survey.
- Slots: check = x1 x5 · check2 = x4 x7 · check3 = x6 x8 o243 measure.

**End-of-plan lists:** memory (G433/G434): Pine cabin props (+1.47 MB GPU), DW piers (+6.58 MB), map correction `bf2f3fcb2`, weak image cache. Perf (G436/G437): graph per-draw CPU (first cut `8b0436fdd`, cove -51 %; rest queued to sp-x8 per the planner's explainer), DW cover/kit graph cost.
**G439 refs:** DONE. Zero refs under refs/parked, refs/sp-lanes, refs/wip; `main` is the only local branch (audit `c3b1296be`). Last held ports landed: DW cover `ce9b2d31c`, cove `98753efbc`, sway kit + rocks `dd994628e`, creatures for everyone (sp-o237).
**New platform features (G438):** QuestViews.panelHold `b5cd694da`; swept melee phases `b02ecca67`; SDK dayClock/daySky + SkyEnvironment `4e2ea6e2c`; HeldPlayback.bindOutputs `b1ba58d41`; ModelLibrary channel aliases `89f056cc9`; shared runtime equipment/loadout (x5, landing); environmentIrradianceAt (x8, building).

**Waves:** W2 → W3 (Nalati + Nine) starts by itself at Pine and DW ≤ 20 % + G420 (G434). In force: G415–G435.

**For wildshard-v:** G441 in force (W3 host table in open-x-queue.md; pending entries name the Nalati/Nine file). G442: Opus sp-o243 restoring creature facet contrast; board to you when it lands.
Paused rows: SF22, SF57, SF67.
