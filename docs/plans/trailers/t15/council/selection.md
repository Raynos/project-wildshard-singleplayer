# T15 council, round 1 — the selection (E471, 2026-10-10)

Three fresh seats scored the twenty ideas (`../ideas.md`) against the frozen ledger (`ledger.md`): A (Codex,
`pick-seat-A.md`), B and C (Claude, `pick-seat-B.md`, `pick-seat-C.md`).

| Idea | A | B | C | Result |
|---|---|---|---|---|
| #2 Describe a world (+ #18 glyphs: B, C) | pick | pick | pick | **V1** |
| #3 The map that draws itself | pick | pick | pick | **V2** |
| #5 Postcards | pick | pick | pick | **V3** |
| #1 The seam, the seam made the highway | — | pick | alternate | **V4** — two votes; the only cinematic pick of the four |
| #6 Window seat (+ #19) | — | — | pick | parked |
| #16 The signpost | pick | — | — | parked |

**Traps every seat named:** #7 (generated motion again), #13 (portal gag), #8 (draft 1's opener), #10's counter (a made-up
number), any upload line (ledger 6), and **reusing the round-2 paintings as they are** (they carry draft 1's
golden-hour, everything-filled-in look). Every painting the four use gets a new brief with a *leave out* list.

## The four, with the seats' changes folded in

**Shared frame:** 15 s = 12 s of content + a 3 s end card (the Cell logo, *Play it in the browser. Build it in Claude
Code.*, `wildshard.io`, *Concept trailer · not gameplay*); the corner tag *CONCEPT TRAILER · NOT GAMEPLAY* on every content
frame; muted-first (captions do the work); 1920 × 1080, 60 fps; one MiniMax Music 3 cue each + MOSS / SA3 hits, −14 LUFS.
**Art brief for every painting:** one light (soft daylight or overcast, never golden hour), a limited palette, few
objects, no galaxy, no glow, no lens flare; the shard's own style.

- **V1 · Prompt to glyphs** (#2 + #18; real capture + glyph motion design). A real Claude Code session, tight crop,
  typed prompt *a small island with a crooked lighthouse and a toon sea*, the real response streaming (0–5 s); the
  on-screen characters slide into a coarse monospace mosaic of the island by luminance and hue (5–9 s); the glyphs
  resolve cell by cell into the painted island, Driftwood flat toon at midday (9–12 s). No *shard uploaded* (A, B, C).
- **V2 · The map that draws itself** (#3; ink motion design). Ink on paper: one plot is drawn, then four neighbours,
  each in a visibly different hand (brush, crow-quill, technical-pen hatching, crayon), each signed with a tiny author
  handle; the two-lane highway with its roundabouts is the one constant line; the map runs off the page and leaves an
  outlined empty plot labelled *yours*. Two inks + one accent. No counter (B, C), four readable plots (A).
- **V3 · Postcards** (#5; flat 2.5D cards). Locked top-down on a printed road map: four printed-postcard cards
  (halftone, print palette, *Greetings from …*, a postmark) land on their plots on the beat, real contact shadows; a
  blank card slides into the empty plot and a monospace cursor types *greetings from: your world* (B), so the road
  connects (A). Built in HTML / CSS 3D.
- **V4 · The seam** (#1, the seam is the highway; camera projection). One locked composition low over the highway's
  dashed line looking down the road: painterly Nalati grass on the left verge, faceted Driftwood toon on the right, both
  running to the horizon. Two separate paintings made from one shared grey layout, composited along the road (B), the
  frame filmed by a slow push and rise on its MoGe-2 depth mesh (`still_mesh.py` → `still_cam.py`). Caption *Every
  shard is built by someone else.*
