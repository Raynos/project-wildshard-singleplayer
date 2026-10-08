# grid-polish-2: G222 / G223 follow-ups (template colliders, Nalati day key and storm wind)

Proof for the four bugs playtest-1 (#7) and the nalati-sky lane left for an owner. Captures: iPhone 16 Pro portrait,
muted, one browser through `scripts/browser-lane.sh`, Developer ON, Template-2 (cell 1,1) in the grid.

`hut.mjs` (`--tag=before|after`) surveys what a ray from z +8 meets at the cell centre, photographs the hut door from the
north, drives the board south at 30 m/s, then plays the door's toggle scene through the region's script lane and drives
again. `hut-before.json` is HEAD `4549ace30`; `hut-after.json` is the build of the fix commits (`90517b8fd` candidate).

## 1. The invisible 0.99 m ball at the cell centre

It was big-blob's movement capsule: `SimHost` made each creature's `CharacterMotor` and never placed it, so a creature
that never walks left a CREATURE capsule at the world origin. Now every creature and player capsule starts at its spawn
(`src/engine/sim.ts`; the same gap in `CreatureBodies.motorFor` for the classic shards' near animals).

| | survey at x 0, y 0.3 | north run (from z +150) |
|---|---|---|
| before | capsule r 0.99 at (0, 0, 0), hit at z +0.98 | stalls at z **+1.4** |
| after | the door panel at z −8.9 | stalls at the hut door, z **−8.5** |

## 2. The door panel drawn open but colliding

The grid's ring tiles carry only baked props, so the hut's door panel was never drawn in the grid while its collider
stood in the doorway. `src/game/grid/neighbourPanels.ts` draws each neighbour's declared panels and shows each exactly
when its region has it standing. `door-board.jpg`: before (doorway looks open, collider on), after (the grey door drawn,
collider on), after with the door opened (panel hidden, collider off, the board drives in to the back wall at z −14.5).

## 3. Nalati's day key from its own level

On a region's first entry `regionLightSwap` now lights the page sky with the region's own level look
(`applyLevelLight`: key colour and intensity, hemisphere fill, environment intensity, fog sun tint and densities) before
its runtime builds, so Nalati's sky rig reads its own "day", and the page light is put back on leave.
`test/grid-region-light.test.ts`: the rig's day key equals Nalati's manifest values on a road-lit page sky.

## 4. Nalati's storm wind

`Wind.hold()` (`src/engine/world/steppeWind.ts`) holds the one wind's speed, heading, gusts, wander, target and the bridged
`windStrength` (its clocks keep running); `holdPageLight` holds it with the rest, so the storm stays in the region and the
road gets its wind back. Test: the storm inside, the road wind exactly back on leave, the storm back on re-entry.
