# Mockup council round 12

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0611-c83fb063` (sha c83fb063, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

- far-reach: capture `progress/far-reach/20261003-0608-591bd5b5` (sha 591bd5b5, staged {'h4-crown': 'quest-crown', 'mock-D-crown-arena': 'roc-opening'}, page errors 0)

**The bar is 7.0** (ledger 4 as Jake amended it on 2026-10-03; the no-shortcut rules are unchanged).

### Signal Dunes, round 12

The capture is at c83fb063, the builder's ready SHA. Parity is green at that SHA (walk 0 stuck, gpuMB within 108.99).

Changes since round 11 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file that holds a stage handler):

- no camera changed in cameras.json

Commits touching staging code between the captures:
- 4a9d91687 E399 Signal Dunes, council round 11 seat C's findings: the late land darker by its facing, the fill monotonic, the glove's value b

All shard commits between the captures:
- c83fb0632 E399 Signal Dunes: the keeper lamp's embers back to 4 (6 grew the ember buffer 32 bytes past the phone gpuMB ceiling at 5fded12c5)
- 5fded12c5 E399 Signal Dunes, council round 11 findings: the low sky unclipped, A's right-hand banks, the spawn sky's level, the glove's valu
- 4a9d91687 E399 Signal Dunes, council round 11 seat C's findings: the late land darker by its facing, the fill monotonic, the glove's value b
- ba3ebda26 E399 Signal Dunes: the sunset step's near sand split between its two mockups (the lead after round 10: A's near sand 78.2 / 57.4 t
- 615ae4664 E399 Signal Dunes: the waymark's plinth a drum of dark fieldstones (the seats since round 7: a clean pale brick block; mockup C: r

**Builder's notes:**
- **Dusk changes, declared:** fillAt is now monotonic (1 + 0.05 d), with the bump at 0.5 removed. B's logbook step is lifted in the sand material instead: a bell ×1.5 at dusk 0.5, on the sand albedo only. Check that this is a world change and not tuned to B's shot. duskOf is unchanged.
- **Terrain:** a low near ridge, (8, 42) to (40, 30), 4 m, in A's frame. The navmesh is re-baked, and the main crest line didn't move.
- **The rest:**
  - the late land darkened by its facing, replacing the constant far-fill cut;
  - the low sky unclipped;
  - A's right-hand cloud banks;
  - a lighter glove;
  - the keeper's flame at 2.6 m with a 1.1 m halo;
  - torn flame edges;
  - a fieldstone plinth.

## Sky Reach (far-reach), round 12

The capture is the builder's: `20261003-0608-591bd5b5`, built at 591bd5b5d. The lead's rulings in scores.md apply.

Changes since round 11 (generated; covers every shot's camera, every real-camera move or turn, and every commit touching a file that holds a stage handler):

- no camera changed in cameras.json

Commits touching staging code between the captures:
- 064cf48f8 E399 Sky Reach, council round 10 seat B (1)-(4): the Roc's take-off launches over the dais toward the arena's entrance, where a pl

All shard commits between the captures:
- 591bd5b5d E399 Sky Reach, round 10 (seats B and C, 'bald grass caps'): dense uneven stands of fir on every crag of the cluster over the mill
- 064cf48f8 E399 Sky Reach, council round 10 seat B (1)-(4): the Roc's take-off launches over the dais toward the arena's entrance, where a pl

**Builder's claims** (measured on seat B's patches with one tool):
- **The Roc's take-off** launches over the dais toward the arena entrance, where the player walks in, then banks into its lap. In D it comes head-on, wings spread, under the bar. The rise is 2 m, with the same 4 s take-off, the same stage and a 3.3 s settle. Round-11 seat C found that the first fight and the staged shot took different headings; check that all paths now match.
- **The meadow's backlight** fades over the nearest metres: a third at the feet, full from about 6 m. Near-ground medians: A 72 → 63 (mockup 61), C 97 → 78 (67), D 99 → 85 (56).
- **D's glare** on fan-free ground (x 0-0.45, y 0.45-0.65): 13.6 % → 5.9 % over 230 (mockup 10.4). The crown's cloud bank now keeps its puffs out of the sun's direction.
- **The fan hold** sits 2.5 cm right, so D's dais row is clear to x 0.50 (it was 0.43). The crag rims are lit only on their sun side.
- **Dense fir stands** on the cluster's caps, 6-9 each.

**After this round** both builders work the lead's top-10 lever plans (docs/plans/SIGNAL-DUNES-TOP10.md and project/archive/2026-10-03-sky-reach-top10.md, E407) instead of council micro-fixes.
