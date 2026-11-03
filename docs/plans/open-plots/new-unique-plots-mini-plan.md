# New unique open plots: mini plan (E522, G970–G973)

> **Re-pointed 2026-11-02 to the tile approach and the round-75 boards (G978).** Jake: *"We need the 2x2 mockup for …
> all the new open plot zones we just approved. Feel free to change the theme and style and colors … the open plots
> idea is for them to be blocky and symmetric … made out of tiles so that you can mix and match."* What changed: the
> four plots (Saltwind Lighthouse, Patchwork Fairground, Fossil Badlands and, after G977, Jungle Ziggurat) each have a
> round-62-style 2 × 2 board (above neighbour · road entry · top-down · plaza) in
> [`art/grid/round-75-new-plot-palettes/`](../../../art/grid/round-75-new-plot-palettes/), which replaces round 1 as
> the look target. Each has a new palette distinct from every other plot (§3), and each is built as the shared tile kit
> + its palette + ONE landmark + 2–3 theme tile variants in a mirror-symmetric 8 × 8 (build-out plan §2, G978), about
> 1.5 Opus + 0.5 Codex lane-days a plot. Mushroom Hollow is dropped (G977).

**State:** `open` (grilled 11-02 ~23:20, G974 / G976; **G977: Jungle Ziggurat replaces Mushroom Hollow at (-2,2), Mushroom Hollow dropped**: art builds start after SHARD-PLATFORM archives; grid data rows now); was `draft` 2026-11-02 for Jake. Four themes approved (G974, G977); round-75 2 × 2 boards made (G978). Nothing built.

**G981 / G982 (11-03 ~00:00):** the round-75 boards are approved; **Fossil Badlands moves to (-1,-2) and Saltwind Lighthouse to (-2,1)** (swapped so Fossil's lavender dusk no longer shares an edge with the Night Market's dusk). Patchwork Fairground (-2,0) and Jungle Ziggurat (-2,2) stay.

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
| Frostline Peaks | (-1,-1) | (-2,2) | **Jungle Ziggurat** (new; G977, was Mushroom Hollow) |

Showcase Template (0,2) stays for later (G973). G972 also takes blender-template, pastel-plain and ink-cel-valley off
the grid (they were Developer swaps at (-1,-1), (-2,0), (2,0)). After this plan: 18 open plots, each once, plus the seven
shards Driftwood, Pine Hollow, Template 2, Sunscar Dunes, Nalati, Far Reach and Nine Dragon.

## 3. The four themes (final, G977 / G978)

Graphics only (G971): theme, identity, signature landmark, look, dressing and audio. No play loop, quest, verb or
encounter. Each keeps its own look (AGENTS.md). Accents are the free slots of `src/game/grid/catalogue.ts`.

**Built from tiles (G978).** Each plot is a mirror-symmetric 8 × 8 of 62.5 m tiles: a cross of straight avenues, four
identical quadrants, ONE landmark on a square plinth at the centre. The tiles are the shared kit (paving, kerbs, lamp
posts, bridges, props, trees, water, gate, strings) retinted by the plot's palette row, plus the 2–3 **theme tiles**
listed below. A theme tile another plot can use lands in the shared kit. The look target is the plot's round-75 board;
the palette line below is burned into it. G978 sharpened every round-1 and round-62 look so no two plots share a
palette: the round-62 lines of the other plots and the centre shards were checked.

### 3.1 Saltwind Lighthouse (`open-plot-saltwind-lighthouse`, accent `rose`) → (-1,-2) · `04-saltwind-lighthouse.jpg`

**Palette (board):** *pewter squall, slate-green sea, whitewash and black tar, one red-banded light.*

- **Theme:** a northern fishing harbour on black basalt in a passing squall, late afternoon, one cold silver break on
  the horizon, slanting rain, wet reflective stone. The grid's only storm. Coral Drift is the turquoise lagoon and Sky
  Harbor the blue-sky timber docks; Saltwind has no turquoise, no sand, no blue sky, no timber docks or cranes.
- **G978 change:** black basalt and black tarred timber replace round 1's granite and ochre; the sea is slate green;
  the lighthouse is the only strong colour.
- **Landmark:** a white lighthouse with bold signal-red bands on a stepped basalt plinth; a cold white lantern room and
  a beam through the rain.
- **Theme tiles:** harbour-basin tile (square slate-green basin, basalt quay walls, bollards, two moored boats);
  cottage-terrace tile (a row of whitewashed black-roofed cottages); net-and-pot tile (drying racks, lobster pots,
  buoy posts). Corner boathouses are the cottage tile's variant; a basalt sea wall with surf closes the far edge.
- **Audio:** rain on slate, gulls, rigging creak, a far foghorn; a low fiddle-and-drone ambience.

### 3.2 Patchwork Fairground (`open-plot-patchwork-fairground`, accent `citron`) → (-2,0) · `03-patchwork-fairground.jpg`

**Palette (board):** *buttermilk morning, toy primaries on a clover, mustard and lavender quilt.*

- **Theme:** a toy-box travelling fair pitched on a quilt of square fields, a fresh morning under a warm buttermilk haze.
  Night Market is the dusk street market of stalls and lanterns; this is rides and tents in daylight.
- **G978 change:** toy primaries (tomato red, sunflower yellow, royal blue, white trim) replace round 62's candy pastels
  (pink, mint, baby blue), and the buttermilk sky keeps it off Sky Race's cobalt noon. The quilt fields are literal
  square tiles.
- **Landmark:** a giant Ferris wheel on a square plinth, white lattice spokes, gondolas alternating red, yellow, blue.
- **Theme tiles:** quilt-field tile (3 × 3 coloured field squares with box hedges and hay bales); carousel tile;
  big-top tile (corners). Striped booths, bunting and the helter-skelter pair at the entry are kit stalls and strings
  retinted, plus the helter-skelter as the entry gate's variant.
- **Audio:** a distant band organ, carousel bells, flags snapping; a bright waltz-time ambience.

### 3.3 Fossil Badlands (`open-plot-fossil-badlands`, accent `apricot`) → (-2,1) · `06-fossil-badlands.jpg`

**Palette (board):** *lavender blue hour, oxblood and mustard strata, bone-white skeleton.*

- **Theme:** a palaeontology dig camp cut into banded clay badlands just after sunset. Not a desert: no dunes, no palms,
  no sandstone temple (Sunscar Dunes and Desert Ruin own those), no orange sunset.
- **G978 change:** a lavender blue hour replaces round 1's pearl overcast and round 62's bone-and-ochre noon, and the
  strata are bold painted-hills bands (oxblood, mustard, cream, charcoal), so it reads nothing like Desert Ruin's
  white-gold noon or Sunscar's orange dusk.
- **Landmark:** a colossal bone-white dragon skeleton in a square stepped excavation pit, ribs arching high, timber
  scaffolding and ladders.
- **Theme tiles:** dig-trench tile (a square terraced trench with a string grid); banded-mesa tile (a flat-topped
  stepped block, edges and corners); camp tile (canvas tents, sorting tables, crates). Hand cranes and mine-cart rails
  are kit props.
- **Audio:** dry wind through the mesas, trowel scrape, canvas flap, a far hawk; a sparse guitar-and-marimba ambience.

### 3.4 Jungle Ziggurat (`open-plot-jungle-ziggurat`, accent `jade`) → (-2,2) · `02-jungle-ziggurat.jpg`

**Palette (board):** *rain-washed teal afternoon, cinnabar-red temple, jade pools, saffron bands.*

- **Theme:** a living, freshly painted Mesoamerican temple town just after a tropical rain: a teal sky clearing behind
  white cumulus, a faint rainbow, wet glossy stone. G977 took it off the spare list for Mushroom Hollow's cell.
- **G978 change:** to stay clear of Mosslight Ruins (grey-green overcast, ivy, glowing emerald), the temple is painted
  cinnabar red with turquoise and saffron bands, intact and clean; no moss, no ivy, no glow, no misty morning (round
  62's green mist is gone).
- **Landmark:** a stepped pyramid on the central plinth, cinnabar tiers with turquoise and saffron bands, a cream
  stair, a flat-topped temple house with a roof comb on top.
- **Theme tiles:** jade-pool tile (a square reflecting pool fed by small stepped waterfalls); stilt-house tile
  (thatched house on a square platform); painted-stele tile (patterns only). Round-canopy trees, causeways with rope
  rails and lamp posts are the kit, retinted.
- **Audio:** rain-forest birds, falling water, wooden wind chimes; a hand-drum and flute ambience.

### Dropped: Mushroom Hollow (G977)

Jake, 11-02: *"having two open plots that are mushroom-based feels silly."* Alien Plain already carries glowing
mushrooms. Its round-1 mockup stays in `art/` as history; nothing is built.

## 4. The grid after this plan

Rows are the cell's z (-2 at the top, the Far Reach side); columns its x. `*` = new; `[ ]` = shard.

```
 z\x |      -2          |      -1          |       0          |       1          |       2
-----+------------------+------------------+------------------+------------------+------------------
 -2  | Coral Drift      | *Saltwind Lthse  | Sky Race         | Desert Ruin      | Alien Plain
 -1  | Lantern Bayou    | Frostline Peaks  | [Far Reach]      | [Nine Dragon]    | Ember Forge
  0  | *Patchwork Fair  | [Sunscar Dunes]  | [Driftwood]      | [Nalati]         | Mosslight Ruins
  1  | *Fossil Badlands | Night Market     | [Pine Hollow]    | [Template 2]     | Clockwork Canyon
  2  | *Jungle Ziggurat | Thin Ice         | Showcase Tmpl    | Starfall Obs.    | Sky Harbor
```

Why these neighbours (palettes from the round-75 boards, G978):

- **Saltwind (-1,-2)** sits on the top edge beside Coral Drift: one coast in two weathers, turquoise calm next to a
  pewter squall. Sky Race (cobalt noon) and Frostline (snow) are its other edges; none is grey or wet.
- **Patchwork Fairground (-2,0)** is a buttermilk morning between Lantern Bayou's blue-green dusk and Fossil's lavender
  blue hour, beside Sunscar's dusk dunes. It replaces an Ember Forge copy that put a second warm night next to the dunes
  (G712's "too much orange glow").
- **Fossil Badlands (-2,1)** is a lavender blue hour between the fair's morning and the jungle's teal afternoon, beside
  Night Market's red-gold dusk. It touches Sunscar only at a corner, so the two arid looks never share an edge.
- **Jungle Ziggurat (-2,2)** (G977) is a rain-washed teal afternoon of cinnabar and jade beside Thin Ice's pale cyan
  noon. It replaces a Frostline copy that put snow beside snow.
- The west column becomes a run of three new worlds (morning fair, blue-hour dig, rain-washed jungle), with the storm
  coast on the top edge.

## 5. Mockups

### Round 75: the look target (G978)

`art/grid/round-75-new-plot-palettes/`: one round-62-style 2 × 2 board per plot (1 ABOVE NEIGHBOUR, 2 ROAD ENTRY,
3 TOP-DOWN, 4 PLAZA; title and palette line burned in), each a codex `image_gen` edit of a round-62 sheet so the
cameras, road, kerbs and blocky tile look match the other plots. Blocky, mirror-symmetric, tile-built, one landmark;
no billboards (OP24 retires them). Prompts in its `README.md`.

| File | What it shows |
|---|---|
| `00-board.jpg` | The four road entries side by side, with the cell each takes |
| `02-jungle-ziggurat.jpg` | Jade pools in four quadrants, stilt houses and steles in rows, the cinnabar step pyramid |
| `03-patchwork-fairground.jpg` | Quilt-field quadrants with a carousel each, big tops at the corners, the Ferris wheel |
| `04-saltwind-lighthouse.jpg` | Four slate-green harbour basins with moored boats, cottage rows, the red-banded lighthouse in the rain |
| `06-fossil-badlands.jpg` | Terraced dig trenches, banded mesa blocks at the corners, tents in rows, the dragon skeleton in its pit |

### Round 1: direction (history)

`art/open-plots/new-unique-plots/round-1/`, codex `image_gen`, each an edit of the in-game Night Market aerial (RM9,
`art/grid/round-68-night-market-gate/ingame-D1.jpg` panel 2): one painterly hero view per theme and an overview, with
the prompts in its `README.md`. Jake approved the themes from these (G974, G977). G978 replaced them as the look target:
they read as bespoke 500 m zones, not as a tile kit.

## 6. Rows

| Row | What | Lane | Done when |
|---|---|---|---|
| NU1 | **done (2026-11-03, G972; `ffb6270346` + `913b810625`).** **One grid (G972).** Delete `grid.developer` (and `devserver` if it only repeats Nine Dragon); Nine Dragon's cell row at (1,-1) replaces the Lantern Bayou copy in `grid.cells`. Folded into G972's own row if the coordinator already queued one | Codex | Developer on and off load the same 25 cells; Nine Dragon at (1,-1) for everyone; push gate green |
| NU2 | **Placeholder art for the four (Opus: the player sees it, G848).** `holo-subjects.tsv` rows from §3's landmarks; refs and Hunyuan3D-2 holograms (`gen-refs.sh`, `batch-holograms.sh`, `clay-review.mjs`) taking the round-75 board's road-entry panel as the reference; `billboard.webp`, `sign.webp` and `thumbs/<idea>.jpg` from the round-75 boards (`make-art.sh` given that source). Into `public/assets/open-plots/<idea>/` | Opus | Four holograms pass clay review; the art matches the other ideas' sizes (billboard ≤ 250 KB) |
| NU3 | **Data and grid swap.** Four `outputs.json` rows (slug, idea, name, accent, manifest overrides like the others); the four `grid.cells` slug swaps of §2 (instances keep their names); regenerate discovery and the registries that list every open-plot product (`scripts/source-generation-outputs.json`, `scripts/test-products.json`, `budgets/ceiling-sources.json`, `lint/ratchet.json` wire and custom-sections rows, `lint/custom-sections.json`, `lint/tile-bake-debt.json`). A grid test refuses a repeated slug in `grid.cells` | Codex, after NU1 and NU2 | 25 distinct slugs in `grid.cells`; the four new outputs build; the new test fails on a repeat; push gate green |
| NU4 | ~~**No twin holograms.**~~ **Dropped with Mushroom Hollow (G977):** Alien Plain's glowing-mushroom hologram no longer has a twin on the grid | — | — |
| NU5 | Saltwind Lighthouse, built (wave per the build-out plan): the shared kit + its palette row + the lighthouse + its 3 theme tiles (§3.1), mirror-symmetric 8 × 8 (G978); about Opus 1.5 + Codex 0.5 lane-days | Opus + Codex | The build-out pipeline's done-when; its four hero views read as its round-75 board and beat Night Market's |
| NU6 | Patchwork Fairground, built | Opus + Codex | As NU5 |
| NU7 | Fossil Badlands, built | Opus + Codex | As NU5 |
| NU8 | Jungle Ziggurat, built (G977; Mushroom Hollow dropped) | Opus + Codex | As NU5 |

Order: NU1 ∥ NU2 → NU3; NU5–NU8 join the build-out plan's waves (look and models Opus, data and captures Codex, G848),
about 6 Opus + 2 Codex lane-days for the four (G978; was about 14 + 5). NU5–NU8 replace OPEN-PLOTS rows OP7, OP9, OP13
and OP21 for these ideas; OP8 (Mushroom Hollow) is dropped (G977).

G972 qualification: all 25 cells and origins are identical in public and Developer modes; Nine occupies (1,-1). The four selected collider changes earned the maintained 75-route walk: 75/75 passed, zero stuck or bounds failures. Public Nine also passed the real native reserve/readiness fence, refused premature save, frozen-away ticks and durable restored continuation. The first raw Node caller refusal was retained; its corrected caller reads the ordinary current product, with every original assertion kept. Root types and focused typed lint passed. Self-applied G872 collider and fixture rulings; no walk waiver.

## 7. Questions for Jake

Answered 11-02: all four yes (G974), then Jungle Ziggurat replaced Mushroom Hollow (G977). Kept as asked.

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
