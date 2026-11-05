# blender-template / round-2-look: the look pass for G166 B, Blender clay + one textured door (SF55)

Real in-game captures of the built shard (Chromium as an iPhone 16 Pro portrait, muted, phone tier, Developer on), not
mockups. They show the look Jake picked in round 1 (`../round-1-concept/B-clay-hero.jpg`), now built.

| File | What it shows |
|---|---|
| `board.jpg` | The four places on one labelled board: entry rise, bridge, interior, textured door |
| `1-entry-rise.jpg` | The north entry cut: 19.2 m stone-clay banks either side, the slate road between them, the bridge underside overhead |
| `2-bridge.jpg` | On the 19.2 m deck: the walkable top is slate route clay, the dark trim beacon across the cut marks the far bank |
| `3-interior.jpg` | Inside the hall from its back wall: the guardian coming, the door seen from inside |
| `4-textured-door.jpg` | The one textured surface from the spawn: a plank double door with iron straps, rivets and ring pulls |
| `walkthrough.mp4` | 23 s, 540 px, real input: walk into the rise, cross the bridge deck, open the door (KeyE), meet the guardian, quest complete with 5 coins. A teleport starts each leg; every leg is labelled |

**What changed** (only `scripts/blender/blender-template/world.py`, the rebuilt `world.glb` and the look keys in
`shard.config.ts`; no collider, route, quest or node changes):

- **Clay in three values, two materials.** A 125 m L1 tile may draw only two materials, so the tones are linear vertex
  colours on the existing `Clay` and `Road clay` materials: ground mid clay, structures a lighter stone clay, dark trim on
  the hall lintel, the ridge beacon, the hub markers and the court pillars. Structures darken softly toward the ground,
  like clay occlusion.
- **Readable paths.** Every walkable route surface (roads, the bridge and approach decks, the hall roof, the balcony
  lintel, the court steps, the tops of the three ramps) is cool slate `Road clay`; the sides of those decks stay stone.
- **The door.** A 512 px procedural plank double door (was a 64 px stripe) with UVs that show the whole door on both
  faces. It is the only texture in the shard.
- **Light.** A fixed mid-morning sun from the south-west (`dayOverride` 0.4, azimuth 71, max elevation 50) lights the
  door three-quarter on; a warm/cool hemisphere keeps shaded faces readable; linear fog 160–700 m into a warm horizon.

**Cost:** two world materials as before, no new draw; report card +0.13 MB estimated memory near the player (588.83
MB), worst grid 742.65 / 1000 MB playing; download +~0.2 MB (the door texture). All six SF55 walk legs: 0 stuck, bridge
19.218 m, hall roof 5.62 m (`physics-baseline.mjs --mode=walk --route=progress/shard-platform/sf55/walk-route.json`).

**Known, not from this pass:** regular light/dark bands on large flat lit faces (shadow acne from the engine's cascaded
shadows) were already in the skeleton's captures; they belong to the engine's shadow bias, not the shard.
