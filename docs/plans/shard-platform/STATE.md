# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W2 at 00:10Z `580ce7ea4`: Pine 67.04 %, Driftwood 58.68 % custom** (target ≤ 20 %; 23:10Z 67.85 / 59.77; start 107.6 / 104.2). 0 unknown. W1: Sky 9.58, Signal 9.73.
Pine/DW: C1 3880/3979 · C2 1268/1365 · C3 162/0 · C4 3559/1820 · C5 1977/1280 · C6 2487/1040 · C7 12/0 · C8 354/176 · C9 526/414.
Pace last hour: Pine −0.8 pt, DW −1.1 pt. Most blocks left are 10-60 lines, so at this pace W2 runs well past the G432 24 h. Bigger approved slices are in flight: DW creature brain host (x6, ~−50), Pine deck floors (x8), DW effect grants (x4).
Since 23:10Z: Pine weapon view `561dab1d3` (−13), place sets `200092790` (−11), timber intake `fd7c3330b`; DW NPC pose clips `580ce7ea4` (−13), packed bodies `c61fbc4df` (−30), dead cue map `c65546e4a`.

**Lanes (G432 Opus ladder; Codex 5 + pusher; slots G435):**
- Opus 5 of 5 (G432; Claude weekly 20 %): o244 DW looks; o245 Pine looks (sky, rain, cover, weather); o246 Pine C1 props/world (bakedBuilding, caveInterior, landmarks, crags); o247 Pine rigs + King (limbRig, antlerKing, kingRig, npcRig); o248 DW C1 world/models (BlenderIsland, build, ropeBridge, GroundCover, lowpolyKit).
- Codex (G440 one task per turn, hourly check-ins; G441 hosts): x1 next Pine C6 weapon block; x4 DW effect grants (Nalati skin locker); x5 next DW C5 block; x6 DW C4 creature brain (Nalati balbal); x7 push, maps (batch ~01:00Z), refs; x8 Pine deck floors on floorAtRects (Nine floorRows).
- Slots: check = x1 x5 · check2 = x4 x7 · check3 = x6 x8 measure.

**End-of-plan lists:** memory (G433/G434): Pine cabin props (+1.47 MB GPU), DW piers (+6.58 MB), map correction `bf2f3fcb2`, weak image cache. Perf (G436/G437): graph per-draw CPU (first cut `8b0436fdd`, cove −51 %; G437 items done), DW cover/kit graph cost.
**G439 refs:** DONE. Zero parked refs; `main` is the only local branch (audit `c3b1296be`).
**New platform features (G438):** QuestViews.panelHold `b5cd694da`; swept melee phases `b02ecca67`; SDK dayClock/daySky + SkyEnvironment `4e2ea6e2c`; HeldPlayback.bindOutputs `b1ba58d41`; ModelLibrary channel aliases `89f056cc9`; environmentIrradianceAt `d24ef264c`; coming: memory-action brain (x6), selectEffectGrants (x4), floorAtRects deck rows (x8).

**Waves:** W2 → W3 (Nalati + Nine) starts by itself at Pine and DW ≤ 20 % + G420 (G434). In force: G415–G442.

**For wildshard-v:** G441 in force (W3 host table in open-x-queue.md). G442 closed by Jake (no Debug A/B; nothing to build). Pace: ~600 lines/h vs ~935 needed; all 5 Opus slots filled (o244-o248) on the biggest look/world/rig blocks; ambientLife.ts (Pine C4 625) has no honest G441 match (Nalati only shares the credited circling role).
Paused rows: SF22, SF57, SF67.
