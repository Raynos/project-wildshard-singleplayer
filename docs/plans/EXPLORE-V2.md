# Explore World V2 — what is left after V1

**State:** `in progress` 2026-10-03 — Jake approved V4 (a cyan selection outline) and V5 (props framed by their long axis) in the E423 grill: buildable, unowned. V2, V3's re-shoot and V6 dropped by Jake. Done earlier: V7 (`0bfc5bf5`), V3's pond (`f6f3be8e`), V6's COMPARE half (E241 / E242); V1 dropped (E68).

## Where V1 stands

Built and live: the title's EXPLORE WORLD, the hub, the World Explorer (god-mode flight, tap-to-select, the map
sheet, COMPARE on Driftwood), the Model Explorer (studio, catalog, views, lights, tiers, creatures, lineup), ✎ notes
into the inbox. Driftwood and Pine Hollow are switched on (E66: Pine Hollow only, per Jake); the World Explorer
screens are at the round-6 midway bar (E67).

## Rows (none approved)

| # | Row | What it is | Size | Ask |
|---|---|---|---|---|
| V1 | **COMPARE viewpoints** | The four stored mockup cameras (src/engine/explore/Compare.ts) only roughly match the mockups' framing; line each up so SLIDE compares like for like | S | E68 — **dropped** (2026-09-23, Jake: "E68 close out") |
| V4 | **Jake: yes (E423 grill, 2026-10-03).** **Selection outline** | A cyan outline on the selected model (inverted hull or a post outline pass) on top of the box (round-5 04) | M | — |
| V5 | **Jake: yes (E423 grill, 2026-10-03).** **Specimen framing** | Fresh props on the turntable: the fallen log lies along the view and reads tiny. Frame by the long axis and turn it side-on | S | — |
| V7 | **Nalati** | Switch Explore on for Nalati: `ChunkDef.explore` + pois, and a `register…Models` call in main.ts. Its branch lives in ../wildshard-nalati-grasslands, so it lands when Nalati merges. Held back by Jake ("pine hollow only") | S | **done** outside this plan: the user's NALATI-MERGE wave 8 pick, `0bfc5bf5` (N16) |

## Owned elsewhere (not this plan)

- Round-5 01 title and 02 loader → the HUD / loader sessions. 03 world flight's water, grading and pier artefacts →
  the Driftwood remaster (DRIFTWOOD-REMASTER-V2). 11 the note sheet → the feedback inbox's owner.
- A screenshot button next to ✎: out. Jake takes screenshots with the device ("If I want to make a screenshot of the
  game, I just press screenshot").
