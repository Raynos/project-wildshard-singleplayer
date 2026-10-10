# op-look28: every shard in the grid against SHARD SELECT, Nine's leftovers, SF23's wall check (SF63 / SF23, E435, 2026-10-10)

Successor of op-look25 (`../look25/README.md`). All captures: HEAD `68af12049` DEVSERVER build (`serve-build.sh --head
--devserver`), muted Metal iPhone 16 Pro portrait, phone tier, 2×, Developer on, Memory saver on. Every shot ran outside
a `.git/quiet` window (one run that a window opened under was killed and rerun).

`capture.mjs` is op-look25's with three changes: it hides the grid's Developer memory card before each shot, takes
`<standalone slug>:<cell slug or instance>` (the template's cell is `template-2`), and `NINE_DUMP=1` reads Nine's shared
uniforms, kit meshes, scene fog / camera / renderer and four materials into the readout (`PROBE=2` toggles every page
effect, composer pass and top-level scene group one shot at a time; `PROBE=3` shoots with the scene fog off).

## Gap 2: every shard in the grid against SHARD SELECT

Boards `<slug>-board.jpg` (SHARD SELECT · A row off · B row on, same local pose), readouts `shards-capture.json` and
`nine-capture.json`. 0 page errors, 0 console errors, every grid route clean.

| shard | verdict |
|---|---|
| Driftwood Isle | Same picture in A and B. |
| Pine Hollow | Same scene. The grid's page chain grades it a little darker and more contrasty, with no god rays (standalone runs GodRays 0.9). The frame's grade. |
| Nalati Grasslands | Same scene. The grid adds the frame's grade and the neighbours' far proxies beyond the cell (grey cliffs on the left horizon). By design. |
| Sky Reach | Standalone has its sunset sky and golden light. The grid has the one grey grid sky, the cyan void-edge curtain behind the windmill and pink neighbour proxies. That is the SF19 one-sky decision, so it is a taste call. |
| Signal Dunes | Standalone has its dusk / night sky. The grid has the daylight grid sky and sun. A dark strip at the left horizon in A and B is not traced (the void edge or a seam). |
| Nine Dragon | B matches standalone, see below. The weapon differs (the grid loadout's wooden sword, not the Jian and Fei Zhua): that is equipment, not look. |
| Template | **Not compared:** `?chunk=template` boots Driftwood's pier and quest (pose and picture are Driftwood's), so SHARD SELECT has no template shot. The grid's `template-2` cell is the grey-box template. |

No generic look bug turned up to fix (G294). What remains are the frame's design choices (one sky, one sun, the page
grade, neighbours visible), so Jake gets these boards as they are.

## Nine Dragon leftovers: no build difference to trace

- **The blade signs and cables were never missing.** In op-look25's grid shots, the grid's Developer memory card
  ("MEMORY · ALL LOADED 880 / 1000 MB …") sat exactly over them. `nine-signs-under-card.jpg` shows SHARD SELECT, grid B
  with the card, and grid B with the card hidden: the pink and cyan blades and every cable are drawn. The kit
  readout agrees: `kit:blades` and the neon / signs meshes are visible, one draw each, in all three shots.
- **The haze is gone at HEAD.** The readout puts Nine's shared uniforms in the cell (bands, fog, light volume, uCam
  (0.95, 126.7, 7.5), uNear 0.08) equal to SHARD SELECT. B now differs only in `uRootAt`, the time, and `fog*`, which are
  the engine fog's (Nine's materials have `fog: false`). Tile luminance (10 × 4 % tiles over the upper half, outside the HUD)
  matches standalone within ±3 levels. The far-left towers are rgb (121, 125, 138) in B against (121, 124, 138)
  standalone. The scroll and gate match too.
  What op-look25 saw was the candidate before `a1dd56dd4` landed, plus the card. Still slightly different in B: the wet
  floor is less saturated (HSV sat 71 against 90), the tree is a little darker and the stall steam a little denser.
  This is the page chain left round the composite (Bloom, Vignette, CA, HueSat, Grade, GradeLook, GridFrameGrade at 1).
  A (row off) stays bluer and hazier, which is expected: it runs the engine chain instead of Nine's composite, and its
  culler and line widths never run, so every facade LOD-0 copy draws.
- No change to `world/build.ts` is needed.

## Gap 3, SF23: the far skirts and G90's retaining walls

`wall.mjs` (op-look25's; it now skips the border shimmer line and the curtain, which also stand in the edge plane, and takes
`MIN_H`) and `seamscan.mjs` scan every page mesh for faces in a cell-edge plane (27.5 m off a road centre line). In the
grid as it boots, no seam mesh has one: no retaining wall, parapet or cliff face anywhere (`wall.json`: 0 faces ≥ 1 m).
The only faces are the far proxies' own skirts, the border shimmer line and a 0.7 m Driftwood deck lip. The SF51 entry
decks and forecourts put every cell edge at road height, so there is no wall for a skirt to hide. With `64865a3c1`'s 3 m
inset on top of that, **the open item is stale: closed, nothing to fix.**

## Not done

- The template has no SHARD SELECT comparison (`?chunk=template` falls back to Driftwood).
- Signal's dark horizon strip in the grid is not traced.
