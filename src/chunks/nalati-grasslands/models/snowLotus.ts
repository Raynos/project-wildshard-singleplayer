/**
 * The snow lotus (E306 / E315 M3; Saussurea involucrata): the TRELLIS.2 flower (`snow-lotus.glb`,
 * scripts/img2mesh/props/nalati.json), 0.55 × 0.5 m — clustered in the rocks of the snow ring (src/world/nalati/Bowl.ts
 * scatters them: the Snow lotus meadow set). One InstancedMesh for every copy; no shadow on the phone. Walk-through.
 */
import { defineModel } from '../../../models/model';
import { TIER } from '../../../core/tier';
import { generated } from '../../../world/nalati/painted';

export const snowLotus = defineModel<object>({
  id: 'nalati-grasslands/snow-lotus', name: 'Snow lotus', category: 'nature', pipeline: 'trellis',
  file: 'src/chunks/nalati-grasslands/models/snowLotus.ts', surface: 'grass',
  defaults: {},
  build: generated({ id: 'nalati-grasslands/snow-lotus', name: 'snow-lotus', look: { rim: 0.6, bands: 0.7 }, castShadow: TIER !== 'phone' }),
});
