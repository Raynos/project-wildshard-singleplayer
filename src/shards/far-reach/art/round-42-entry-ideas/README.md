# round-42-entry-ideas: nine new ways into Sky Reach from the road (E450)

Ask E450 (SHARD-PLATFORM SF49 / SF49-g, G99 / G102). Jake rejected the built timber switchback towers and trestle
causeways (`../round-40-switchbacks/board.jpg`): *"We need to think harder from first principles how to make this better
for sky island. Can you come up with a 3x3 mockup of 9 brand new ideas of how to enter sky island cleanly and not make
it silly"*. Earlier ideas: `../round-38-grid-edges/`, `../round-39-entryways/`.

Art direction, not renders: codex `image_gen` edits of the real road HUD capture
`progress/shard-platform/grid-hud/safe.jpg` (the grid boulevard, the safe-zone HUD, iPhone portrait), with
`../round-38-grid-edges/B-winch-lift.jpg` for the camera at Sky Reach's edge and `../round-40-switchbacks/board.jpg`
(real engine captures) for Sky Reach's look. Every frame is the same spot: on the boulevard at a Sky Reach midpoint,
looking down the 8 m, 15 m asphalt turn-in at the entry device, bare hands, "SAFE ZONE" over a dimmed ATTACK.

## First principles

**What actually goes wrong today.** The switchbacks answer the wrong question. Sky Reach's islands are not just 30–44 m
up, from three of the four edges they are 185–250 m *in* (Sunrest at the centre, the outer ring at ±55–65 m); only the
crown (z −190) sits near an edge. The towers climb the height and then a 200 m trestle causeway crosses the gap, so every arrival is a tower of
stairs plus a long pier: two chores before the shard begins, built from the one material (heavy scaffold timber) that
says "construction site" rather than "sky". It also lands the south entry on the storm crown's rim
(`world/ramps.ts:149`, `ramp('south', CROWN, …)`), which walks round the crown-bridge quest and up to the Roc's dais.

**What makes arriving in a sky world feel right:**

1. **Lift, not climb.** The fantasy of a sky island is being carried up by something the sky itself does (wind, a
   creature, water or stone that floats). Every great sky-world arrival (Laputa's updraft, Zelda's Great Sky Island,
   Journey's wind) gives you the lift; nobody walks up 14 flights. A climb is a chore; a lift is the first wonder.
2. **One action at the door.** Step on, step in, step through. No timing test, no jump puzzle, no 40 s walk.
3. **Readable from the road.** The boulevard is neutral and grey; at the turn-in the player must see, at a glance and
   on a 6-inch screen, both *where it goes* (a visible destination) and *what to do* (a device whose shape says
   "stand here"). Motion that rises (streaks, petals, water, stones) reads "up" from 200 m away.
4. **Native to Sky Reach.** It should come from what the shard already has: wind (the updraft, the GUST fan, the vanes),
   drift rays, floating stone, waterfalls, rope and timber, the cloud sea, the golden-hour Gilded Air look. Nothing
   sci-fi, no glowing tubes, no big infrastructure that looks bolted on.
5. **Works on foot and on the board.** A walker and a hoverboard rider (15 m/s in shards) both take it without
   dismounting, or the dismount is the natural moment (a ferry).
6. **Keeps the contract.** The grid's rule (G93, G99, G131) is only that the 8 m opening and the 15 m asphalt sit flat
   at y = 0 at the four midpoints. Everything beyond the asphalt is the shard's. So every idea puts its boarding pad
   at the asphalt's far end at y = 0; the rest of the cloud edge keeps the engine's railing + wall.
7. **Lands at a gate, not inside the story.** Each entry lands on a new small **gate isle** about 50 m in and 25 m up,
   tied by an ordinary rope bridge into the outer ring of islands (and so to Sunrest and the keeper). No entry lands on
   the crown, the Roost or any quest-gated island, so no quest step is skipped.
8. **Cheap on the iPhone.** One mover or one particle effect per entry, four entries, only the nearest one awake; no
   new physics mode where an existing one (the updraft impulse, a kinematic platform, a hover deck) already does it.

**The shared fix under all nine:** the gate isle. Moving the destination to the edge turns a 230 m problem into a
50 m × 25 m one; any of the devices below then reads as a single hop from the road.

## The nine ideas (board: `board.jpg`)

| # | File | Idea | Cost / risk |
|---|---|---|---|
| 1 | `1-wind-river.jpg` | **Wind River.** Step onto a vane-ringed dais and a visible column of wind (leaves, petals, streaks) lifts you and carries you along a ribbon of air to the gate isle's rim. | Low: the shard's updraft already lifts the board (`plugin.ts` `far.updraft`, `UPDRAFT_LIFT`); extend it to walkers plus a guided path and one instanced streak/petal effect. Risk: loss of control for ~6 s must feel gentle; the edge walk (SF8c) must accept a declared lift link. |
| 2 | `2-ray-ferry.jpg` | **Ray Ferry.** A giant drift ray waits level with a road dock; walk onto the saddle-deck on its back and it glides you up to the gate isle. | Medium: a kinematic platform mover (SF30, like Driftwood's moored boat) skinned with the existing drift-ray model, scaled up. Risk: a wait if it is away (keep one docked per entry when you approach); a ride of ~10 s. The most "sky world" of all. |
| 3 | `3-sky-gondola.jpg` | **Sky Gondola.** A small timber road station; an open cabin docked at road level rides a cable up to the gate isle. | Low–medium: a spline mover, two stations, one cable line. Risk: reads as a ski resort, not magic; a cabin wait; hoverboard riders must stop. Safe and very readable. |
| 4 | `4-rising-islet.jpg` | **Rising Islet.** A small grass islet floats level with the asphalt; stand on it and it rises on its chains and docks into a notch in the gate isle. | Low: one kinematic platform on a vertical-plus-in path (SF30 mover), the isle kit for the mesh. Risk: an elevator wait if it is up top (call it back by stepping on the pad, ~5 s). Native look, one action. |
| 5 | `5-up-falls.jpg` | **Up-Falls.** A road-level pool feeds a waterfall that flows *upward*; wade in and the current lifts you up into the gate isle. | Low–medium: a scrolling water shader on one column mesh plus the same lift impulse as idea 1. Risk: a water-surface swim/wade state on entry (Driftwood's motor water modes exist); the reversed water must read on a phone. Strongest image from the road. |
| 6 | `6-cloud-causeway.jpg` | **Cloud Causeway.** The cloud sea heaps up into a firm cumulus road that curves gently up from the asphalt to the gate isle; just walk or ride on. | Low: one sculpted mesh with the cloud-sea texture and a ramp collider; continuous ground, so `validate`'s edge walk passes today with no contract change. Risk: still a ~55 m gentle walk (4 s on the board); a "solid cloud" can read soft and unsafe. |
| 7 | `7-gale-catapult.jpg` | **Gale Catapult.** Step on a fan-rosette launch pad and a gust flings you in a high arc onto a landing meadow on the gate isle. | Low: one impulse on enter plus a fixed arc; the fan rosette ties to the war fan. Risk: a hard-coded arc must land every time (board speed, low fps); fall damage off; a fall respawns on the road (G103). Fun, fast, a bit arcade. |
| 8 | `8-stone-paternoster.jpg` | **Stone Paternoster.** A slow endless loop of floating stone slabs; step onto the one at road level and ride it up the rising side to the gate isle. | Medium: ~12 kinematic slabs on one loop (instanced, one mover script). Risk: stepping on and off moving platforms on a phone; boarders must time it. No wait and lovely to watch. |
| 9 | `9-falling-up-gate.jpg` | **Falling-Up Gate.** Walk through a carved stone ring and you fall upward through a shaft of rising pebbles and petals into a matching ring under the gate isle. | Medium–high: a gravity flip needs a camera roll and a controlled re-orientation onto the deck (new player state). Risk: motion sickness and the camera on a phone; the most magical, the most code. |

## Top 3, ranked

1. **Wind River (1).** It is the shard's own verb: Sky Reach already has wind as its theme (the GUST fan, the vanes,
   the updraft), and the updraft code exists, so this is an extension, not a new system. One action, no wait, works on
   foot and on the board, readable from the road as a rising column, and costs one particle effect per entry.
2. **Rising Islet (4).** The cleanest "not silly" answer: you stand on a piece of Sky Reach and it floats up to join
   the rest. Native look (the isle kit), one kinematic mover the platform already needs (SF30), and the pad at road
   level is exactly the contract's flat landing.
3. **Ray Ferry (2).** The biggest wonder and the best first impression of the shard, using its own creature; ranked
   third only because it adds a ride and a possible wait at every entry.

Runners-up: Up-Falls (5) is the strongest picture but needs a water state; Cloud Causeway (6) is the cheapest legal
fix today (continuous ground) and the fallback if a lift link can't pass `validate` in time.

## How they were made

Nine parallel codex `image_gen` runs (2026-10-04), one shared prompt (the spot, the HUD with every string quoted, the
Gilded Air look) plus one paragraph per device; frames 851 × 1848 (9:19.5), JPEG q86. Board: 3 × 3, `magick`, labels
number · name · one line. **Re-rolled:** 5 once (the first take read as an ordinary waterfall falling into the pool).
Known drift: 5's ATTACK lost its "HOLD = HEAVY" sub-label; 3's sign shows a second arrow; 7's wind marks read as a dotted
arc of small swirl glyphs. These are art direction only: nothing here is built.

**Whatever wins:** add the four gate isles, move the south entry off the crown, and keep the boarding pad at the end of
the asphalt at y = 0 (G99).
