# Grid round 25: open plot demos (G198, after round 24 B)

**Question:** on the public INFINITE WILDSHARD 3 × 3, which way should an open plot show what a player could build there?
Jake on round 24 (`art/grid/round-24-open-plot/`): *"B but I need 5 other variants to see cool half implemented demos I
need some billboards with images of what other people could build"*. So every variant keeps B's surveyed plot (the cyan
border line, the four white-and-orange corner beacons with cyan sky beams, the surveyor's sign on striped posts at the
end of the entry stub) and adds pictures and half-built demos of shards someone could build. The shard ideas are drawn
from `docs/design/mmo/SHARD-IDEAS.md`, `docs/design/mmo/research/art-style-expressiveness.md` and
`art/grid/round-19-art-styles/` (neon night town, pastel alien plain, ink valley, sky archipelago, desert ruin).

No string promises an upload button: there is none (singleplayer). Every frame is the plot's entry, road level, iPhone
portrait, with today's road HUD (PAUSE, fps, coins, minimap, quest chip, HOVER, DRAG TO MOVE, SAFE ZONE, dimmed ATTACK).

| file | what it shows | exact in-world strings |
| --- | --- | --- |
| `board.jpg` | the pick board: B (round 24, for comparison), D, E / F, G, H | (board annotation only) |
| `D-roadside-billboards.jpg` | **D, roadside billboards**: four big billboards on steel legs along the plot's border line, two each side of the stub, each a full picture of a different shard with a caption bar | sign: "THIS PLOT IS YOURS TO BUILD" / "WHAT WOULD YOU BUILD?"; captions: "NEON NIGHT TOWN", "PASTEL ALIEN PLAIN", "SKY ARCHIPELAGO", "INK VALLEY" |
| `E-hologram-blockout.jpg` | **E, a hologram blockout loading in**: a neon night town rising over the void behind the sign; the bottom is finished low-poly with lit neon, the middle grey blockout boxes, the top only cyan wireframe edges, a cyan scan plane at the seam, a few wireframe cubes drifting up; half the footprint is still bare grid | sign: "THIS PLOT IS YOURS TO BUILD" / "BUILT WITH CLAUDE CODE + THE WILDSHARD SDK"; label: "DEMO · NEON NIGHT TOWN" |
| `F-holo-card-gallery.jpg` | **F, a gallery of floating holo cards**: an arc of five portrait picture cards in navy-glass frames with cyan brackets hovering over the void, the centre card biggest (the one the slow cycle is showing), a header line above | sign: "THIS PLOT IS YOURS TO BUILD" / "500 × 500 M · 4 ENTRIES"; header: "WHAT WOULD YOU BUILD?"; cards: "DESERT RUIN", "INK VALLEY", "SKY ARCHIPELAGO", "NEON NIGHT TOWN", "PASTEL ALIEN PLAIN" |
| `G-diorama-plinth.jpg` | **G, a diorama on a plinth**: a slice of an ink / cel valley cut out with soil-layer sides (shrine gate, stone path, stream and a waterfall pouring off the edge, two trees, a stone lantern) on a hexagonal plinth with a cyan edge, four small survey stakes with rope around it, real 3D you can walk round | sign: "THIS PLOT IS YOURS TO BUILD" / "500 × 500 M · 4 ENTRIES"; plaque: "SAMPLE SLICE · INK VALLEY" / "BUILT WITH CLAUDE CODE + THE WILDSHARD SDK" |
| `H-showroom.jpg` | **H, a showroom mix**: one big billboard on the left (a pastel alien plain), a half-built desert ruin corner on the right (finished sandstone arches and a half-buried head on a sand patch, fading back into grey blocks and cyan wireframe), B's sign in the open middle | sign: "THIS PLOT IS YOURS TO BUILD" / "BUILT WITH CLAUDE CODE + THE WILDSHARD SDK"; billboard: "WHAT WOULD YOU BUILD?" / "PASTEL ALIEN PLAIN"; label: "DEMO · DESERT RUIN" |

## Cost on the iPhone

All of it is cheap, and it only needs to exist near a plot (distance-culled past ~600 m; the beacons' beams stay as the
far marker).

- **Billboards and cards (D, F, H) = textured quads.** One instanced draw for every picture in a plot (UV offsets into
  one KTX2 atlas, e.g. 2048² ASTC ≈ 5.5 MB GPU with mips for 4–5 pictures) plus one instanced draw for the frames and
  legs. F's cycle only moves UV offsets on a timer: no new textures, no video.
- **Holograms (E, H's back half) = instanced lines.** The wireframe is one `LineSegments` draw (a few thousand
  segments, additive, unlit); the grey blockout is one instanced box draw; the scan plane is one transparent quad.
- **The finished parts (E's bottom, G, H's front)** are ordinary kit meshes: one draw per material, ~20–50k triangles a
  plot. G is the dearest (a real slice with water) but is still one small static piece with colliders.
- The pictures are generated stills (codex / Qwen) and ship like any texture; they need no new engine code.

## Recommendation: H, the showroom mix

- It answers both halves of Jake's ask in one plot: a billboard with a picture of what someone could build, and a
  half-implemented demo that is real 3D you can walk up to.
- B's sign stays in the open middle, so the plot still reads as surveyed and empty, not as a finished shard.
- It is one quad, one line draw and one small kit corner per plot. Each of the three open plots can show a different
  pair (W: desert ruin + pastel plain, S: sky archipelago + ink valley, NE: neon town + desert ruin), so walking the
  ring shows six ideas, not one.
- Runner-up: **E** if the plots must also read from far away (the sky-down reveal, the pier): the wireframe town is the
  biggest silhouette on the board. D and F are pictures only (no half-built demo); G is lovely up close but tiny from
  the road and the dearest to build.
- Words: "THIS PLOT IS YOURS TO BUILD" is B's line, kept because Jake leaned to B (round 24 noted it slightly
  overpromises building *here*). If that matters, swap it for "OPEN PLOT · BUILD YOUR OWN SHARD" (round 24 A).

## Notes

- Source: `art/grid/round-24-open-plot/B-survey-stakes.jpg` (built on `art/grid/round-21-refused-cell/a-void.jpg`, a
  real road-level capture with today's road HUD; its HUD matches `progress/shard-platform/grid-hud/safe.jpg`). No new
  browser session.
- Finals: codex `image_gen` edits of that frame, 851 × 1848 JPEG. **Re-rolled:** D (take 1 garbled the small caption to
  "PASTEL ALTEN PLAIN"; take 2 is clean but had pushed the bottom HUD band ~32 px down, so the bottom 470 px, road and
  HUD, were blended back from the source frame; its crosshair still sits ~30 px low) and F (take 1 moved HOVER ~80 px
  down; take 2's HUD is true, and HOVER covers the "D" of "DESERT RUIN" as the real HUD would). E, G, H are first takes.
- Mockup liberties: the shard pictures and demos are invented; G's slice reads more cel-shaded than ink-outlined; nothing
  here is built.
