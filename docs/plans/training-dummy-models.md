# Training dummy model pass

**State:** `in progress` 2026-09-28 — E215 (Codex, no commit since 2026-09-27): three rigged TRELLIS candidates render in the arena and Model Explorer (b70ae6b9); the dev-only Explore entry is done (E233 / E255, 04d5fa2b); the dummies are human-sized solid lock targets (E252, 4fdcca55). Open: the physical-iPhone memory reading and the nine-angle live capture (agent), then Jake's approval of the dummy look against the approved sheets.

This is a shared asset for the HUD + Weapon Explorer arena and Model Explorer in all four shards. The approved nine-angle sheets in `art/hud-explorer/round-1-arena/` are the visual target. Preserve the distinct constructions: wood frame with wooden armor, straw body with cloth armor, and wood frame with steel armor.

The model input references are `art/hud-explorer/round-3-dummy-meshes/ref-straw-cloth.jpg`, `ref-wood-wood.jpg`, and `ref-wood-steel.jpg`. These are source targets for the three rigged candidates, not live engine captures.

| Checkpoint | Lever | Gate |
|---|---|---|
| Three candidate meshes | Local TRELLIS.2 1024 cascade from approved front references | Front and side read as humanoid, with armor material distinct |
| Art cleanup and motion | Preserve TRELLIS texture; Blender scale, orient, skin; local detail repair where generation has holes | Nine-angle turntables and sampled hit pose have no severe gaps or collapsing limbs |
| Phone asset budget | WebP textures and meshopt, original mesh detail retained where visible | Model load, decoded memory, triangles and draw calls measured in portrait iOS target |
| Shared integration | One asset family used by the arena and Model Explorer, loaded only when requested | All shards enter arena; all three variants visible and hittable; Model Explorer buttons visible; entry belongs inside dev-only Explore World |
| Approval | Compare live portrait captures with approved sheets | User sees the candidate before this plan can be marked finished |

The first meshopt pass collapsed the skinned positions into a signed unit cube, putting half the figure under the floor. The shipped GLBs now preserve float positions before meshopt encoding: each spans approximately 0–2.65 m in Y, and the game scales it to the player's 1.8 m (`TRAINING_DUMMY_SCALE`, E252, 4fdcca55) with the hit volumes and Rapier solids to match. Each WebP/meshopt GLB is 0.85–0.97 MB, with one 512² base map, one 512² material map, roughly 38–40k triangles, and one skinned draw call. Reproduce the export with `scripts/practice/rig_dummy.py` followed by `scripts/practice/pack_dummy.mjs`. A 390 × 844 browser capture (`/tmp/e215-arena-portrait-v4.png`) confirms all three render; physical phone memory, nine-angle live capture, and art approval remain to be checked.

Do not substitute Hunyuan3D-2 output: its territory restrictions exclude a shipped game. The local TRELLIS.2 weights are MIT licensed.
