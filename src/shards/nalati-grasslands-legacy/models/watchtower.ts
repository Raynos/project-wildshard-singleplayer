/**
 * The watchtower (E306 / E315 M3): the ruined stone watchtower on its rock on the east rim (layout v2) — a Hunyuan3D-2
 * model (`watchtower.glb`, scripts/img2mesh/props/nalati.json), 8.7 × 12 × 7.2 m, its doorway the file's +Z. Used once
 * (src/shards/nalati-grasslands/world/Bowl.ts), instanced with its place's other generated models when the file lands.
 *
 * Placed on the lowest ground under its footprint, sunk 0.4 m into its rock (the rubble skirt runs into it), `rot` =
 * the way its doorway faces. Collides: the tower's shell as one box (the ruin is open at the top; you can stand in the
 * doorway).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { MODEL_SIZE } from '../world/glbPaint';
import { generated } from '../world/painted';

const [W, H, D] = MODEL_SIZE.watchtower;

export const watchtower = defineModel<object>({
  id: 'nalati-grasslands/watchtower', name: 'Watchtower', category: 'buildings', pipeline: 'hunyuan',
  file: 'src/shards/nalati-grasslands/models/watchtower.ts', surface: 'stone',
  defaults: {},
  build: generated({
    id: 'nalati-grasslands/watchtower', name: 'watchtower', look: { rim: 0.3, bands: 0.8 },
    pose: (at) => ({ x: at.x, y: at.y - 0.4, z: at.z, rot: at.rot ?? 0 }),
    collide: (at) => ({ boxes: [{ x: at.x, z: at.z, hw: W * 0.36, hd: D * 0.36, rot: -(at.rot ?? 0), yBottom: at.y - 2, yTop: at.y + H * 0.85 }] }),
  }),
});
