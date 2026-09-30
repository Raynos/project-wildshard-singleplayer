/**
 * The herd horse (E306 / E315 M3): the far LOD of the Hunyuan3D-2 wild horse (`horse-wild.far.glb`, ~800 triangles,
 * its coat in vertex colours; scripts/img2mesh/props/nalati.json) — the herds in the hundreds on the Sky Grassland
 * (src/world/nalati/Bowl.ts): one InstancedMesh per herd, each horse tinted to its coat, grazing and drifting, hidden
 * near the viewer (the AI herd is the near one). The rigged wild horse is the creature (src/entities/, M5). Walk-through.
 */
import { defineModel } from '../../../models/model';
import { generated } from '../../../world/nalati/painted';

export const herdHorse = defineModel<object>({
  id: 'nalati-grasslands/herd-horse', name: 'Herd horse (far)', category: 'props', pipeline: 'hunyuan',
  file: 'src/chunks/nalati-grasslands/models/herdHorse.ts', surface: 'flesh',
  defaults: {},
  build: generated({ id: 'nalati-grasslands/herd-horse', name: 'horse-wild', lod: 'far', look: { rim: 0.8, bands: 0.85 } }),
});
