# Pine Hollow round 25 · E322 F-M1 · the Antler King's own rig

Today (A) the King is the Bark Warden hull baked onto the elk's bones: an elk ×2.6. His concept
(`../round-2-antler-king/A-bark-warden.jpg`) stands more upright. B is a new hull generated in that stance, on a skeleton of
his own, with his own clips. Debug ▸ Creatures & NPCs ▸ **Antler King rig** (A · Elk rig / B · His own, a reload, Pine
Hollow only). A stays the default until Jake picks.

| File | What |
|---|---|
| `board.jpg` | **the pick**: A / B in his clearing by day, iPhone 16 Pro portrait. Idle · charge · rearing strike (A has no rear, so its column shows the elk's charge wind-up) |
| `ref-antler-king-rig.jpg` | codex `image_gen` reference: today's ref-antler-king.jpg material, the concept's body plan. 3/4 front, white ground. 3 variants were made; this is the most upright |
| `antler-king-rig.glb`, `.phone.glb` | the rig-ready hull: Hunyuan3D-2 full + paint → `driftwood_post.py --keep-texture` (22 k tris, 3.6 m) → `scripts/img2mesh/strip_backdrop.mjs` (the generator's white ground sheet cut, the hoof soles capped) → `creature-color.mjs` |
| `gate-desktop.json`, `gate-phone.json` | the rig gate's report per tier (every check's numbers, per clip) |
| `freeze-desktop.json`, `freeze-phone.json` | the bake's freeze: hashes of the position / normal / uv / index buffers the rig gate's G11 compares |

## The rig (`src/pinehollow/kingRig.ts`, `scripts/king-rig-bake.mjs`)

- **22 bones.** The spine is body → hips → tail and body → chest (the hump) → neck → head. Each forelimb has
  shoulder → elbow → wrist → hoof, and each hind leg hip → knee → hock → hoof. The joints are measured on the hull (each
  limb's slice centres walked up from its hoof). The hull's generated stance is the rest pose: nothing is un-posed.
- **Weights** come from Blender's bone heat (`scripts/img2mesh/king_heat_weights.py`) on the welded surface. On top of that:
  the rack is rigid on the head, there are 6 length-weighted smoothing passes cut to 4 influences each pass, and the
  weights sit on a 2⁻¹⁶ grid. The phone hull is the desktop's simplified to 13 k tris and takes the desktop's weights.
- **Clips** are procedural and blend on one pose record, then one IK pass plants the hooves: idle, walk, charge,
  strike (the rearing strike), hit, plus sweep, roar, brace and die. The fight names its move in `mem.act`:
  - sweep → the antler sweep;
  - stomp → the rearing strike, with the slam at the wind-up's end when the root ring goes out;
  - bells → roar;
  - a lane's tell → brace;
  - the lane → charge;
  - a bolt → hit.
- **Collision** uses the existing creature hitbox path unchanged: the head ball sits on the skull joint, and the body
  capsule runs along the body bone, so it tilts ~42° while he rears (measured in the live fight). The motor capsule comes
  from the dims.

## Numbers

| | A (today) | B |
|---|---|---|
| desktop GLB (KiB) | 1 025 | 1 120 · 21.7 k tris |
| phone GLB (KiB) | 688 | 726 · 13.1 k tris (+38) |
| phone frame (board) | 70 draws · 1.028 M tris | 70 draws · 1.026 M tris |

Rig gate (`node --import ./scripts/bake-loader.mjs scripts/king-rig-gate.mjs --tier=desktop|phone`): **12 / 12 measured,
pass on both tiers**. Every clip is sampled 24 times. Worst edge stretch 1.99×, 0 px see-through over the rest baseline,
0 foot slide in stance, parity byte-identical.
