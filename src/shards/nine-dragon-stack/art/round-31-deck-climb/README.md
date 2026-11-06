# Nine Dragon: round 31, the deck climb (E450 B2, SHARD-PLATFORM SF51-p)

**Question:** each of Nine Dragon's four road-height landing decks (round 30, SF51-g) ends at a stone wall with a
cinnabar band, and Lantern Square sits 125 m above it. How does the player climb from the deck to the fragment?

Art direction only: codex `image_gen` edits of the real round-30 capture (`../round-30-grid-entries/A-from-the-road.jpg`:
the deck, the touch HUD, the claw gauntlet and the jian), graded to the picked dusk + border fog look
(`../round-29-grid-look/C-dusk-fog-border.jpg`, G95), iPhone portrait. Each variant has two frames: **1** at the deck's
mouth looking at the climb, **2** about halfway up looking back out over the deck, the boulevard and the neighbouring
cell (drawn as crag and steppe, a stand-in for Nalati north of DEVSERVER's (+1, −1)).

| file | what it shows |
| --- | --- |
| `board.jpg` | A / B / C, deck frame over midway frame |
| `A-1-deck.jpg` | **A stair tower**: an arched red-lacquer door in the end wall (plaque "九龍"), and a slender pagoda-like granite and timber tower rising from behind the wall, green-tiled eaves and red lanterns every few storeys, switchback flights visible through every window bay, up to a gallery under the fragment's underside |
| `A-2-midway.jpg` | on a switchback landing inside the tower, the next flight climbing at the left, looking out of a carved window bay down onto the end wall, the deck and the road |
| `B-1-deck.jpg` | **B lantern lift**: a red-column pavilion with a green double roof and gold dragon finials against the end wall, a bronze lattice cage waiting with its gate open; two iron chains and a shaft of red timber frames with a lantern on every frame rise to a winch house under the fragment, a bronze counterweight part way up |
| `B-2-midway.jpg` | riding the cage, brass rail and lattice in the foreground, a chain at the right, looking down past the shaft's lanterns to the pavilion roof, the deck and the road |
| `C-1-deck.jpg` | **C grapple hooks**: no structure; a chain of gold dragon-head hooks (the Fei Zhua anchors) starts above the cinnabar band and climbs a granite buttress hanging from the fragment's underside, each with a ledge; the nearest wears the gold target brackets and LOCK reads "GRAPPLE" (gold claw) left of DODGE |
| `C-2-midway.jpg` | on a buttress ledge just after a zip, the cyan line from the gauntlet to the hook above, the previous hook below, the deck and road far below |

## Cost and risk

| | time to the top | phone cost | risk |
| --- | --- | --- | --- |
| **A** stair tower | 125 m is about 40 storeys of switchbacks: over a minute of stick-walking on stairs, each way | one storey module instanced ×~40 plus eaves and lanterns (instanced, emissive, no real lights); a stair collider per flight | it is the "long staircase" the brief warns about; the best-looking landmark of the three, but the climb itself is dull |
| **B** lantern lift | one action: step in, ~16 s ride at 8 m/s | pavilion + cage + counterweight (three meshes), frames and chain links instanced; one kinematic platform in the fixed step (`CharacterMotor.carry` already rides kinematic bodies, like Driftwood's boat) | a moving floor is new for Nine Dragon (its movers neither collide nor carry today): the rider must not jitter or fall through at 30 fps; a call button or auto-cycle needs a rule |
| **C** grapple hooks | 5–6 zips (reach 2.5–38 m, zip 22 m/s): ~20 s for a player who has it down | the cheapest: the hooks are already the shard's instanced dragon hook, the buttress is a few boxes | skill-gated at the front door: a miss falls back to the deck (needs no fall damage there), the player needs Fei Zhua out, and a new arrival meets the grapple before any tutorial |

All three are instanced kit pieces with no facade multi-draw. Caveat for SF51-p: each climb must land where the fragment's
edge actually is above its deck; if the city's built edge sits short of the cell edge, the top needs a short gallery or
bridge in from the tower, winch house or last hook.

## Recommendation: B, the lantern lift

One action, no skill check, and the column of red lanterns reads as "the way up" from far down the boulevard, at dusk
and through the border fog. It costs three meshes plus instanced frames, and the motor can already ride a kinematic
floor. A is the prettiest tower but turns each arrival into a minute of stairs. C is the most Nine Dragon verb but gates
the front door on a skill. A later plan row could add C's hooks up the lift shaft as an optional fast route (no extra
board needed).

## Notes

- Re-rolled: all three midway frames (the first takes put the end wall at the road end of the deck, drew floating
  islands over the neighbour, and C's line came from the sword); two takes each, the take with the right deck geometry
  kept. B-1 was re-rolled for a squat aspect.
- Known mockup liberties: C-1 has low towers beside the deck at road level and its crosshair sits high; the midway
  frames read lower than 60 m.
- Prompts and the runner were scratch files; this folder holds only the finals.
