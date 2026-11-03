# New unique open plots: mini plan (E522, G970–G973)

**State:** `open` (grilled 11-02 ~23:20, G974 / G976: art builds start after SHARD-PLATFORM archives; grid data rows now); was `draft` 2026-11-02 for Jake. Four themes to approve, one spare; mockups made (round 1). Nothing built.
The grid is not edited by this plan's draft.

Jake, 2026-11-02 ~22:55 Cancun (G970): *"I don't understand why Lantern Bayou is in there twice. I thought we had
enough unique open plots. If we don't have enough unique open plots for the 5x5 grid, use a subagent to come up with
however many new open plots we need to have unique open plots. I don't want to have any duplicate open plots on the 25
shards in the 5x5 grid."*

Then (~23:05, G971–G973): *"There's no play loop … There's no quest, verb, or encounter … I just want it to be
graphically better than Night Market."* · *"Nine Dragons should be permanently integrated in developer mode and in
public mode. I don't want two different grids."* · *"Showcase template is going to come later … For the five new plots,
you just need to come up with a theme and some mock-ups."*

Sibling: [build-out-mini-plan.md](build-out-mini-plan.md) (the per-plot pipeline; another lane is writing it).
Parent: [OPEN-PLOTS](../OPEN-PLOTS.md) (parked). Read at HEAD `d795fa9dfe`.

## 1. Why Lantern Bayou was there twice

You were right that we had enough ideas. On 10-23 you picked five new open plots (G653: Jungle Ziggurat, Patchwork
Fairground, Saltwind Lighthouse, Mushroom Hollow, Fossil Badlands) and approved their round-62 palettes (G714). They
were never put on the grid: OPEN-PLOTS' unasked Question 5 recommended keeping the repeats until each new plot was
built, so `grid.cells` still holds the 14 old ideas, five of them twice. This plan takes your five G653 themes,
sharpens each so it overlaps no existing plot or centre shard, makes fresh hero mockups at the new bar ("graphically
better than Night Market", G971), and puts four of them on the grid now; the fifth is the spare.

## 2. The duplicates

`src/game/grid/singleplayer.json` `grid.cells` today: 25 cells, 19 open-plot cells, 14 unique slugs.

| Idea | Kept cell | Second cell | What happens to the second cell |
|---|---|---|---|
| Lantern Bayou | (-2,-1) | (1,-1) | **Nine Dragon**, permanently, for everyone (G972); `grid.developer` is deleted |
| Night Market | (-1,1) (the built plot) | (-1,-2) | **Saltwind Lighthouse** (new) |
| Ember Forge | (2,-1) | (-2,0) | **Patchwork Fairground** (new) |
| Mosslight Ruins | (2,0) | (-2,1) | **Fossil Badlands** (new) |
| Frostline Peaks | (-1,-1) | (-2,2) | **Mushroom Hollow** (new) |

Showcase Template (0,2) stays for later (G973). G972 also takes blender-template, pastel-plain and ink-cel-valley off
the grid (they were Developer swaps at (-1,-1), (-2,0), (2,0)). After this plan: 18 open plots, each once, plus the seven
shards Driftwood, Pine Hollow, Template 2, Sunscar Dunes, Nalati, Far Reach and Nine Dragon.

## 3. The five themes

Graphics only (G971): theme, identity, signature landmark, look, dressing and audio. No play loop, quest, verb or
encounter. Each keeps its own look (AGENTS.md). Accents are the free slots of `src/game/grid/catalogue.ts`.

### 3.1 Saltwind Lighthouse (`open-plot-saltwind-lighthouse`, accent `rose`) → (-1,-2)

**Pitch:** a storm-grey fishing headland where a red-and-white lighthouse sweeps its beam through the rain.

- **Theme:** a North-Atlantic fishing village on a granite headland, at low tide in a passing squall. The only cold,
  wet, working coast on the grid; Coral Drift is the tropical lagoon, Driftwood the toon beach.
- **Look:** slate grey, wet granite, whitewash, signal red, deep sea green, ochre lichen. Late-afternoon storm light
  with one silver break on the sea, slanting rain, wet reflective stone. Stylised maritime, chunky shapes.
- **Landmark:** a tall red-and-white lighthouse on a raised headland; a warm lantern room and a visible beam.
- **Dressing:** cobbled quay, curved harbour wall and bollards, tidal flats with two boats leaning on the sand,
  terraced whitewashed cottages with slate roofs, drying nets, lobster pots, buoys, slipway, boathouse, sea thrift, surf.
- **Audio:** rain on slate, gulls, rigging creak, a far foghorn; a low fiddle-and-drone ambience.
- **Kit reuse:** houses (retinted whitewash and slate), bridges (quay), props (crates, rope), the shared water.
  New hero families: lighthouse, harbour wall, beached boat, net rack.

### 3.2 Patchwork Fairground (`open-plot-patchwork-fairground`, accent `citron`) → (-2,0)

**Pitch:** a travelling fair at bright noon, pitched on a quilt of coloured meadows under a giant Ferris wheel.

- **Theme:** a storybook travelling fair. The grid's one bright, cheerful noon of candy colour; Night Market is the
  dusk street market of stalls and lanterns, this is rides and tents in daylight.
- **Look:** candy red, butter yellow, mint, sky blue and cream stripes on green grass and pale gravel; the fields around
  it a patchwork of green, gold, lavender and clover stitched by hedges. Clear cornflower sky, crisp short shadows.
  Toy-like storybook stylisation, no grime.
- **Landmark:** a giant Ferris wheel on a raised round platform, gondolas in alternating colours.
- **Dressing:** gravel midway of striped booths and painted caravans, a carousel, a helter-skelter, a big top, bunting,
  hay bales, picket fences, a steam-organ wagon, a duck pond with a footbridge, a tea tent.
- **Audio:** a distant band organ, carousel bells, flags snapping in the breeze; a bright waltz-time ambience.
- **Kit reuse:** stalls and strings (bunting), props, bridges, trees. New hero families: Ferris wheel, carousel,
  helter-skelter, big top.

### 3.3 Fossil Badlands (`open-plot-fossil-badlands`, accent `apricot`) → (-2,1)

**Pitch:** a dig camp in striped clay badlands, digging out a colossal dragon skeleton.

- **Theme:** a natural-history expedition in eroded clay badlands. Not a desert: no dunes, no palms, no sandstone
  temple (Sunscar Dunes and Desert Ruin own those). Hard banded rock, scrub and canvas.
- **Look:** mesas, buttes and hoodoos in bold bands of terracotta, cream, rust and lavender-grey; sage scrub; bone white
  and canvas khaki. Soft overcast pearl sky with a low warm glow. Chunky layered rock forms.
- **Landmark:** a colossal bone-white dragon skeleton half dug out of a pit, spine and ribs arching high, scaffolding
  and ladders against the ribs.
- **Dressing:** plank boardwalks, terraced trenches with string grids, expedition and mess tents, sorting tables,
  sieves, wheelbarrows, a hand crane lifting a plaster-jacketed bone, a lab hut, mine-cart rails into a mesa.
- **Audio:** dry wind through hoodoos, trowel scrape, canvas flap, a far hawk; a sparse guitar-and-marimba ambience.
- **Kit reuse:** props (crates, barrels), bridges (boardwalks), strings (tent lines). New hero families: dragon skeleton,
  banded mesa pieces, dig scaffolding, expedition tents.

### 3.4 Mushroom Hollow (`open-plot-mushroom-hollow`, accent `orchid`) → (-2,2)

**Pitch:** a fairytale village at night under giant glowing toadstools, crowned by a toadstool tower.

- **Theme:** a storybook woodland village lit by its mushrooms. Not alien: no crystals, aurora or monoliths (Alien Plain
  owns those); not a ruin (Mosslight).
- **Look:** navy and indigo night, a starry sky and a crescent moon; magenta and pink caps glowing from beneath, teal
  glowing moss, warm cream windows, drifting spores. Rounded soft fairytale shapes.
- **Landmark:** the toadstool tower: a house in a thick cream stem with round windows and a spiral stair, under a huge
  glowing magenta cap with white spots.
- **Dressing:** a mossy cobbled lane, cottages in mushroom stems with round doors, clusters of smaller caps, a fallen-log
  bridge over a glossy stream, ferns, roots, a well, little gardens, a fairy ring in a clearing.
- **Audio:** crickets, a soft stream, tiny chimes as spores drift; a music-box and celesta lullaby ambience.
- **Kit reuse:** trees (retinted), bridges, props, the lantern light bake for the cap glow (no real lights). New hero
  families: toadstool tower, stem cottages, cap clusters, log bridge.

### 3.5 Spare: Jungle Ziggurat (`open-plot-jungle-ziggurat`, accent `jade`)

**Pitch:** a living temple-town in a misty rainforest, its painted step pyramid rising over waterfalls.

- **Why it is the spare:** it is the closest of the five to an existing plot (Mosslight Ruins' green overgrown stone,
  and Mosslight's hologram is a stepped jungle temple). It takes a cell only if you decline one of the four.
- **Look:** jade and emerald foliage, warm limestone with turquoise and saffron painted bands, red-ochre banners, white
  waterfalls, morning mist and god rays. Intact and lived in, never a ruin.
- **Landmark:** a tall clean limestone step pyramid with a central stair and a jade-roofed shrine on top.
- **Dressing:** a causeway over a jade pool, rope bridges between treetop platforms, thatched stilt houses, giant leaves
  and buttress roots, painted steles, water channels, flower terraces.
- **Audio:** rain-forest birds, falling water, wooden wind chimes; a hand-drum and flute ambience.

## 4. The grid after this plan

Rows are the cell's z (-2 at the top, the Far Reach side); columns its x. `*` = new; `[ ]` = shard.

```
 z\x |      -2          |      -1          |       0          |       1          |       2
-----+------------------+------------------+------------------+------------------+------------------
 -2  | Coral Drift      | *Saltwind Lthse  | Sky Race         | Desert Ruin      | Alien Plain
 -1  | Lantern Bayou    | Frostline Peaks  | [Far Reach]      | [Nine Dragon]    | Ember Forge
  0  | *Patchwork Fair  | [Sunscar Dunes]  | [Driftwood]      | [Nalati]         | Mosslight Ruins
  1  | *Fossil Badlands | Night Market     | [Pine Hollow]    | [Template 2]     | Clockwork Canyon
  2  | *Mushroom Hollow | Thin Ice         | Showcase Tmpl    | Starfall Obs.    | Sky Harbor
```

Why these neighbours:

- **Saltwind (-1,-2)** sits on the top edge beside Coral Drift: one coast in two weathers, turquoise calm next to grey
  squall. Sky Race (mint sky) and Frostline (snow) are its other edges; none is grey or wet.
- **Patchwork Fairground (-2,0)** is a bright noon between two dusks: Lantern Bayou's marigold swamp above, Sunscar's
  dusk dunes beside it. It replaces an Ember Forge copy that put a second warm night next to the dunes (G712's "too much
  orange glow").
- **Fossil Badlands (-2,1)** is an overcast day between the fair's noon and Mushroom Hollow's night, beside Night
  Market's dusk. It touches Sunscar only at a corner, so the two arid looks never share an edge.
- **Mushroom Hollow (-2,2)** is neon night beside Thin Ice's pale cyan noon. It replaces a Frostline copy that put snow
  beside snow.
- The west column becomes a run of four new worlds: noon fair, overcast dig, neon night, with the storm coast at the top.

## 5. Mockups (round 1)

`art/open-plots/new-unique-plots/round-1/`, codex `image_gen` (fidelity), each an edit of the in-game Night Market
aerial (RM9, `art/grid/round-68-night-market-gate/ingame-D1.jpg` panel 2) so the camera and engine look stay the game's.
One labelled iPhone-portrait board per plot (a hero view of the mini world and its landmark) and one overview board.
They set direction only; the build-out pipeline's dome mockups come later per plot.

| File | What it shows |
|---|---|
| `0-overview.jpg` | All five on one board: the four with the cell each takes, and the spare |
| `1-saltwind-lighthouse.jpg` | The quay in the rain, beached boats at low tide, the lighthouse beam over the sea |
| `2-patchwork-fairground.jpg` | The gravel midway from the road to the Ferris wheel; carousel, helter-skelter, big top, patchwork fields |
| `3-fossil-badlands.jpg` | The boardwalk through banded hoodoos and trenches to the dragon skeleton in its pit |
| `4-mushroom-hollow.jpg` | The glowing moss lane to the toadstool tower; stem cottages, log bridge, fairy ring |
| `5-jungle-ziggurat.jpg` | The spare: the causeway over the jade pools to the painted step pyramid |
| `README.md` | The prompts, to re-roll a theme |

All five came out on the first roll; none re-rolled. They read richer and more painterly than the engine renders today;
that is the target density, and each plot's build fixes its own style family (AGENTS.md) on its first board.

## 6. Rows

| Row | What | Lane | Done when |
|---|---|---|---|
| NU1 | **One grid (G972).** Delete `grid.developer` (and `devserver` if it only repeats Nine Dragon); Nine Dragon's cell row at (1,-1) replaces the Lantern Bayou copy in `grid.cells`. Folded into G972's own row if the coordinator already queued one | Codex | Developer on and off load the same 25 cells; Nine Dragon at (1,-1) for everyone; push gate green |
| NU2 | **Placeholder art for the four (Opus: the player sees it, G848).** `holo-subjects.tsv` rows from §3's landmarks; refs and Hunyuan3D-2 holograms (`gen-refs.sh`, `batch-holograms.sh`, `clay-review.mjs`) taking the round-1 mockup as the reference; `billboard.webp`, `sign.webp` and `thumbs/<idea>.jpg` from the round-1 mockups (`make-art.sh` given that source). Into `public/assets/open-plots/<idea>/` | Opus | Four holograms pass clay review; the art matches the other ideas' sizes (billboard ≤ 250 KB) |
| NU3 | **Data and grid swap.** Four `outputs.json` rows (slug, idea, name, accent, manifest overrides like the others); the four `grid.cells` slug swaps of §2 (instances keep their names); regenerate discovery and the registries that list every open-plot product (`scripts/source-generation-outputs.json`, `scripts/test-products.json`, `budgets/ceiling-sources.json`, `lint/ratchet.json` wire and custom-sections rows, `lint/custom-sections.json`, `lint/tile-bake-debt.json`). A grid test refuses a repeated slug in `grid.cells` | Codex, after NU1 and NU2 | 25 distinct slugs in `grid.cells`; the four new outputs build; the new test fails on a repeat; push gate green |
| NU4 | **No twin holograms.** Alien Plain's hologram is a glowing mushroom tree, which would read as Mushroom Hollow's twin on the grid. Re-roll it to its round-62 landmark, the alien monolith | Opus | Its new hologram passes clay review; no two holograms on the grid share a subject |
| NU5 | Saltwind Lighthouse, built (wave per the build-out plan) | Opus + Codex | The build-out pipeline's done-when; its hero views beat Night Market's and match round 1's direction |
| NU6 | Patchwork Fairground, built | Opus + Codex | As NU5 |
| NU7 | Fossil Badlands, built | Opus + Codex | As NU5 |
| NU8 | Mushroom Hollow, built | Opus + Codex | As NU5 |
| — | Jungle Ziggurat stays a spare: no work unless Jake swaps it in for a declined theme | — | — |

Order: NU1 ∥ NU2 → NU3 → NU4; NU5–NU8 join the build-out plan's waves (look and models Opus, data and captures
Codex, G848). NU5–NU8 replace OPEN-PLOTS rows OP7, OP8, OP9 and OP21 for these ideas; OP13 (Jungle Ziggurat) waits with
the spare.

## 7. Questions for Jake

One panel, four questions, option 1 always "Skip for now". Showcase Template (G973) and Nine Dragon (G972) are already
ruled, so they are not asked.

1. **Saltwind Lighthouse at (-1,-2)?** 1 Skip for now · **2 Yes, as mocked up (rec)** · 3 Use the spare, Jungle
   Ziggurat · 4 A new theme. *Why: the grid's only cold, wet coast; it sits beside Coral Drift as the same sea in a storm.*
2. **Patchwork Fairground at (-2,0)?** 1 Skip for now · **2 Yes (rec)** · 3 Use Jungle Ziggurat · 4 A new theme.
   *Why: the grid has no bright, cheerful noon; it breaks up two dusk neighbours.*
3. **Fossil Badlands at (-2,1)?** 1 Skip for now · **2 Yes (rec)** · 3 Use Jungle Ziggurat · 4 A new theme. *Why:
   banded clay and a dragon skeleton read nothing like the dunes or the ruin; it touches Sunscar only at a corner.*
4. **Mushroom Hollow at (-2,2)?** 1 Skip for now · **2 Yes (rec)** · 3 Use Jungle Ziggurat · 4 A new theme. *Why: a
   fairytale night beside Thin Ice's bright noon; it replaces snow-next-to-snow.*

A skipped question stays `needs pick`; lanes build the recommended answer meanwhile (G872).
