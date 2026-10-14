# W1 grid-ready by-eye check, 2026-10-14 (sp-o199)

Jake's G420: a wave closes when each shard is grid-ready: four midpoint entries, an edge profile, a far proxy, and travel
through it with no major stutter or glitch **by eye** (no millisecond target). This checks W1's two shards on the grid.

**Build:** clean HEAD `99c9a7079` (`scripts/serve-build.sh --head`), INFINITE WILDSHARD tapped from the title (Developer
on), phone tier, render scale 2, Chromium as the iPhone 16 Pro (402×874 @3×, portrait, muted). The player was driven with
held input through the grid driver (`driveFloorGrid`, `scripts/frame-floor-grid.mjs`), road legs on the hover board, cell
legs on foot; one screenshot every ~1.2 s. Layout: Driftwood home (0,0), Signal at cell (-1,0), Sky Reach at (0,-1).
Frames (603 px JPEG): `progress/shard-platform/w1-grid-ready-2026-10-14/`. No video in git (frames only; the run was stopped after the Sky crossing leg).

## Signal (sunscar-dunes): FAIL

| Item | Verdict | What I saw |
| --- | --- | --- |
| Four midpoint entries | pass (declared) | `shard.json` declares north/east/south/west at the edge midpoints, 8 m wide. |
| Far proxy | pass | Dunes visible from the road one cell out (`001`, `003`). |
| East entry (road → cell) | pass | Smooth drive in, title card, no pop (`012`, `025`). |
| Crossing east → south | pass | ~420 m on foot over the dunes, no hitch, hole or pop (`050`, `106`). |
| **South entry edge** | **FAIL** | A flat **black quad** lies on the sand right at the south entry, the size of the entry deck, with a dark translucent wall behind it (`106`, `108`). The edge does not blend into the road there. |
| South exit (cell → road) | pass | The road leg committed, back on the asphalt (`147`). |
| **West entry (road → cell)** | **FAIL** | Re-entering at the west midpoint after leaving: a **"REFUSED · SIGNAL DUNES · YOUR SAVE IS KEPT"** panel and a cyan barrier; the entry never admitted the player again (`167`). Leg timed out, so the west → north crossing and the north exit were not reached. |
| Stutter by eye | pass | No visible hitch on the drives I did complete. |

## Sky Reach (far-reach): PARTIAL (not closable by this check)

| Item | Verdict | What I saw |
| --- | --- | --- |
| Four midpoint entries | pass (declared) | Four `socketLift` entries at the midpoints, each a road landing plus an islet lift to 25 m. |
| Far proxy | pass | The floating isles read from two roads one cell out (`271`, `272`). |
| North entry approach | **concern** | At the north landing a full-width **"LOADING SKY REACH 75 %"** wall stops the player on the road edge before entry (`274`): admission is not ready when the player arrives. |
| North landing | pass | Landing deck, chains and islet drawn, title card, no hole (`288`). HUD reads "SKY REACH 137 % OF BUDGET" throughout. |
| Lift ride / crossing | not verified | The islet lift needs the "RIDE THE ISLET" action; the driver only holds move, so the player stood under the islet for 24 s and then walked off the landing into the cloud sea below (`300`, `330`). Crossing on foot is not how Sky works, so this is a harness gap, not a game fault. West entry and the exit were not reached. |
| Stutter by eye | pass (approach only) | No visible hitch on the road and landing legs. |

## Open for the coordinator

1. Signal south entry: the black quad and dark wall at the south midpoint (edge profile).
2. Signal west re-entry refused after a south exit (the crossing refusal path).
3. Sky Reach: the 75 % loading wall at the north landing; the crossing needs a driver that presses the lift's ride action
   (or a by-hand pass on the phone).
