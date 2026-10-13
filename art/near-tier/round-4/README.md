# Near tier, round 4: the real tiers, the nearest cells, a finer ground (G342 / G369 / G371)

Boards: [`board-desktop.jpg`](board-desktop.jpg) and [`board-iphone.jpg`](board-iphone.jpg) (A beside B, one row a
view), and [`nalati-bake-before-after.jpg`](nalati-bake-before-after.jpg) (what the round-4 ground bake changed).
Every panel is a real canvas capture with a label band burned in: A / B, the view, the device, then **each cell's
drawn tier read from that frame** (`grid.state().cells[].shows` and `drawn`). Build `6018bba` (a clean HEAD export),
`scripts/capture-main-menu-hero.mjs --round=near --enter`, labelled by `scripts/near-tier-board.py`.

- **A** is Debug > Look > Neighbour detail A: the far proxies, as shipped (still the default).
- **B** is Neighbour detail B: the near tier. It is not in the public build.

## Round 3's "far proxy everywhere" was the readout, not the render

Round 3's `capture.json` said `shows: 'far proxy'` for every neighbour in A and B. That field only asked whether a cell
had anything resident; it never looked at the near tier. It now reports what draws: `playing` (entered), `near`,
`far proxy`, `tiles` (only L1 / L0 ring tiles) or `loading`, plus which meshes are visible (`drawn.far`, `drawn.near`,
L1 / L0 tile counts). On a HEAD build with the round-3 bakes, **every B cell with a near placeholder read
`far: false, near: true`**: the far terrain was hidden and the dense near ground drew. What Jake saw as low poly in
round 3 was the near ground itself (fixed below), not the far mesh underneath (`97bd944c2`, `8e2e24d7a`).

## Near cells by distance to the eye (G371)

The near tier now ranks cells by distance from the drawn camera to each cell's square, diagonals included, keeps the
four nearest within one grid pitch, passes over cells with no near placeholder, and holds a drawn cell against a
newcomer less than 15 m nearer. A free or hero camera plans from where it looks, not from the player's feet. On the
shipped hero (SQ-NA-a, over Nalati) **Pine is now near (431 m, diagonal)**; round 4 of the hero had it as a far proxy.
Generic: no slug, no per-shard table (`src/game/grid/nearPlaceholderPlan.ts`).

## Round 4's ground: Nalati's hills and mountains (G369)

The near ground's reduction now also weighs each vertex's colour and normal, so painted patches, snow lines and ridge
turns keep their vertices instead of smearing across big triangles (`043a96789`, `src/sdk/bake/nearPlaceholder.ts`,
every shard). All four cells stay under the 8.5 MB line, four at most 26 MB on the `near` line (1.0 GB envelope):

| Cell | Ground triangles (round 3 → 4) | Props kept | Resident |
| --- | --- | --- | --- |
| Nalati | 27.4k → 60.6k | 42.2k (all) | 7.97 MB |
| Pine | 20.4k → 36.6k | 40k → 32k (trees untouched) | 8.45 MB |
| Driftwood | 16.1k → 38.8k | 47.2k | 8.33 MB |
| Template | 12.5k → 13.4k | none (its world is its L1 / L0 tiles) | 1.19 MB |

From the roundabout the change is real but modest (see the before / after): the slopes keep their colour banding and
facets; the height field itself (~2 m) is the limit on the hills' shape. Still open for round 5: the tall grey cliff
where Nalati's mountains meet its cell edge (the boundary face), and a finer surface than vertex colour.

## Each panel's tiers

Names: Signal = sunscar-dunes, Sky Reach = far-reach. Distances are from the eye to the cell's square (0 m: the
road-view eye stands just inside that cell's corner).

| Panel | Entered | Near | Far proxy |
| --- | --- | --- | --- |
| A, every road view (iPhone, desktop) | – | – | all nine (template also draws 8 L1 / 4 L0 tiles) |
| B, every road view (iPhone, desktop) | – | Pine, template (+8 L1 / 4 L0), Driftwood, Nalati | Signal, Sky Reach, Blender tmpl, Pastel, Ink-cel |
| A-SQ-NA-a-desktop (shipped hero pose) | Nalati | – | the other eight |
| B-SQ-NA-a-desktop | Nalati | Pine 431 m, template 305 m, Driftwood 305 m | Signal, Sky Reach, Blender tmpl, Pastel, Ink-cel |
| A-SQ-NA-a-iphone | – | – | all nine |
| B-SQ-NA-a-iphone | – | Pine, template, Driftwood, Nalati | the other five |

The iPhone hero panels are not entered: the phone-tier entry from 300 m up times out (240 s) in this capture, so on
the phone Nalati draws its near placeholder, as its label says.
