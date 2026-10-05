# hud / round-23-big-cards: the built G87 big item cards in three shard accents (SF28)

Not a pick: Jake already picked G87 (big cards + a shard accent, `round-19-ui-kit/B-big-cards-accent.jpg`) and G104 (the
20 accents, `round-20-accent-palette/`). These are **live captures of the built panels** next to that board, as proof.
The new look sits behind **pause ▸ Settings ▸ Debug ▸ Look ▸ Item cards** (Classic | Big cards (G87)), default
**Classic**, because the tiles draw the engine's SVG item icons, not the board's item photos.

| File | What it shows |
|---|---|
| `board.jpg` | Jake's G87 board (mockup) beside Driftwood's shop, Pine Hollow's pickup card and Nalati's pickup card |
| `driftwood-shop-big.jpg` | Maren's counter as the G87 sheet in 05 MARIGOLD: "MAREN · TRADER" + the purse, six goods as big tiles (buy, locked, prices), the wide "BUY WHETSTONE I · 12" bar |
| `driftwood-shop-big-2.jpg` | the same after → (the next tile framed, the bar follows it) |
| `driftwood-shop-classic.jpg` | Item cards = Classic: today's one-card flip deck, unchanged |
| `driftwood-pickup.jpg` | the pickup card (Iron sword) in MARIGOLD |
| `pine-pickup.jpg` | the pickup card (Warden's longbow) in 08 MOSS |
| `nalati-pickup.jpg` | the pickup card (Spear) in 01 EMBER |
| `capture.json` | what each capture read back: the shop's tiles and bar text, each card's name and `--ws-accent` |

**How they were made** (SHARD-PLATFORM SF28, ask E435, 2026-10-04): `capture.mjs` through `scripts/browser-lane.sh`,
Chromium as an iPhone 16 Pro (402 × 874 @3×, portrait, muted), Item cards saved as Big before the load, against a
`scripts/serve-build.sh --rev` build of the SF28 commit. Driftwood's shop is opened through the loot handle while facing
the trader at her counter; the pickup cards are the HUD's platform pickup path (`hud.pickupCard`) fed one of that shard's
own equipment rows. `board.py` composes `board.jpg`.
