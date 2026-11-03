# Night Market · round 76 · OP1 lanterns (2026-11-03, sp-o2)

OPEN-PLOTS OP1 (Jake, G827: *"too many floating lanterns ... way less lanterns ... connected by a very visible rope ...
a lot higher detailed"*), landed in `43f9809f0d` + `d141a00252`.

| File | What |
|---|---|
| `board.jpg` | A NOW (`489792e525`) · B AFTER (`d141a00252`) at three of the G726 dome cameras (D2 view 7 down a lane, D2 view 5 the gate, A2 view 1 up from the road), `scripts/capture-night-market-domes.mjs`, iPhone 16 Pro, phone tier, 2x |

What changed: every sky lantern is gone (three a lane, five over the plaza); each lane string's cord is a thick dark rope;
~55 hero paper lanterns (the kit's `hero` take A, `scripts/blender/open-plots/hero.py`) hang one to every other seam
where its rope sags lowest, and the gate's 14 lanterns are hero lanterns too, replacing ~900 small paper lanterns; the
gold bulbs stay. D2's maxima 129 draws / 563k triangles (was 130 / 570k), A2's 110 / 406k (was 110 / 414k); the
phone wire is 8.13 MB of its 8.23 MB ceiling, the tile bake clean.

Decided on the recommendation (G872) and logged for Jake's review: the rope style is the row's own words (thick,
dark, sagging, lanterns hung straight from it), and one hero lantern a seam on every other seam is what the phone
wire ceiling holds without a ratchet raise (each costs ~2.6 KB).
