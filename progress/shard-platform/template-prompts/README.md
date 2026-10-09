# template-prompts: a template copy's prompts in the grid, and the minimap's neighbour names (E435)

**1. Prompts in a template copy.** grid-interact (`2a432fe48`) gave an entered *runtime* cell its prompts; a template copy
(a shardfile sim, every neighbour of the public grid, G233) still had none, so the grey hut's door could not be opened in
any copy. Now `src/game/grid/copyPrompts.ts` turns the copy's declared interactions (`targets.interactions`, the same rows
standalone installs through `installDeclaredTargets`) into prompts at admission (`LiveGridSession.admit`, on the final
region after a restore), in the region's frame, each running its scene on the copy's **own** script lane for its player
actor. So the door field, its collider (the region's `targets.declared` step) and the drawn panel (`NeighbourPanels`) move
exactly as standalone. `LiveGridSession.interactables()` offers them only while the feet stand in the entered copy
(`enteredCopy`: the live frame = the feet's cell = an admitted copy), else the entered runtime's (unchanged), else nothing:
one cell at a time, so a seam never shows two cells' prompts; they go with the region's disposal. Item scenes (the
lantern's toggle / refill) stay off: a template cell holds bare hands (G68). The standalone template offers no other
prompt: its list read in a standalone boot is `["Open hut door"]` (its loot is the coin purse).

**2. The minimap label.** The minimap has no name of its own; the only text it draws is G107's neighbour NAME across the
road (`minimapBlend.ts`). It showed from 140 m out, pinned to the disc's rim, so 60–140 m from a road "DRIFTWOOD ISLE" sat
under the N tab like the minimap's title for the cell you were in (Sky Reach in `grid-interact/islet-centre-after.jpg`,
every template copy). Now the name shows only while its spot across the road (12 m onto the neighbour's ground) is inside
the disc: it reads as the shard across the road, never as a title. The Bag ▸ MAP header and pause subtitle already follow
the cell (`80299e0bf`); the entry title card is G82's. Adding a minimap name for the cell you are in would be a new HUD
element (E332: Jake's pick first).

## Receipts: public grid, Developer saved OFF (pre-release grid intent), iPhone 16 Pro, muted, real held input

`tp.mjs`: Driftwood → template-1 (frame-floor route), stand 2.2 m from the hut door, tap USE, walk into the hut, walk back
to the road. Before = HEAD `351cd2e36`; after = that + this change.

| step | before (WebKit) | after (WebKit and Chromium) |
|---|---|---|
| at the door | prompt `""`, no USE band | `[E] Open hut door`, USE band "Open hut door" |
| tap USE | `template.door.open` 0, door collider on | `template.door.open` 1, collider off, panel hidden (`after-*-2-door-open.jpg`) |
| walk into the hut | stopped at the door, z 546.5 | arrived inside, z 543.2 |
| quest (the copy's own) | hut → blob (region trigger) | hut → blob |
| back on the road | prompt `""` | prompt `""`, 0 page errors |
| minimap 155 m into the copy (122 m from the road) | "DRIFTWOOD ISLE" pinned to the rim | no label |
| minimap at the south entry (47 m from the road) | "DRIFTWOOD ISLE" pinned to the rim | "DRIFTWOOD ISLE" across the road |

Public witness: `publicGridWitnessFailures` = [] (Developer off, Driftwood + template copies only). Raw: `tp-*.json`.

Unit: `test/grid-template-prompts.test.ts` (the real template sim as a copy at template-1's render origin: the door prompt
in frame, USE toggles field + collider, the quest step; copy vs runtime cell vs a seam vs the road vs a disposed copy; the
neighbour label never past the rim). Gates on the candidate: boot smoke PASS (Driftwood, Pine, grid incl. E463), WebKit
render smoke PASS, full vitest on a clean export 960 files / 5453 tests passed, `physics-baseline --mode=walk` 63 legs, 0 stuck.
