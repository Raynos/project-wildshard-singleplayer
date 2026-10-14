# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 (Sky + Signal) at 90/10: Sky 9.69 %, Signal 9.95 %, 0 unknown at `99c9a7079`;** G420 by-eye grid-ready check running (Opus o199). Sky/Signal: C1 366/161 · C2 92/139 · C3 49/45 · C5 17/8 · C6 27/12 · C9 106/45.
**W2 (Pine + Driftwood), 11:59Z clean generated `99c9a7079`: Pine 87.73 %, Driftwood 79.78 %, 0 unknown** (start 107.6 / 104.2; 11:02Z 92.06 / 83.11). Pine/DW: C1 4763/5164 · C2 2329/2767 · C3 269/0 · C4 4390/2280 · C5 2547/1493 · C6 3255/1280 · C7 12/0 · C8 360/189 · C9 692/523. This hour: Pine deer/elk hull rows −413, sleeves −1.17 MB resident/download, DW creature bodies baked −352 + captain stand-in −131 (both verified in game), DW cover grid −125 KB/tier resident, weapons −105 Pine/−75 Nalati, C9 boot/intake rows −172/−117, quests −72, elites −74. x8's graph queue is done (wind, shadows, foliage, ocean inputs, instance transform, shadow offset); fixed two push reds (`ae1a8fd09`, `737d09981`). Lanes (G421: 4 Opus visual-only): Opus o197 Pine ground cover, o198 DW ocean, o199 W1 grid check then DW toon materials, o200 Pine water + posed looks; Codex x1 DW body slots/sword, x4 Pine C1, x5 C9 budgets, x6 quest prompts, x7 DW palm/bush bake (−6.75 MB/copy phone), x8 DW keeper. DW piers parked on memory.
**Night QA done** (`406320c20`, `03fd2b75e`): no open regressions; fixed meadow tufts, flips, road-lip shimmer, meadow rims `5c96bcd9b`.

**Waves (G413):** W1 Sky + Signal (done) → W2 Pine + Driftwood (after W1 at 90/10) → W3 Nalati + Nine (after W2 at 80/20); M2 closes with W3 and is DONE when the grid plays from the menu with seamless travel and Jake's three phone runs have no tab kill (G417; no Sim ms targets). Part B → `SHARD-PLATFORM-NEXT.md` (G417, nothing cut).
**LIVE `a399c36f3-mv750iu1` (20:32Z; newest CI-green selector advancing on its own).** **Whole products:** Template, Pastel, Signal.

**G415–G419 in force:** port bar = no glitches, graphically similar, no major regressions; biggest real cuts only, no relabels, no exact-number tests or Sim/frame gating; one measure (custom ÷ frozen legacy); proofs headless only; G416 sweep `819a36b8d`; watchdog `67d4f0045` (G418); Opus 4, no usage stop (G421).

**For wildshard-v:** G420 consumed: the W1 by-eye grid-ready check (four entries, edge profile, far proxy, travel with no major stutter; no ms) goes to the next free Opus lane as its first job. The one measure is the clean generated export (`node scripts/shard-platform.mjs --json` after git archive + link + gen): Sky 9.83 % / Signal 9.95 % at `fc005c527`, so the 12.7 / 10.2 you read are likely a working-tree or ungenerated read. Disk is minded: lanes delete exports. G421 consumed: 4 Opus lanes, visual-only.
**Calls for Jake (2026-10-13; reverse any):** in commit bodies and `open-x-queue.md` (calls 6–49).

Paused: SF22, SF57, SF67.
