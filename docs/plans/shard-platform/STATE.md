# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**(1) LIVE 0012c73e11**; release of **8c07d58caa** dispatched 19:25 (run 40608520545: full CI + all six smoke legs green). 94f30e1ee5
can't ship: CI green but its Pine public smoke leg failed (GL 1282, no local repro; 3001d0dac3 logs it). Damage list:
[BURN-DAMAGE-LIST](../BURN-DAMAGE-LIST.md) only. HOST-AUDIT (G679) parked; legacy waits (G606).

**19:30 reply (wildshard-v):** I1, I7, I11 are done (marked in the plan this afternoon); only **I2** is open. Its blocker is the
12 MB bar: no look-free cut reaches it. Latest before-control reads: Nalati 60.19 MB (7c6c0a9933), Driftwood 34.3, Pine 102.8,
Nine 146. What's left needs Jake: D179 / D185 (pop-in, softer Pine look) or per-shard byte targets. Recommend: per-shard targets.
**Why 183 / 209 is flat:** the 26 open rows are measured misses (I2, cold crossings, H4, A1, T10, D2). Landings move the readings
(Nalati cold 13.7 -> 11.89 s, eada99d797; Pine 4x look p95 50 -> 33 ms, ff0e366f99) but none reaches its bar without a look pick.
**Question (Nalati herds, T10):** the herd clock runs faster the more members' thinks are staggered (herdTick.as integrates each
member's dt). Tick once per 0.1 s per herd: real-time clocks, ~5-7 % of Nalati's frame, herd paths change. Recommend: yes (bug fix).
**Question (cold crossings):** pacing and approach prebuilds are spent (D152; 80 % test fails). Light pooling works (Nalati
programs 235 -> 173); sp-o5 does Pine next. Short of 8 s, the lever is fewer material variants = look change (G717.O3.5b).
Recommend: an A / B board per shard then.
**For Jake's play (G812):** Driftwood -7 MB A / B board `art/driftwood-isle/round-21-phone-geometry-ab/board.jpg` (9ca2c9e22a).
**FYI (look correction):** the Float16 fix (430285601e) gives Nine's crowd casts their authored colours back.
**Jake picks open:** D183 / D185; LD5-LD8 / A1 / A2 / M2 / RM13.

**Lanes (G818; Claude 88 %, 3 Opus; Codex on credits):** sp-o3 T10 Pine drive + 1282 red, sp-o4 Nalati cold, sp-o5 Pine cold,
sp-x1 Nalati I2, sp-x2 Pine I2, sp-x8 + sp-x9 H4 / A1, sp-x6 + sp-x10 damage, sp-ci-deploy CI + release. sp-o1 / sp-o2 released.

**Rules:** G704. G807. G818. No reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
