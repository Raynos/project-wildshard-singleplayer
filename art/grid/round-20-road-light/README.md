# round-20-road-light: road light over everything, built (G165)

Jake's pick G165 (E449 M2, `art/grid/round-17-road-view/board.jpg`, A): outside the cell you stand in, everything is
under the neutral road look, sky included; a shard's own sky shows only once you are inside it.

Before this, SF19a's frame owner already put the road's air and G75 grey-blue grade on the road, but the sky over the road
was still the home shard's (Driftwood's stylized dome and faceted clouds). Now the frame hangs a road sky on the road
owner (`src/game/grid/roadSky.ts`): one camera-centred dome in a calm grey-blue whose horizon is the frame's air. It draws
over the home look's sky pieces and under every world transparent, depth-tested, with the road's frame weight as its
opacity: full on the road, gone inside a cell, blended across the 16 m cell-edge band. It sits behind Settings ▸ Debug ▸
"Grid one frame", which stays off until Jake's yes on SF19b.

Real captures: a working-tree build, INFINITE WILDSHARD (Developer on), iPhone 16 Pro portrait, phone tier, muted,
browser lane (`capture.mjs`; the frame readout per shot is in `frames.json`).

## Board: `board.jpg`

| Row | Pose | ON readout |
|---|---|---|
| On the road, looking south | the east boulevard below the Driftwood / Nalati crossroads | road weight 1, road sky 1 |
| Over the road | 60 m up, looking south-west over Driftwood's cell | road 0.91, road sky 0.91 |
| Inside Driftwood, looking east | 60 m inside the cell | Driftwood owns the frame, road sky 0: its own sky |

Left column: one frame OFF (today). Right column: ON.

## Not changed

The key light and its shadows are still the home shard's sun on the road. The road look changes the sky, air and grade,
not the lighting rig.
