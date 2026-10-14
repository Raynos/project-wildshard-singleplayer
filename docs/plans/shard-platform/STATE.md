# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 (Sky + Signal) CROSSED 90/10 at `b2c81ac8b` (05:10Z); at `d25ea6f05` Sky 9.83 %, Signal 9.95 %** after x7's honest namespace-reach fix `925a0e85b` (+48/+6, no cut lost). Sky/Signal: C1 375/161 · C2 92/133 · C3 49/45 · C5 17/8 · C6 27/12 · C9 106/51; unknown 4/2 (new shardfile spans, x7 tagging).
**W2 (Pine + Driftwood), 10:07Z clean generated `d25ea6f05`: Pine 98.8 %, Driftwood 83.26 %** (start 107.6 / 104.2). Pine rose only from `925a0e85b` (+731 honestly recovered Pine-only spans); real cuts since `caa70db14` ≈ −130 Pine / −200 DW. Pine/DW: C1 5061/5168 · C2 2554/2930 · C3 269/0 · C4 5116/2671 · C5 2639/1499 · C6 3539/1283 · C7 12/0 · C8 363/189 · C9 1413/553; unknown 111/0 (x7 checking the 67 src/game/grid spans are really Pine's, then tagging). Engine: toon-only IBL fix `dd9a32ab1` (reef now orange → dark red → black; Sky unchanged); lent runtime textures `e8bea36df`; door draw bug stale. x8 next: DW ramp fog, 15, 16, round 3 (wind, displaced shadows, foliage normals). Lanes: x1 Pine C6 weapons, x4 Pine weather, x5 Pine birds (+246 KB logged download), x6 NPC talk, x7 metric owners then DW C1, x8 engine; Opus o190 W2 first-person arms, o191 Pine props. Reef port waits on ramp fog. DW piers parked on memory.
**Night QA done** (`406320c20`, `03fd2b75e`): no open regressions; fixed meadow tufts, flips, road-lip shimmer, meadow rims `5c96bcd9b`.

**Waves (G413):** W1 Sky + Signal (done) → W2 Pine + Driftwood (after W1 at 90/10) → W3 Nalati + Nine (after W2 at 80/20); M2 closes with W3 and is DONE when the grid plays from the menu with seamless travel and Jake's three phone runs have no tab kill (G417; no Sim ms targets). Part B → `SHARD-PLATFORM-NEXT.md` (G417, nothing cut).
**LIVE `a399c36f3-mv750iu1` (20:32Z; newest CI-green selector advancing on its own).** **Whole products:** Template, Pastel, Signal.

**G415–G419 in force:** port bar = no glitches, graphically similar, no major regressions; biggest real cuts only, no relabels, no exact-number tests or Sim/frame gating; one measure (custom ÷ frozen legacy); proofs headless only; G416 sweep `819a36b8d`; watchdog `67d4f0045` (G418); Opus 2 until Claude weekly 95 % (81 % at 09:17Z).

**For wildshard-v:** G419 consumed: pending-second-user allowlist → x6 (answered: card field now two-shard, no entry); W2 M0 Pine/Driftwood tagging → x4 (`w2-m0-inventory.md`); Opus 2 until 95 %. G416 sweep `819a36b8d`; G417/G418 done. Sky library 8.81 MB `f38d8cf09`.
**Calls for Jake (2026-10-13; reverse any):** in commit bodies and `open-x-queue.md` (calls 6–49).

Paused: SF22, SF57, SF67.
