# Driftwood slop sweep, round 4 (E318, 2026-09-29)

The top cut candidates from [`docs/plans/DRIFTWOOD-SLOP.md`](../../../docs/plans/DRIFTWOOD-SLOP.md) (38 rows), one
card each. Every card's number is that row's number in the plan, so a reply like "delete 1, 2, 5–9" maps straight onto
the table. **PURE** marks a deletion with no taste call.

- **Build:** live `412d443-mun9x88v`, Driftwood Isle.
- **Device:** Playwright iPhone 16 Pro, portrait (touch, phone tier, muted, Metal).
- **How the shots were set up:** the player was placed with `window.__world.player.spawn`. The boar kills (5), Old
  Ironhide (4) and a 12-kind junk pack (the Bag shot) were forced through the debug handle. Nothing in the game was
  changed.
- **Cards 6, 7, 9 and 24 are text cards.** Those things are real (the file:line is on each card) but weren't put on
  screen in this sweep.
- **Why an AR-15 is in cards 3 and 8:** those frames were taken after card 4's Ironhide pickup had put the AR-15 in
  hand.

| Card | Plan row | Shot |
|---|---|---|
| 1 | Load diagnostics on the loading card | loading screen at 82 % |
| 2 | Staging boundary gate (amber box) | the spawn pier's end, 15 m behind spawn |
| 3 | Hoverboard | HOVER tab + board, on the pier |
| 4 | AR-15 from Old Ironhide | "IRONHIDE AR-15 — …" toast, FIRE / AIM / SWAP |
| 5 | Harvest + junk pack | "Boar meat + Boar hide + Boar tusk harvested · 33 in the pack" |
| 6 | Deer on the plateau | text |
| 7 | Black bear at the shrine | text |
| 8 | North / West landings | the west jetty from the beach |
| 9 | Wendell's boat line | text |
| 10 | DEV pill + Sound on | the title's footer and the shard card's "(−1, +6)" subtitle |
| 12 | Filler achievements + titles | the Achievements tab |
| 24 | Decided Debug rows (and rows 25, 26) | text |
