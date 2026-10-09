# Blender Template

SF55, E435: a Developer-only clay prototype built through the public SDK. Rebuild the source with `bash scripts/blender/build.sh blender-template`, then `node scripts/wildshard.mjs build src/shards/blender-template`.

The Blender script owns the whole 500 m cell (G220, G276): a set piece at each midpoint entry (north the ridge cut with its 19.2 m bridge and a watchtower; +x the market stoa with walkable roofs; -x the amphitheatre with slate aisles; south the aqueduct deck and cistern tower), the walled hub plaza around the enterable hall with its obelisk, 12 m slate spokes and a ring road at 114 m, and the one textured door. Every walkable or solid piece is a native trimesh collider; the twelve-leg walk proof is `progress/shard-platform/g276/walk-route.json`. Static collision is native trimesh; sampled edge profiles share the authored ground authority. There is no terrain heightfield, runtime folder or shard generator. The guardian uses the platform sphere recipe declared in data.

The AssemblyScript door toggles its independent visual and collider. Open it, meet the guardian, collect five coins; the quest fact grants one durable achievement. The guardian can kill the player; retry preserves the completed reward. Native tests cover mid-loop restore in a fresh worker and duplicate ledger admission.

The catalogue and build share identity, accent, spawn, look and presentation in `data/source.ts`. The SDK's pure `sourceManifest` facade maps those fields into the normal SHARD SELECT card. Its JPEG is the unchanged, labelled Opus capture of the real textured door; the same content-addressed bytes are charged to the product's image library. The shard remains behind Developer in the grid cell at (−1, −1). Both-surface quiet frame floors remain SF55 work.
