# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W2 = 9 components (G466, Jake 13:35 Cancun).** Each component is ONE megabuild across Pine AND DW. W2 stays open until its components close (the 05:00Z close is cancelled), and the W1 spike rides along: roc.as/moves → H1 in C4, Sky/Signal quests → H2 in C5, Sky movers → H5 in C7. Close bar: 100/0 per component except listed view code. G465 holds: no runtime/ detours, no const mirrors, every commit a measured net cut. Plan: `progress/shard-platform/host-gap-2026-10-16/README.md` (`6e1fa0038`).

**Headline: components closed 0 / 9.** Ruler at `fa8ce4112` (19:3xZ): M3 26.7 % (21,384 of 80,172 cut; was 16.7 % an hour earlier), plan 16.0–49.3 %. Custom vs legacy: Pine 17,623 = 82.7 % (−551 since 12Z), DW 11,647 = 67.8 % (−1,554), Sky 1,800 = 26.6 % (−4,275), Signal 1,807 = 43.8 %. The table below is the 13:00 Cancun baseline per component.

| Comp | Lane | Pine lines | DW lines |
|---|---|---:|---:|
| C1 static world → GLB / rows | O1 (Opus) | 2,937 | 2,179 |
| C2 looks → graph JSON | O2 (Opus) | 2,994 | 1,904 |
| C3 effects + water + AS scripts | O4 (Opus, next free slot) | 865 | 379 |
| C4 creatures + bosses | x8 (after KS4 lands) | 3,017 | 1,814 |
| C5 NPCs, quests (H2) | x5 (after the movers JSON lands) | 3,521 | 2,177 |
| C6 items: sim x6, held view O3 (H3) | x6 + O3 | 2,572 | 866 |
| C7 movers (H5) | x1 | 15 | 875 |
| C8 audio (+H4, H10) | x4 | 940 | 1,740 |
| C9 boot glue, escapes, const.ts deletion, P4 re-base | x7 | 2,094 | 2,332 |

**Since noon:** measured cuts landed (DW ≈ −400, Pine ≈ −400, Sky ≈ −90), but const-mirror commits added +221 Pine / +371 DW, which C9 deletes. KR1 net lines are report-only; platform growth is accepted (G466 (7)).

**Visual:** each C1/C2 batch ships a labelled phone board, sent to wildshard-v. A short Opus host review runs at each component's close.

**For wildshard-v:**
1. Pine generators/logCabin.ts (1,335 lines): A) freeze the bake (per-building blobs ~5–9 MB, delete the generator, ≈ −1,300) or B) a Blender port (3–5 h). Rec: A.
2. The authored TS row tables DW audioPcm.ts / Pine weatherChannels.ts: G466 C8 row 1 emits them as section JSON through a generator. Building that.
3. Ruler gap: the G458 source ruler excludes shard generators/ TS (Pine 7,388 / DW 7,093 lines today). At least 118 counted lines got credit today by moving into generators (x7 audit). Rec: show generator TS as its own column on the hourly report, and keep the lane rule that a commit's 'net −N' counts generator lines (moves into generators/ aren't cuts). Counting it in M3 would be a big re-base: Jake's call.
Paused: SF22 SF57 SF67.
