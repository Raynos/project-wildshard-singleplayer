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

## Boards 2–4: the rest of the rows that need Jake's call (E318, 2026-09-30)

Jake: "15 is not in the board". These three boards show every row of the plan that board 1 left out and that still
needs his call, one card per row, five cards per image. Card number = plan row. 16, 22 and 33 are decided in
DRIFTWOOD-LOOT; 30–32 are docs rows; 34–38 are keeps, so they have no card.

- **Build:** live `6ca63ec-munpj8lp`, Driftwood Isle. Same device and set-up as board 1 (Playwright iPhone 16 Pro
  portrait, touch, phone tier, muted, Metal). The sea glass piece, the reef chest and the Captain's body were triggered
  through the `__adventure` / `__world` debug handles; Developer mode was switched on with the title's DEV pill for the
  Debug shots. Nothing in the game was changed.
- **Two rows are out of date on the live build:** **15** (E314's Bag ▸ Finds now reads `found:reef-treasure` and shows
  the pearl necklace as a treasure, `src/game/loot/finds.ts:52`), and **18** (the Gear tab now says "Tap a weapon to
  hold it" and HELD; only "Wooden sword" vs the desktop hotbar's "Sword" is left).
- **Text cards:** 14 and 23 are sounds, 27–29 are code only. Card 20's A is the app-launch title (the bare URL, as the
  home-screen PWA opens it: `src/boot/entry.ts:43` shows StartTitle only with no query params), swiped to the Nine
  Dragon card; B is the in-game title after Exit to main, same card.

| Image | Cards |
|---|---|
| [`board-2.jpg`](board-2.jpg) | 11 titles · 13 sea glass counted twice · 14 hit-tick on quest beats · 15 pearl necklace · 17 harvest the Captain |
| [`board-3.jpg`](board-3.jpg) | 18 Bag wording · 19 dev text on card + map · 20 two title screens · 21 blank signposts · 23 samples never played |
| [`board-4.jpg`](board-4.jpg) | 25 decided ground-cover rows · 26 stale Debug text · 27 AR-15 on sword shards · 28 Pine Hollow config · 29 dead onZone hook |
