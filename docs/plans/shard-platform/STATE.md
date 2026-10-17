# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W2 = 9 components (G466, Jake 13:35 Cancun).** Each component is ONE megabuild across Pine AND DW. W2 stays open until its components close (the 05:00Z close is cancelled), and the W1 spike rides along: roc.as/moves → H1 in C4, Sky/Signal quests → H2 in C5, Sky movers → H5 in C7. Close bar: 100/0 per component except listed view code. G465 holds: no runtime/ detours, no const mirrors, every commit a measured net cut. Plan: `progress/shard-platform/host-gap-2026-10-16/README.md` (`6e1fa0038`).

**Headline: components closed 0 / 9.** C7 review `23d1ca30a`: not closed (canoe transit track and door hinge fail G454, Pine-only); 5-item fix list at x1. Ruler at `3d26e4535` (02:5xZ): M3 38.9 % (31,148 of 80,173 cut), plan 23.3–56.6 %. Custom left: Pine 12,079, DW 7,440 (−1,334 since 01:4xZ, `c280fbe49` −495 the biggest). Boots: Pine `cf1b239f4`, DW sword `614aac37d` fixed. C3 review `ba4d00fe9`: NOT closed (Pine 99: 80 listed view, 19 door/audio; hosts SiteLights callbacks, weather Pine-only, flock modes Pine-only, 3 hosts lack tests; fix list queued for the next free Codex lane + one Opus water item); C7 Pine doors are honest custom (no second reversible door). The table below is the 13:00 Cancun baseline per component.

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

**G468 (Jake 18:55, `f783bb736`):** every commit deletes a whole runtime file or module with its data path in the same commit (aim ~150+ net, no admit-only); parity per ~5-commit batch; a board only when the look changes; DW first (DW 53.1 % needs ~390/h); x1 joins C5/C4 after the C7 fixes. Relayed to all ten lanes 19:0x.

**G469 (Jake 19:40):** short-lived agents: one task per Codex agent, then `/new` and a fresh self-contained brief; one job per Opus subagent; no poll loops.

**Visual:** A short Opus host review runs at each component's close.

**G467:** Pine logCabin.ts stays (a working generator); generators are not custom code (no column, no re-base, build-time code may live in generators/).
Paused: SF22 SF57 SF67.
