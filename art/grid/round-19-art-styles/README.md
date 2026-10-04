# grid / round-19-art-styles: material graphs, what SF59 must prove (G155–G158, ask E449 M6)

**Question: add one of these as SF59's stress case?** SF59 adds material graphs, a lighting-model stage and per-shard
post effects before SHARDFILE_VERSION 1 freezes. G158 makes a shard own the whole frame inside its cell (sky, sun, fog,
lighting, exposure, post), with the neutral road look outside it. The research
(`docs/design/mmo/research/art-style-expressiveness.md` §4) says most of the shard ideas only fit with graphs plus a
shard-owned frame. These are three of them as grid shards, each shown twice: from inside its cell (it owns the
frame) and from the boulevard looking in (the road owns the frame). Each frame is iPhone portrait with today's HUD. The
inside frames carry an invented shard accent (magenta, lilac, vermilion). The road frames show "SAFE ZONE", a dimmed
ATTACK, a green distance sign and the cyan shimmer line at the cell border.

| File | What it shows |
|---|---|
| `board.jpg` | The pick board: A / B / C across, inside on top, road below |
| `A-town-night-inside.jpg` | **A, "Harbor Nights", a GTA-style photoreal town at night**: wet asphalt mirroring neon ("MOTEL", "DINER"), sodium lights, bloom halos, steam, a teal / orange night grade. Quest "LAST CALL \| DINER 86 M" |
| `A-town-night-road.jpg` | A from the road: the same town at noon under the road light; the neon tubes are lit but flat, with no bloom, no night grade and no wet reflections. Sign "HARBOR NIGHTS" |
| `B-pastel-plain-inside.jpg` | **B, "Lilac Plains", a No Man's Sky style pastel alien plain**: mint-and-pink grass, coral mushroom-trees with glowing spots, spiral ferns, glass pods, yellow crystals, a ringed planet in a peach-to-violet sky, lilac fog, a grazing six-legged creature. Quest "STRANGE SPORES \| BLOOM 140 M" |
| `B-pastel-plain-road.jpg` | B from the road: the flora keeps its colours, but with no planet sky, no fog and no grade it looks like odd props in ordinary daylight. Sign "LILAC PLAINS" |
| `C-ink-valley-inside.jpg` | **C, "Inkwell Vale", an ink / cel-shaded valley**: bold ink outlines, flat two-tone cel bands, a cream paper sky with an orange sun disc, a shrine gate, a stream and a waterfall, paper grain. Quest "THE INK SHRINE \| SHRINE 210 M" |
| `C-ink-valley-road.jpg` | C from the road: the flat cel colours stay (they live in the materials); the outlines, the paper grain and the cream sky go (they are the shard's frame and post). Sign "INKWELL VALE" |

**What the road frames assume.** They read G158 as "the road light over everything outside the cells", which is M2's
variant A (`art/grid/round-17-road-view/`). If Jake picks another road view there, only the bottom row changes. The
row exists because it shows which parts of a look are **material** (they survive outside the cell: albedo, emissive,
in-material cel bands, vertex sway) and which are **frame** (they don't: sky, fog, grade, bloom, outlines, paper).
SF59's graph format and post list have to draw exactly that line.

**Recommended: C, the ink / cel valley.** It is the one case that needs all three new pieces at once: the
lighting-model stage (cel bands are a custom N·L ramp), the post catalogue (ink outline and paper grain), and the frame
switch at the cell edge (the outlines must blend off at the border, the clearest visible test of G158). It is also
cheap on the phone (no reflections, few lights), so a failure points at the format and not at raw GPU cost. A mostly
tests engine systems that the research keeps outside the shard tiers (screen-space reflections, many local lights,
heavy bloom) and is the riskiest at 2× render scale on the iPhone. B is nearly reachable with today's families plus a
sky and a grade, so it proves little.

**How they were made** (ask E449, 2026-10-04): codex `image_gen`, one take each. The inside frames edited the real
capture `progress/shard-platform/grid-hud/pier.jpg` and the road frames edited `progress/shard-platform/grid-hud/safe.jpg`
(both iPhone portrait with today's HUD). No re-rolls: no garbled text or HUD drift. Known drift: C-inside reads more
like a hand-inked illustration than a real-time frame; in C-road the turn-in reads as the boulevard running straight
into the cell. The shard names, accents and quests are invented for the mockup. Frames are 1024 × 1536 JPEG. These are
mockups only: nothing here is built.
