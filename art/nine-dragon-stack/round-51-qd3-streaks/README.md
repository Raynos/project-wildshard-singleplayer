# Nine Dragon · round 51 · the wet-ground neon streaks (QD3, G995, 2026-11-03, sp-o2)

Jake's QA (`../../qa-2026-11-03/qd3-stairs-neon.jpg`): *"It's supposed to be the true reflection of real neon above me,
but it's just random placeholder."*

`board.jpg`: three spots (the stairs' first landing looking up the stair-street, Jake's QA spot; Lantern Square toward
the gate, round 15's mockup view; the east street looking north) × A / B / C, in Chromium and WebKit, on the live
`00a106f` preview, phone tier, 2x, muted iPhone 16 Pro. Off-tree: B and C edit the streak cards' instances live.

- **A now:** every light (signs, lanterns, lit windows) lays a card at its optical mirror point on each receiver (the
  floor, each flight, each landing) with a tail stretched to the player's feet: a carpet of rainbow runs, many under
  lights out of frame.
- **B anchored:** the same mirror points, so each run sits on screen straight under its own light, in its colour and
  width; only lights the player can see leave one, the run is a short gloss (12 % toward the eye, 25 % away) and it
  dims from 15 m to nothing at 50 m.
- **C wet sheen only:** no cards; the wet ground's own shading.

**Ruled B (G941 / G872):** C drops the neon-on-wet-stone the Jiehua Neon look is built on; A is the placeholder Jake
flagged. B ships as `streakGraph.ts` (on-screen gate and reach) and `receiverCards.ts` (the short spread), after QD1.
