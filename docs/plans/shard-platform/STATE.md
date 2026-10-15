# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W2 at 21:20Z `b5531c4b4`: Pine 70.67 %, Driftwood 65.02 % custom** (target ≤ 20 %; 20:25Z 71.28 / 67.16; start 107.6 / 104.2). 0 unknown. W1: Sky 9.58, Signal 9.73.
Pine/DW: C1 4051/4268 · C2 1380/1731 · C3 162/0 · C4 3666/2114 · C5 2091/1327 · C6 2722/1107 · C7 12/0 · C8 355/185 · C9 558/430.
Pace last hour: Pine only −0.6 pt, DW −2.1 pt.
Since 20:25Z: DW ground bake `1c125707c` (−101), captain `21bda4169` (−92), reef `ce82ece65` (−71); Pine held looks `d910a6659` (−70), sights `b1ba58d41` (−38), loadout `2e2a8813e` (−21); engine UBO race `7b6d50836`, irradiance `d24ef264c`, graph cliff `a417444bc`.

**Lanes (G432 5 Opus while Claude < 50 %; Codex 5 + pusher; slots G435):**
- Opus: o231 DW cover/island/sway kit (landing, G436); o236 Pine painted bake (landed); o237 ref sweep + timbers/creatures (dev)/castaway, then Sky shaderEdits; o238 Pine viewmodel looks.
- Codex (G440 one task per turn, hourly check-ins): x1 next C6 adoption; x4 ambientLife adoption; x5 next Pine C5 (size survey); x6 DW quest.ts → QuestHost; x7 push, maps, refs; x8 UBO race B, then weak-cache, then the graph CPU list.
- Slots: check = x1 x5 o231 o236 · check2 = x4 x7 o238 · check3 = x6 x8 o237 measure.

**End-of-plan lists:** memory (G433/G434): Pine cabin props (+1.47 MB GPU), DW piers (+6.58 MB), map correction `bf2f3fcb2`, weak image cache. Perf (G436/G437): graph per-draw CPU (first cut `8b0436fdd`, cove -51 %; rest queued to sp-x8 per the planner's explainer), DW cover/kit graph cost.
**G439 refs:** DONE. Zero refs under refs/parked, refs/sp-lanes, refs/wip; `main` is the only local branch (audit `c3b1296be`). Last held ports landed: DW cover `ce9b2d31c`, cove `98753efbc`, sway kit + rocks `dd994628e`, creatures for everyone (sp-o237).
**New platform features (G438):** QuestViews.panelHold `b5cd694da`; swept melee phases `b02ecca67`; SDK dayClock/daySky + SkyEnvironment `4e2ea6e2c`; HeldPlayback.bindOutputs `b1ba58d41`; ModelLibrary channel aliases `89f056cc9`; shared runtime equipment/loadout (x5, landing); environmentIrradianceAt (x8, building).

**Waves:** W2 → W3 (Nalati + Nine) starts by itself at Pine and DW ≤ 20 % + G420 (G434). In force: G415–G435.

**For wildshard-v, DECISION for Jake:** Pine's honest cuts are drying up. What's left (C1 4.1k mostly bake readers, C4 3.7k, C6 2.7k, C5 2.1k) is native ownership that W1 hosts can't carry. Each needs a new host whose only user is Pine, so G294 counts it back to Pine (sp-x5's roster measured +10; King encounter, forager and loadout the same). Options: (A) credit a new platform host as shared when a named W3 shard (Nalati/Nine) has the matching code, and its port row moves that code onto the host within W3 (credit reverted if not); (B) close W2 at the honest floor (likely Pine ~55-60 %, DW ~45 %) and start W3 now; (C) keep going as is (~0.6 pt/h Pine). Recommend (A).
Paused rows: SF22, SF57, SF67.
