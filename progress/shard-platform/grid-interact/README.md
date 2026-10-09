# grid-interact: prompts inside an entered grid cell, and Sky Reach's islet rail (E435)

**The bug.** No interaction prompt showed anywhere in an entered grid runtime cell (Sky Reach's RIDE, a cell's talk / pickup /
open). The cell's prompts were in the page list (the scoped runtime binding already points `boot.runtime.interactables` at
the entered cell's own list), but they are **frame-local** while the page camera carries the C39 render origin (the scene
stays in the home frame; the camera is offset by the active frame's origin minus the home origin during update). At the
Rising Islet's centre the feet were at local z 227.8 and the camera at page z −327.2: a whole cell apart, so no prompt was
ever in range.

**The fix.** `src/game/grid/enteredInteract.ts`: the page picks from one list in one frame. Standalone or in the grid's
borrowed home frame: the page runtime's list and the camera as is. Inside an entered runtime cell: that cell's own scoped
list (`PreparedRegionalRuntime.interactables`), only once its hooks complete and only while the feet stand in its cell
(`enteredRuntime`), with the eye = camera less the render origin applied this frame (`LiveGridSession.pickPrompt`).
Anywhere else (the road, a template copy, mid-crossing): nothing, so a crossing never shows two cells' prompts or the home's at
its local spot in another frame. Carcass harvest (home herd) now runs only in the home frame for the same reason.
Unit test: `test/grid-entered-interact.test.ts` (two cells and the home).

**The rail (playtest round 3 #8, rt3-dev's change).** A 1 m timber rail around every rim edge of the resting islet except the
two facing the lip (static colliders, drawn only at rest); the RIDE radius = apothem + 0.05. Far-reach map rebaked.

## Receipts (Developer-ON grid boot, WebKit, iPhone 16 Pro, muted)

| probe | before (a04ac6e) | after (candidate 2d269d9) |
|---|---|---|
| walk onto the islet centre, read the prompt (`probe.mjs`) | `""`, USE band none | `[E] Ride the islet` from z −321.7 on, USE band "Ride the islet" |
| Driftwood home, beside Wendell, 4 sides (`homeprobe.mjs`) | 4 / 4 `Talk to Wendell` | 4 / 4 `Talk to Wendell` |
| north road → islet on the board, tap USE, ride, walk on (`sky.mjs`) | rt3-dev: stops on deck, USE none | stops at z −332.2 y 0.45 (rail), USE tapped, ride to y 25.0, walk to Sunrest z −530.3 y 29.6, 0 respawns, 0 page errors |

Images: `islet-centre-before.jpg` / `islet-centre-after.jpg`, `drive-1-rail-stop-ride-prompt.jpg`, `drive-2-ride.jpg`,
`drive-3-sunrest.jpg`. Raw: the `*.json` files.
