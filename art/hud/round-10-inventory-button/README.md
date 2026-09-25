# HUD round 10: the inventory button (E124)

The user (2026-09-24): an inventory button top right of the minimap, the minimap moved 5 % left. Two menu buttons:
PAUSE → settings + feedback; INVENTORY → map / inventory / trophies.

Made from the user's own iPhone screenshot (`current-full.jpg`). The minimap was moved 59 px (5 % of the width) left
by hand (the sky filled in from its own column, so it's pixel-true), then **Qwen-Image-2.1 turbo** (local,
`scripts/mockup-local.sh`, a small edit mask per variant) drew only the new button(s). 2 seeds each; kept the one
that did the edit (B seed 7 drew no badge, C seed 7 garbled the chip).

| File | What it shows |
|---|---|
| `board.jpg` | the pick: current · A · B · C, top of the screen |
| `current-full.jpg` | the user's screenshot (the reference) |
| `A-full.jpg` | A: a square glass BAG button (backpack icon + "BAG") in the corner right of the minimap |
| `B-full.jpg` | B: a round backpack badge on the minimap's ring at 1–2 o'clock |
| `C-full.jpg` | C: matching square buttons, a pause square top-left + the BAG square top-right (the model left the old PAUSE chip beside it; C means the pair) |
