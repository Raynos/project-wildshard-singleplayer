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

## Re-check, 2026-10-14 (sp-o201)

**Builds:** before = clean HEAD `d72803fe0`; after = that export plus the two fixes below (now `7fa853e6e`, `76a3bfe55`).
Same profile as above (phone tier, render scale 2, iPhone 16 Pro portrait, muted), driven by `driveFloorGrid` legs.
Frames: `progress/shard-platform/w1-grid-ready-2026-10-14/r01`–`r15`.

### What the three findings were

1. **Signal's black quad was the road's own entry asphalt, not a Signal mesh.** G103 forces 15 m of the platform's
   asphalt (`grid-asphalt`'s turn-in apron, `roadLook.ts`) into every entry. Inside a cell the cell's light owns the frame
   (G165), and under Signal's dusk key (1.85 at 11° elevation), its brown sky fill and its grade, the dark Lambert asphalt
   crushed to (8, 0, 0): every Signal entry had it (east `r03` too), the south was just the one seen from afar. Not a
   regression from today's graph / IBL commits (the asphalt is not a graph material; Signal holds dusk by design).
   **Fix `76a3bfe55`:** the asphalt and junction overlays keep the road's light where a cell owns the frame (the road's frame
   weight drives a lit share and the same map as emissive; on the road they are unchanged, nothing compiles at a
   crossing). The apron now reads dark asphalt with its edge lines, (25, 23, 34): `r01` → `r02`, `r03` → `r04`. Signal holds
   dusk (its clock never advances), so there is no midday inside it; from the road, under road light, the entry was
   already asphalt grey (`r05`).
   The **dark translucent wall** behind the south road is the Blender Template neighbour's rim, dithering out under G321
   part 4's horizon fade (60–140 m) as seen from inside Signal: by design, not a Signal glitch.
2. **The refused re-entry was a duplicate save definition.** Leaving a cell on the owned-home grid retires its region; the
   next entry re-installs the trusted runtime, and `bindRuntimePersistence` (`src/game/plugin/headless.ts`) defined the
   read-only legacy reward slot `shard/sunscar.signal` with a fresh definition object, which the save store refuses
   (`Duplicate save definition`). The catch-all classified it as FAILED SAFETY CHECK and latched it. It refused any
   second entry, not only the west (`r06`, a south re-entry). **Fix `7fa853e6e`:** one slot per store and key.
3. **Sky Reach's 75 % wall is a short, graceful wait.** Driving from 60 m along the road, the player was held at the north
   landing's soft wall for about **2.5 s** (feet stopped at z −298 from 9 s to 11.6 s) while the G217 cell screen showed
   LOADING 75 % (3 of 4 stages; `r10`), then walked in. Admission had started on the road; a longer approach hides more of
   it. It reads as the loading screen doing its job, not a glitch.

### Verdicts

| Shard | Verdict | Evidence |
| --- | --- | --- |
| **Signal** | **PASS** (on `76a3bfe55`) | East in (12 s), south out, road to the west midpoint, **west re-entry admitted in 3.3 s** (`r07`), ~340 m on foot west → north, north out. Every apron reads as asphalt (`r02`, `r04`, `r08`, `r09`). 15.5 k frames over the pass: none over 100 ms. |
| **Sky Reach** | **PASS** | North landing (2.5 s wall), **RIDE THE ISLET** up 25 m in 14 s (`r11`, `r12`), the gate bridge to Sunrest (`r13`), Sunrest → Grove → the west gate bridge, **CALL THE ISLET** and ride it down (`r14`), out by the west entry onto the road (`r15`). East and south lifts are the same declared rows, not driven. |

Harness notes: the touch USE button is pressed with `app.input.pressGesture('use')` (Playwright's tap reports the touch
layer intercepting it). A docked islet waits about 6 s at the top before it returns; boarding later drops you into the
cloud sea and respawns you on Sunrest. Off the 2.4 m rope bridges the same happens. Neither is a fault.
