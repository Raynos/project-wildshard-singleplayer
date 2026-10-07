# menu / round-11-whats-new: the daily "WHAT'S NEW · WHAT TO TRY" card on the title (SHARD-PLATFORM SF60, G201)

**Question: where does the daily playtest card sit on the main menu?** Once a day the coordinator pins a playtest build
with Developer on and the day's candidates switched on (G201), and the title lists that day's changes in a few lines.
Every variant edits the real capture of today's main menu (`before-live.jpg`: iPhone 16 Pro portrait, Developer on,
build `B64C2A9`), so the road title art, "WILDSHARD", the build chip, "SHARD SELECT", "INFINITE WILDSHARD" and
"SETTINGS" stay true. The four lines are real work from 2026-10-07: SF49-g (Sky Reach's Rising Islet entries), G187 cut 2
(Pine Hollow's KTX2 creatures, −26 MB phone GL), SF51-p (Nine Dragon's north lantern lift, Developer row) and the
kinematic mover-deck stall fix (SF49 / SF51).

| File | What it shows |
|---|---|
| `before-live.jpg` | Today's main menu, unchanged (the live capture every variant edits) |
| `board.jpg` | The pick board: A / B / C side by side |
| `A-card.jpg` | **A, a dismissible card over the title art**: under the logo, a navy-glass card headed "WHAT'S NEW · WHAT TO TRY" / "PLAYTEST · OCT 7" with a "×", four bulleted lines ("SKY REACH: RIDE THE RISING ISLET UP FROM THE ROAD", "PINE HOLLOW: LIGHTER ON MEMORY, SAME LOOK", "NINE DRAGON: NORTH LANTERN LIFT (DEVELOPER)", "LIFTS: NO MORE STALLING ON A MOVING DECK") and a "GOT IT" button. The two doors and SETTINGS don't move |
| `B-strip.jpg` | **B, a strip above the two doors**: a full-width strip on the road just above "SHARD SELECT" / "INFINITE WILDSHARD", "TODAY" / "OCT 7" on the left, "WHAT'S NEW · WHAT TO TRY" and the same four lines on the right; always shown, no dismiss |
| `C-chip-sheet.jpg` | **C, a chip that opens a sheet**: a "WHAT'S NEW · 4" chip under the build chip; tapping it opens a bottom sheet ("WHAT'S NEW · WHAT TO TRY", "PLAYTEST BUILD · OCT 7") with one row per shard ("SKY REACH" / "RIDE THE RISING ISLET UP FROM THE ROAD" …) and "CLOSE". Shown here open |

**Recommended: A.** It is the only one Jake sees on every launch without a tap and still reads at full size: the
lines are the biggest of the three, it covers only sky, and "GOT IT" puts it away for the day. B is always on and its
text is the smallest (four lines squeezed beside the date, right where the thumb goes for the doors). C is the tidiest
title, but a chip he has to tap is a chore he won't do (JAKE.md: no phone chores), so the day's "what to try" would go
unread. Building A is an E332 menu change: it goes over herdr to the HUD owners before it lands.

**How they were made** (SF60, ask E435, 2026-10-07): the layout was iterated on local Qwen-Image-2.1 turbo
(`scripts/mockup-local.sh` with a mask per placement, seed 7; all three placed the text correctly, but the masked area's
title art came back muddy), then the finals are codex `image_gen`, two takes per variant editing the same capture with
every string quoted. Kept: A take 2 (take 1 squashed the title art upward), B take 1 (take 2's lines were thinner and
harder to read), C take 1 (take 2 equally good; take 1 keeps the faint cards visible under the sheet). No take had
garbled text. Frames are 851 × 1848 JPEG. Mockups only: nothing here is built.
