# Explore World V2 — what is left after V1

**State:** `draft` 2026-09-23 — the rest of Explore World after V1 (archived `project/archive/2026-09-23-explore-world.md`) and E66 / E67 (live `b95079e-muena3vr`). Nothing here is approved; it waits on Jake's pick of rows.

## Where V1 stands

Built and live: the title's EXPLORE WORLD, the hub, the World Explorer (god-mode flight, tap-to-select, the map
sheet, COMPARE on Driftwood), the Model Explorer (studio, catalog, views, lights, tiers, creatures, lineup), ✎ notes
into the inbox. Driftwood and Pine Hollow are switched on (E66: Pine Hollow only, per Jake); the World Explorer
screens are at the round-6 midway bar (E67).

## Rows (none approved)

| # | Row | What it is | Size | Ask |
|---|---|---|---|---|
| V1 | **COMPARE viewpoints** | The four stored mockup cameras (src/explore/Compare.ts) only roughly match the mockups' framing; line each up so SLIDE compares like for like | S | E68 (open) |
| V2 | **Pine tree LOD tiers** | TIERS on the Scots pine shows "one build for every tier". Show the forest's real LOD bands instead: near cards + twigs, far cards, the 2-quad impostor, side by side with tris each. That is what the phone draws past 45 m | S | — |
| V3 | **Map: water and freshness** | The Pine Hollow pond reads dark from above (its reflection has no view); re-shoot the map when the day / night phase changes, not once a session | S | — |
| V4 | **Selection outline** | A cyan outline on the selected model (inverted hull or a post outline pass) on top of the box (round-5 04) | M | — |
| V5 | **Specimen framing** | Fresh props on the turntable: the fallen log lies along the view and reads tiny. Frame by the long axis and turn it side-on | S | — |
| V6 | **Pine Hollow art** | The hub cards reuse the picker art on Pine Hollow; COMPARE has no Pine Hollow targets. Portrait codex mockups of four Pine Hollow views + hub art (low-poly bar does not apply: Pine Hollow is the PBR shard) | M | — |
| V7 | **Nalati** | Switch Explore on for Nalati: `ChunkDef.explore` + pois, and a `register…Models` call in main.ts. Its branch lives in ../wildshard-nalati-grasslands, so it lands when Nalati merges. Held back by Jake ("pine hollow only") | S | — |

## Owned elsewhere (not this plan)

- Round-5 01 title and 02 loader → the HUD / loader sessions. 03 world flight's water, grading and pier artefacts →
  the Driftwood remaster (DRIFTWOOD-REMASTER-V2). 11 the note sheet → the feedback inbox's owner.
- A screenshot button next to ✎: out. Jake takes screenshots with the device ("If I want to make a screenshot of the
  game, I just press screenshot").
