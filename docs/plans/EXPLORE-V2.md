# Explore World V2 — what is left after V1

**State:** `draft` 2026-10-03 — unblocked 2026-10-03 (Jake, E404): the E357 lock ended when GAME-NORMALIZATION was archived (`5390d75f9`). V1 dropped (E68); V7 built (`0bfc5bf5`); V3's pond fixed (`f6f3be8e`); V6's COMPARE half built by E241 / E242. Not built, not approved: V2 pine LOD tiers, V3's re-shoot on day / night, V4 selection outline, V5 specimen framing, V6's Pine Hollow hub art. Waits on Jake's pick.

## Where V1 stands

Built and live: the title's EXPLORE WORLD, the hub, the World Explorer (god-mode flight, tap-to-select, the map
sheet, COMPARE on Driftwood), the Model Explorer (studio, catalog, views, lights, tiers, creatures, lineup), ✎ notes
into the inbox. Driftwood and Pine Hollow are switched on (E66: Pine Hollow only, per Jake); the World Explorer
screens are at the round-6 midway bar (E67).

## Rows (none approved)

| # | Row | What it is | Size | Ask |
|---|---|---|---|---|
| V1 | **COMPARE viewpoints** | The four stored mockup cameras (src/engine/explore/Compare.ts) only roughly match the mockups' framing; line each up so SLIDE compares like for like | S | E68 — **dropped** (2026-09-23, Jake: "E68 close out") |
| V2 | **Pine tree LOD tiers** | TIERS on the Scots pine shows "one build for every tier". Show the forest's real LOD bands instead: near cards + twigs, far cards, the 2-quad impostor, side by side with tris each. That is what the phone draws past 45 m | S | — |
| V3 | **Map: water and freshness** | The Pine Hollow pond reads dark from above (its reflection has no view); re-shoot the map when the day / night phase changes, not once a session | S | the pond: **done** by PH-C9 `f6f3be8e` ("no longer a black hole from above"); the re-shoot: not built |
| V4 | **Selection outline** | A cyan outline on the selected model (inverted hull or a post outline pass) on top of the box (round-5 04) | M | — |
| V5 | **Specimen framing** | Fresh props on the turntable: the fallen log lies along the view and reads tiny. Frame by the long axis and turn it side-on | S | — |
| V6 | **Pine Hollow art** | The hub cards reuse the picker art on Pine Hollow; COMPARE has no Pine Hollow targets. Portrait codex mockups of four Pine Hollow views + hub art (low-poly bar does not apply: Pine Hollow is the PBR shard) | M | COMPARE: Pine Hollow targets exist now (ridge / den / hamlet, `src/engine/explore/Compare.ts`, `240107cc`), E241 / E242 in flight (Codex); the hub art: not built |
| V7 | **Nalati** | Switch Explore on for Nalati: `ChunkDef.explore` + pois, and a `register…Models` call in main.ts. Its branch lives in ../wildshard-nalati-grasslands, so it lands when Nalati merges. Held back by Jake ("pine hollow only") | S | **done** outside this plan: the user's NALATI-MERGE wave 8 pick, `0bfc5bf5` (N16) |

## Owned elsewhere (not this plan)

- Round-5 01 title and 02 loader → the HUD / loader sessions. 03 world flight's water, grading and pier artefacts →
  the Driftwood remaster (DRIFTWOOD-REMASTER-V2). 11 the note sheet → the feedback inbox's owner.
- A screenshot button next to ✎: out. Jake takes screenshots with the device ("If I want to make a screenshot of the
  game, I just press screenshot").
