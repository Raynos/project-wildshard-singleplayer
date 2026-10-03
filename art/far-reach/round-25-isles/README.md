# Sky Reach top-10 row 1: modelled floating islands (E407)

The zoom-out audit (project/archive/2026-10-03-sky-reach-top10.md): the islands were 'pancakes' (flat grassy tops over a keel). These
six follow the mockups' islands: rounded rock masses, bushy canopies over the rim, overhangs, root and vine curtains.

- `refs/gen.py`: six codex image_gen references on white, each from an island in a mockup (mass, canopy, twin: mockup A's
  cluster; falls: proposal B's mid isles; spire: mockup C's right isle; shelf: mockup D's distant isles).
- Pipeline: BiRefNet cutout, Hunyuan3D-2 turbo shape + paint (40k faces), `finish.sh` (12k tris, 1024 map, WebP,
  meshopt): `public/assets/far-reach/models/isle-<name>-hd/isle-<name>-hd.glb`, 305-380 KB each.
- `turntable-<name>.jpg`: the ref and eight views of each model.
- `board-cluster.jpg`: mockup A, then the game's A, proposal B, B, C and the spawn aerial with the new isles (the cluster
  over the mill per the lead's ruling, the playable islands' keels from the same models, clipped under their decks).

Detail list (each on a real part): 1 rounded rock mass (model shape); 2 bushy canopy over the rim (model shape + paint);
3 overhangs below the rim (shape); 4 root and vine curtains (shape: dripping strands; paint); 5 tapering rooted underside
(shape); 6 a waterfall (falls model's paint + the code falls at the rim, world/distant.ts).
Numbers: 12k tris per model, one instanced draw per model; 6 models x ~0.35 MB.
