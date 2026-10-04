/**
 * The kokpar rider (E306 / E315 M3): a horse and rider mid-game — one rigid Hunyuan3D-2 mesh (`kokpar-rider.glb`, its
 * far LOD `kokpar-rider.far.glb` on the phone; scripts/img2mesh/props/nalati.json), 1.2 × 2.5 × 3.3 m. Six gallop laps
 * round the kokpar field (src/shards/nalati-grasslands/world/Bowl.ts): one InstancedMesh moved every frame, the gallop bent into the mesh
 * in the vertex shader. The card is the file standing still. Walk-through.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { generated } from '../world/painted';

export const kokparRider = defineModel<object>({
  id: 'nalati-grasslands/kokpar-rider', name: 'Kokpar rider', category: 'people', pipeline: 'hunyuan',
  file: 'src/shards/nalati-grasslands/models/kokparRider.ts', surface: 'flesh',
  defaults: {},
  build: generated({ id: 'nalati-grasslands/kokpar-rider', name: 'kokpar-rider', look: { rim: 0.8, bands: 0.85 } }),
});
