# Remaster all the open plots: mini plan (G660)

**State:** `parked` 2026-10-27 — **RP2–RP4 are parked by G774**: nothing is built until Jake has played Night Market;
then wildshard-v writes a new plan for the other 18 plots with him, which replaces RP2–RP4 (and pilot R1–R3). Was:
`waiting` 2026-10-23 — **mockups only. Nothing here is built until Jake is happy with the
[Night Market pilot](night-market-pilot-mini-plan.md)** (G633 D4); until then the other plots keep their holograms. This
plan collects one mockup per idea so the rollout (pilot plan R2) starts from approved designs.

Jake, 2026-10-23: *"We're not building the other open plots until we're happy with the night market pilot. We're just
collecting the mock-ups … link out to the night market pilot and say that we won't do the rest once we're happy with night
market."*

## How each plot is remastered (from the pilot)

Each idea gets what the Night Market pilot proves: an 8 × 8 grid of 62.5 m tiles from a bespoke kit (G633 D2, rotation
only), a Hunyuan3D 2.1 / TRELLIS.2 landmark on the central 2 × 2 plaza (G632), five poster billboards with the idea's hero
picture, its name and "BUILD THIS SHARD" (G623, G633 D3), no hologram, plinth, beams or corner posts (G637), and its own
look on the world map. Every mockup is one codex generation of the same plot from four in-game cameras (above the
neighbour at 100 m, the road entry, top-down from 630 m, the plaza) in the round-49 Night Market style.

### How to add an idea as a style row (RM14)

A second idea needs data, not generator code (`test/open-plots-style-row.test.ts` builds Night Market's layout through
the unchanged `kit.mjs` / `kitGlb.mjs` with a second palette and checks the shared kit retints by slot and nothing else):

1. **Row:** add the idea to `src/shards/open-plots/outputs.json` with `"layout": "<idea>"` (its product slug, name,
   accent and manifest overrides beside the others).
2. **Layout:** copy `data/layouts/night-market.json` to `data/layouts/<idea>.json`; edit its 8 × 8 `rows` (tile letter +
   quarter turns), its `palette` (every kit slot: `roof`, `wall`, `stall`, `awning`, `stone`, `lawn`, `water` ... in the
   round-62 colours of the idea; a slot left out keeps the kit family's default), its `kit` families (all of
   `public/assets/open-plots/kit/`, shared by every idea), its `landmark` (near / far GLB, height, turn, lanterns) and
   its `posters` image.
3. **Look:** its grade and look key in `data/source.json` `look.keys` and the idea's own row in `look/map.json`
   `outputs` (map style), as Night Market's.
4. **Hero pieces:** only the landmark and anything not in the shared kit are new models (`mockup-to-model`); a new kit
   family is a shared one for every idea (`scripts/blender/open-plots/kit.py`, its slots mapped to `data/trim.json` bands).
5. **Check:** the 5-camera / 10-dome template (`scripts/capture-night-market-domes.mjs`, `test/fixtures/night-market-domes/`)
   against the idea's targets, then the plan's readings.

## The 19 ideas and their mockups

| # | Idea | Landmark | Mockup |
|---|---|---|---|
| 1 | Night Market (the pilot) | red-and-gold pagoda gate | `art/grid/round-49-night-market-billboards-2x2/bb-b.jpg`, layout B `art/grid/round-50-night-market-tiles/05-mockup-b-grid.jpg` |
| 2 | Jungle Ziggurat (new, G653) | overgrown step pyramid | `art/grid/round-51-five-new-plots/1-jungle-ziggurat.jpg` |
| 3 | Patchwork Fairground (new) | Ferris wheel | `art/grid/round-51-five-new-plots/2-patchwork-fairground.jpg` |
| 4 | Saltwind Lighthouse (new) | red-and-white lighthouse | `art/grid/round-51-five-new-plots/3-saltwind-lighthouse.jpg` |
| 5 | Mushroom Hollow (new) | toadstool tower | `art/grid/round-51-five-new-plots/4-mushroom-hollow.jpg` |
| 6 | Fossil Badlands (new) | dragon skeleton | `art/grid/round-51-five-new-plots/5-fossil-badlands.jpg` |
| 7 | Showcase Template | glass-domed expo pavilion | `art/grid/round-52-all-open-plots/07-showcase-template.jpg` |
| 8 | Thin Ice | ice spire on a frozen lake | `art/grid/round-52-all-open-plots/08-thin-ice.jpg` |
| 9 | Sky Harbor | moored airship and mooring tower | `art/grid/round-52-all-open-plots/09-sky-harbor.jpg` |
| 10 | Coral Drift | coral arch over a lagoon | `art/grid/round-52-all-open-plots/10-coral-drift.jpg` |
| 11 | Clockwork Canyon | brass clock tower with gears | `art/grid/round-52-all-open-plots/11-clockwork-canyon.jpg` |
| 12 | Starfall Observatory | domed observatory and telescope | `art/grid/round-52-all-open-plots/12-starfall-observatory.jpg` |
| 13 | Alien Plain | glowing alien monolith | `art/grid/round-52-all-open-plots/13-alien-plain.jpg` |
| 14 | Desert Ruin | sandstone temple gateway | `art/grid/round-52-all-open-plots/14-desert-ruin.jpg` |
| 15 | Sky Race | race start tower and ring gate | `art/grid/round-52-all-open-plots/15-sky-race.jpg` |
| 16 | Frostline Peaks | snowy peak with lodge and ski lift | `art/grid/round-52-all-open-plots/16-frostline-peaks.jpg` |
| 17 | Ember Forge | dwarven forge furnace | `art/grid/round-52-all-open-plots/17-ember-forge.jpg` |
| 18 | Lantern Bayou | lantern-hung cypress tree | `art/grid/round-52-all-open-plots/18-lantern-bayou.jpg` |
| 19 | Mosslight Ruins | moss-glowing stone tower | `art/grid/round-52-all-open-plots/19-mosslight-ruins.jpg` |

The 19 grid cells use the 19 ideas once each (G629, G653).

## Rows (after Jake is happy with the pilot)

| Row | What | Done when |
|---|---|---|
| RP1 | Jake reviews the 19 mockups; any he wants changed get a new round | **done** 2026-10-24 (G712: "Mockups look good") |
| RP1a | G712 follow-up: *"too many have the same orange/red glow as Night Market"*. Round 62 re-palettes all 18 other plots (same layout, landmark, billboards and cameras; its own sky, light and colours each), board `art/grid/round-62-open-plot-palettes/00-board.jpg` | **done** 2026-10-24, `art/grid/round-62-open-plot-palettes/<nn>-<slug>.jpg` supersede rounds 51 and 52 for palette; only Night Market keeps the red-and-gold lantern dusk  **Approved (G714).** |
| RP2 — parked (G774) | Per idea: kit, layout, landmark (Hunyuan3D 2.1 / TRELLIS.2, better wins), billboards, palette and map look, as the pilot did | the plot matches its mockup in a 4-angle capture |
| RP3 — parked (G774) | The five new ideas get `outputs.json` rows and replace the five repeated cells | all 19 cells unique |
| RP4 — parked (G774) | Delete the hologram path (hologram, plinth, sign inputs) once every plot is remastered | no hologram code or assets left |
