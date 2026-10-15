# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W2 at 22:20Z `7e9b4f31e`: Pine 68.93 %, Driftwood 61.36 % custom** (target ≤ 20 %; 21:20Z 70.67 / 65.02; start 107.6 / 104.2). 0 unknown. W1: Sky 9.58, Signal 9.73.
Pine/DW: C1 3932/4096 · C2 1314/1374 · C3 162/0 · C4 3607/2047 · C5 2034/1327 · C6 2653/1079 · C7 12/0 · C8 355/185 · C9 558/425.
Pace last hour (G441 hosts landing): Pine −1.7 pt, DW −3.7 pt.
Since 21:20Z: DW cove instancing `e3137bb6b` (−206), toon patch gone `0b64213ef` (−120), owned intake `014e16932` (−55); Pine forager `013a0c5ed` (−59), reading roster `6b37d5db7` (−57), GLB reader `b3b1bef49` (−49); shared day-sky + overcast (−63/−64). Graph CPU list done.

**Lanes (G432 5 Opus while Claude < 50 %; Codex 5 + pusher; slots G435):**
- Opus: o243 DW creature facet contrast (G442). Visual W2 targets are thin now; Codex lanes carry the G441 hosts.
- Codex (G440 one task per turn, hourly check-ins; G441 hosts): x1 projectile presentation (Nalati javelin); x4 creature host survey; x5 King presentation on the boss host (Nalati stormTitan); x6 next DW host; x7 push, maps (batch now), refs; x8 Pine C1 placement survey.
- Slots: check = x1 x5 · check2 = x4 x7 · check3 = x6 x8 o243 measure.

**End-of-plan lists:** memory (G433/G434): Pine cabin props (+1.47 MB GPU), DW piers (+6.58 MB), map correction `bf2f3fcb2`, weak image cache. Perf (G436/G437): graph per-draw CPU (first cut `8b0436fdd`, cove -51 %; rest queued to sp-x8 per the planner's explainer), DW cover/kit graph cost.
**G439 refs:** DONE. Zero refs under refs/parked, refs/sp-lanes, refs/wip; `main` is the only local branch (audit `c3b1296be`). Last held ports landed: DW cover `ce9b2d31c`, cove `98753efbc`, sway kit + rocks `dd994628e`, creatures for everyone (sp-o237).
**New platform features (G438):** QuestViews.panelHold `b5cd694da`; swept melee phases `b02ecca67`; SDK dayClock/daySky + SkyEnvironment `4e2ea6e2c`; HeldPlayback.bindOutputs `b1ba58d41`; ModelLibrary channel aliases `89f056cc9`; shared runtime equipment/loadout (x5, landing); environmentIrradianceAt (x8, building).

**Waves:** W2 → W3 (Nalati + Nine) starts by itself at Pine and DW ≤ 20 % + G420 (G434). In force: G415–G435.

**For wildshard-v:** G441 in force (W3 host table in open-x-queue.md; pending entries name the Nalati/Nine file). G442 answer: no contrast was lost. Staged identically (AI held, same yaw + camera), graph and classic creatures are near pixel-identical (bear crop mean 116.9 vs 117.9, std 68.0 vs 67.8); the earlier board compared free-running poses. Board `1e361eae1` progress/shard-platform/sp-o243-creature-facets-2026-10-15/parity-board.jpg. If Jake wants MORE facet contrast than classic had, that's a new style: a Debug A/B in data/creatureLook.ts (classic = A). Pick?
Paused rows: SF22, SF57, SF67.
