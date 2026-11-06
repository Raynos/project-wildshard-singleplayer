# round-18-road-decks: Driftwood's entries over water are asphalt road decks (G170, SF46)

Jake's pick G170 (C3-R2-C1): the 15 m socket at each midpoint is an asphalt deck at y = 0, the sea is clipped out under it,
and the pier ramps up from its end. Real captures, not mockups: a working-tree build, iPhone 16 Pro portrait, phone tier,
muted, browser lane (`capture.mjs`).

## Board: `board.jpg`

| Column | What |
|---|---|
| OFF | the "Driftwood hybrid boot" Debug row off: the legacy world (sea at +0.8 m, no deck) |
| ON | the row on, Select a shard: G164's lowered world with G170's decks |
| GRID | the row on, INFINITE WILDSHARD with Driftwood home: the road look lays its asphalt over the deck |

Rows: the south entry from the road; the deck from the side; on the deck walking in (ON and GRID only: OFF's socket lies
under the legacy pier).

## What was built

- `src/shards/driftwood-isle/models/entryDeck.ts` (a model on the contract): the 8 m slab in the boulevard's colours,
  asphalt on top with white edge lines, a concrete edge face and a 5 cm fascia lip down both sides and across the inner end,
  and three concrete bents (cap beam on two square columns down to the seabed). One merged draw for the four decks, no
  shadow casting.
- Each deck runs 16.5 m: the platform's 15 m socket (its floor is still the platform's collider) plus the shardfile's
  declared 1.5 m landing, now drawn as the deck's inner end (surface stone). The 1.5 m plank landings are gone. The pier
  and jetty ramps still start at the socket's inner edge (15 m) and run 9 m at 7.6°.
- The ocean is clipped out under each whole deck, so no crest pokes through the asphalt. The deck slabs feed the ocean's
  foam collars.

## Notes

- The columns stand under the toon water and barely show; the deck's edge face and foam collar carry the "structure over
  water" read.
- The deck is drawn by Driftwood's trusted runtime (like Nine Dragon's landing decks), not by an engine-wide socket mesh.
  In the grid the platform's road look draws the asphalt over it as before.

Walks (row ON): standalone `progress/physics/g170-entries-aa49543c2-muum65ka.json` 9 legs, 0 stuck, 0 swim frames; grid
(`progress/shard-platform/sf46/grid-walk.mjs`) 8 legs road to shard and back, 0 stuck, 0 swim frames.
