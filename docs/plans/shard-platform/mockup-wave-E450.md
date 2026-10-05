# SHARD-PLATFORM: the next decision wave (E450)

Jake, 2026-10-04: *"What's next, all questions and decisions based on either the council loop on the replan Or based on
decisions the builders made or questions from builders Make a mini plan for the next wave of mockups and boards you need
to do"*

Sources: the builders' commits since 2026-10-04 12:00 UTC (boards they made, looks they chose), the coordinator's list of
held questions and decisions made for Jake, and council 4 (next). Picks go to Jake with the question tool, images first
as one batch (MOCKUPS.md; the Codex panes no longer message the plan-status pane, so the stray Enters are gone).

## Wave A: real in-game boards the builders already made (picks now)

| # | Board | Question | Recommendation | Row |
|---|---|---|---|---|
| A1 | `art/driftwood-isle/round-17-g164-world/board.jpg` + `progress/shard-platform/sf46/g164-ramp-*.jpg` | Driftwood lowered 0.8 m whole (G164) with the road decks and pier ramps (G170): ship it? | yes | SF46-g |
| A2 | `art/grid/sf19a-frame-owner/owner-board.jpg` + `crossing-strip.jpg` (review `docs/reviews/sf19a-frame-owner.md`) | Turn "Grid one frame" on (the shard owns its frame, G158) and delete the row? Also the builder's 16 m blend at the cell edge | yes, 16 m | SF19a / SF19b, G122 |
| A3 | `art/far-reach/round-40-switchbacks/board.jpg` | Sky Reach's four entries as built (plank landing, two-lane timber switchback tower, trestle causeway to the nearest island): OK? | yes | SF49-g |
| A4 | `art/nine-dragon-stack/round-30-grid-entries/board.jpg` | Nine Dragon's four road-height stone landing decks (dead ends until the climb, B1 below): OK? | yes | SF51-g |
| A5 | `art/pine-hollow/round-34-grid-entries/board.jpg` | Pine Hollow's four canyon-gap entries: OK? | yes | SF47-g |
| A6 | `art/pine-hollow/round-35-memory-variants/` | Pine plays at 1,192 MB, 192 over the 1.0 GB cap; the invisible cuts close ~20. Visible cuts: B1 512² building sets (−20.5 measured), B2 ASTC 6×6 (~−46), B4 smaller environment cube (~−16.5), B5 herd shadows (~−8) … still short of ~170 | take B1 + B2 + B4 + B5 now and have the lane find the rest (B1 below) | SF47-g, G65 |
| A8 | none (numbers: `progress/memory/sf22a-both-cuts-2226f2815`) | Driftwood's two invisible memory rows (`driftwoodGpuOnlyCopies` −72 MB, `driftwoodIslandInstancing` −109 MB GPU, +68 draws worst pose) pass the frame floor; with both on the whole grid fits at 981 MB. The coordinator asked for an iPhone check, which is a phone chore (JAKE.md) | turn both on by default; your normal play is the device reading | G144, SF46 |
| A9 | none | Nalati's existing canyon cut at each midpoint is 17.6 m wide, not 8 m; narrowing it changes the look and needs a re-bake. The builder kept 17.6 m | keep 17.6 m (the socket is still 8 m) | SF48-g |
| A10 | `art/far-reach/round-41-far-proxy/board.jpg`, `art/sunscar-dunes/round-31-grid-cube/board.jpg` | Builder looks: Sky Reach's far view baked 1.3× brighter with its out-of-cube isles hidden in the grid; Signal Dunes' dune skirt cut at 250 m and every horizon ring / cloud sea dropped in the grid (G99) | OK | SF49, SF50 |
| A11 | `progress/shard-platform/sf17b-shore/shore-shore-road-close.jpg` | The G149 shore wall reads as coursed paving stone, not loose rip-rap | OK as built | SF17b, G149 |
| A12 | `art/far-reach/round-40-switchbacks/board.jpg` | Sky Reach's south entry leads straight into the storm-crown boss arena, skipping the fallen-bridge quest (builder's routing) | move the south causeway to land before the bridge quest | SF49-g |
| A7 | `art/hud/round-23-big-cards/board.jpg`, `art/hud/round-24-shard-panels/` | The big item cards (G87) are built, but the builder kept **Classic** as default because the tiles draw the engine's SVG icons, not item art. Turn Big cards on with the icons, or wait for item art? | on with the icons now; item art as a later row | SF28 |

## Wave B: new mockups and captures (holes nobody has drawn)

| # | Subject → folder | Why it's a hole | Variants | Engine |
|---|---|---|---|---|
| B1 | **Pine's remaining ~150 MB** → `art/pine-hollow/round-36-memory-variants-2/` | A6's texture cuts don't reach 1.0 GB; the next candidates change what you see (view distance, tree density, horizon cards, herd size) | real captures of each candidate at the same poses, with measured MB | real capture (SF47 lane) |
| B2 | **Nine Dragon: from the landing deck up to Lantern Square** (+125 m) → `art/nine-dragon-stack/round-31-deck-climb/` | Each deck is a dead end today; SF51-p must add the climb | A a carved stair tower · B a lantern lift pavilion · C grapple points up the fragment's underside | codex `image_gen` from the round-30 captures |
| B3 | **Entry landings outside the grid** (Sky Reach, Nine Dragon) → `art/grid/round-20-landings-standalone/` | In SHARD SELECT there is no road, so the landings hang over cloud or void | A hide them outside the grid · B a small dock or plinth that reads as an arrival point · C keep as built | codex `image_gen` from the round-40 / round-30 captures |
| B4 | **Item art for the big cards** (only if A7 says "wait") → `art/hud/round-25-item-art/` | The G87 board showed painted item pictures; the build has SVG icons | A SVG icons · B painted item art (generated, per item) | codex `image_gen` |

## Later: real captures, not mockups

G120 crossroads pop-in captures (before M2); SF48 Nalati's look (when prepared); SF55 the Blender Template as built;
the refreshed M1 board; SF57's soak verdict (info). Council 4's questions join the next wave.

## Status

| Item | Status |
|---|---|
| Wave A | ready; to Jake 2026-10-04 |
| Wave B | planned |
