# Signal Dunes round 28: the caravan camp as a modelled set (the original top-10's row 7)

Jake (2026-10-03): finish the original top-10. Row 7 is the camp from mockup B through `mockup-to-model`: the wagon (torn canvas
over hoops, tailboard planks, spoked wheels), the crates, the sacks and the horse, lit by the lantern's real light.

Files:
- `src-wagon.jpg`, `src-cargo.jpg`: the crops of mockup B (`../round-9-review/B-quest-logbook.jpg`) the references came from.
- `ref-wagon.jpg`, `ref-crates.jpg`, `ref-sacks.jpg`: each object alone on white, three-quarter, by codex image_gen from the
  crops (`ref.py`, the three in parallel).
- `views.jpg`: the three Hunyuan3D-2 models from four sides (Blender stills): no holes, nothing floating, no backdrop card.
- `board.jpg`: mockup B | round 26 (the round-7 wagon, code crates and sacks) | now | h2 (the caravan close).
- `post.sh`: the post (weld, simplify, the paint to WebP, meshopt), glove-hd4's steps.

Detail list (each carried by a part or material):
1. A covered wagon from behind, its planked tailboard to the logbook's approach: wagon-hd2's mesh, turned like wagon-hd.
2. Pale canvas torn to rags over the front hoops; the rear hoops bare: the mesh and its painted texture.
3. Four spoked wheels with iron tyres, the rear pair larger: the mesh.
4. The lantern in the back hoop's opening, its light inside the canvas: the code lantern (`world/places.ts` LANTERN, moved to
   the new wagon's back opening) and the shard's one real point light, which rides to the lantern at the camp
   (`world/build.ts` wayLight); the lantern and the cookfire also warm the camp's materials (`warmByFire`).
5. Two weathered planked crates, one stacked on the other, corner battens: crates-hd.
6. Three tied burlap sacks and a strapped bedroll against the crates: sacks-hd.
7. The pack horse: horse-hd, modelled from mockup B in round 19 (`../round-19-horse`), unchanged.

Numbers: Hunyuan3D-2 full shape, 2048 paint, 60 k faces each, then:

| Model | Triangles | Texture | GLB | Copies | Collider |
|---|---|---|---|---|---|
| wagon-hd2 | ~21 k (0.35) | 1024 WebP | 252 KB | 1 | the wagon box (unchanged) |
| crates-hd | ~6 k (0.10) | 512 WebP | 86 KB | 1 | the first crate's box, 1.36 m (the stack); the second crate's box dropped with its code crate |
| sacks-hd | ~7 k (0.12) | 512 WebP | 204 KB | 1 | none (as the code sacks) |

wagon-hd stays on disk and stands in if wagon-hd2 fails to load; the code crates and sacks stand in for theirs. The walk
test after the swap: 7 legs, 0 stuck (`progress/physics/sd-camp-b-musve5de.json`).
