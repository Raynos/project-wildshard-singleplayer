# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W2 at 19:30Z `5a7f30425`: Pine 74.72 %, Driftwood 69.70 % custom** (target ≤ 20 %; previous measure 78.66 / 71.74; start 107.6 / 104.2). 0 unknown. W1 closed (Sky 9.58, Signal 9.73).
Pine/DW: C1 4184/4497 · C2 1579/2079 · C3 162/0 · C4 3707/2146 · C5 2491/1399 · C6 2830/1227 · C7 12/0 · C8 356/185 · C9 534/433.
Pace since the last measure: Pine about −3 pt/h (above G432's ~2.4), DW about −1.6 pt/h (under its ~2.1). Lanes report honest cuts well below their estimates; Pine C1 is mostly bake readers.
Since then: Pine water on graphs `de1b7286f` (−282), forest on graphs `659d7935c` (≈−220), King clips baked (−217, landing), rifle required `e845be765` (−129), site lights shared `1a6252237` (−45), cabin props `0ec8d4984` (G434); DW rock table `25fb99192` (−199), piers `b919778e6` (−104, G434), arms `a1602d555` (−71), gulls `45e79bb0f` (−43), reward controller `e575681af` (−59), species rows `eb23978d4` (−57), swords `c5b1f0b2f` (−23), pickup roster `960eb5d03` (−29), burst/glide `a504ad97f`; engine I/II `9296a81cc` `9101de089`; gen red fixed `71cf233d2`. Pending: Pine NPC bake (−363), DW kit/palms (cand-e).

**Lanes (G432 5 Opus while Claude < 50 %; Codex 5 + pusher; slots G435):**
- Opus: o229 DW kit/palms (landing cand-e; sway + rock-smooth parked on CPU); o231 DW streamed cover; o232 Pine King; o233 forest landed; o234 DW bridge/reef/shrine. Parked on engine fixes: refs/sp-lanes/sp-o225/island + creatures.
- Codex: x1 held-playback bindings (Pine + Nalati); x4 Pine ambientLife, then tree set; x5 Pine NPC bake; x6 DW C5 (castaway head); x7 push, git, maps (next batch ~2 h); x8 node per-draw CPU (second variant), then builder retention + UBO race.
- Slots: check = x1 x5 o231 o232 · check2 = x4 x7 o229 o234 · check3 = x6 x8 o233 measure.

**For the end-of-plan memory pass (G433/G434):** Pine cabin props (+1.47 MB GPU, +1.31 MB RAM, sp-x4); DW piers (+6.58 MB resident, +3.73 MB wire, sp-x6); map accounting correction `bf2f3fcb2`; parked `refs/parked/sp-x8-weak-cache`, `refs/parked/sp-x8-h`.

**Waves:** W2 → W3 (Nalati + Nine) starts by itself at Pine and DW ≤ 20 % + G420 (G434). In force: G415–G435.

**For wildshard-v:** the engine's graph-material per-draw CPU cost now gates the biggest DW look ports (island, creatures, kit): sp-x8 takes it right after II. G433 `dc01e03fb` received; G435 slots in use; no memory constant touched by my lanes.
Paused rows: SF22, SF57, SF67.
