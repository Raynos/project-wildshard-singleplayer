# Round 10 — the trader at Wendell's hut (E314)

Jake's pick (2026-09-30, `art/loot/round-1-loop/board-9-shopkeeper.jpg`): the shop is **a second NPC, a trader at
Wendell's hut** (Wendell stays the quest giver), dressed as board 9 A's travelling trader; her goods on **a small counter
in front of her** (board 2 A). Plan: `docs/plans/DRIFTWOOD-LOOT.md` ▸ Jake's picks. No shop logic yet (the shop screen,
board 5 C, comes after the coins and the Bag).

Pipeline: **CODE** (the low-poly kit, `src/world/lowpolyKit.ts`) — the same builder, material and proportions as Wendell
(`src/entities/npc/Castaway.ts`), so she can only match him by being built the same way.

| File | What it shows |
|---|---|
| `ref-board9-trader.jpg` | the reference: board 9 A's trader, cropped (teal headscarf, gold hoops, cream shirt, orange tunic, dark sash) |
| `board.jpg` | Jake's portrait board: the trader in place at the hut from the path + the 4-view strip of her and her counter |

## Detail list (the trader) — the part that carries each

1. Teal headscarf over the crown, tipped back so the brow shows, covering the nape — `head`: a dome, scarf teal.
2. Gold trim band round the scarf's rim — `head`: a torus on the dome's rim.
3. The scarf's knot at the nape with two tails that lift in the wind — `head`: a knot + two flat cones, `sway` (wind).
4. Big gold hoop earrings — `head`: two tori.
5. Face as Wendell's: eyes, nose, arched brows, lips; dark hair at the fringe and temples — `head`.
6. Cream shirt: short puffed sleeves, the V at the throat — `body` / `upper`.
7. Orange sleeveless tunic, stacked bands like Wendell's shirt, flared skirt to the knee, rust hem and collar — `body`.
8. Dark red sash knotted at her left hip, two tails that lift in the wind — `body`, `sway`.
9. Leather satchel on her right hip, its strap across her chest over the left shoulder — `body`: box + rope strap.
10. Left fist on her hip, elbow out, a gold bangle — `body` (static, turns with her).
11. Right arm on two pivots (shoulder, elbow), open hand, a gold bangle — `upper` / `fore`.
12. Brown trousers into travel boots with turned-down cuffs — `body`.

## Detail list (the counter)

1. Three sawn planks on two bearers, four crooked driftwood legs, a lower shelf on rails.
2. A crate and a rope coil on the shelf.
3. A cream sailcloth runner with a teal stripe, draped down the front (lifts a little in the wind).
4. Whetstone I (grey) and II (slate, a brass band) on a wooden block.
5. The sturdy heart: a red heart charm on a cord from a T-stand, a smaller heart lying beside it.
6. The sea chart: a parchment roll tied with twine, a corner curling open with a patch of sea on it, a pebble on it.
7. The sailcloth cape: folded in a stack, a teal edge, a rope clasp and a brass toggle on top.
8. A brass dish of doubloons at the front corner.

## Numbers

- **Trader:** 1.72 m to the top of the scarf (Wendell 1.8 m to his hat's crown; the same neck / shoulder / leg build). Pivot
  at her feet, front +Z. One copy. Collides as a capsule (r 0.26 m, 1.76 m). Moves: the whole figure turns on her feet
  (E129, Wendell's rates), head / shoulder / elbow pivots. Draws: 4 (body, head, upper arm, forearm), no LOD needed at
  this cost; hidden past 85 m like Wendell.
- **Counter:** 1.36 × 0.64 m, top 0.86 m. Pivot at the centre of its foot, front +Z (the customer's side). One copy, one
  merged mesh (1 draw). Collides as one box (you walk round it; the 0.35 m step can't climb it). Static. Hidden with her
  past 85 m.
- **Placement:** hut-local (−3.3, −7.8), west of the hut's front steps across the pier path from Wendell (2.4, −8.2) and
  his fire (0.7, −9.8); she faces down the path toward the fire (yaw π − 0.5), her counter 0.72 m in front of her.
