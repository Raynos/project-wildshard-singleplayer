# Driftwood Isle: round 7, the Blender island vs the procedural island (X2, E52)

The 9 spawn-cove cameras of `../round-4-remaster/README.md` (FP anchor P = (0, −146.5); `tod=0.4167&clock=1000000`), shot
on a clean export of HEAD + the Blender island, in both modes of the in-game toggle (`?island=blender|procedural`).
Compare with `../round-4-remaster/sheet-mockup-3x3.jpg`.

- `sheet-blender-3x3.jpg`: `?island=blender`. The cove built in Blender (scripts/blender/): palms from the asset-agent's
  CC0 / hero kit plus Blender-built broad-frond palms, hero boulders and driftwood, crag slabs, ~16 k scatter, a lower
  ragged grass line, Cycles-baked terrain AO + sun bounce, per-model baked AO.
- `sheet-procedural-3x3.jpg`: `?island=procedural` (the TypeScript island).

Phone (390×844, `tier=phone`) at P, calls / tris: blender 126 / 0.94 M, 106 / 0.81 M, 103 / 0.82 M, 89 / 0.72 M;
procedural 95 / 0.83 M, 83 / 0.78 M, 81 / 0.79 M, 78 / 0.77 M. Frames 5–9 are desktop god views.
