/**
 * How each generated creature hull was made (E306 M0a: the Model Explorer card's badge). The rigs are code
 * (src/entities/species/); a hull is a TRELLIS.2 or Hunyuan3D-2 mesh baked onto them (scripts/creature-rig-bake.mjs,
 * scripts/nalati-rig-bake.mjs). M5 moves each species onto `defineModel`, where the pipeline is a field and this
 * table goes.
 */
import type { Pipeline } from '../world/registry';

/** hull rig name (glbCreatures.ts `HULL`, pineCreatures.ts `HULL`) → the generator that made it */
export const HULL_PIPELINE: Readonly<Record<string, Pipeline>> = {
  // Nalati (art/nalati-grasslands/round-5-models/, round-10-models-merge/)
  'horse-wild': 'hunyuan', 'horse-saddled': 'hunyuan', wolf: 'trellis', 'snow-leopard': 'trellis', eagle: 'trellis',
  collie: 'hunyuan', 'ghost-horse': 'hunyuan', 'golden-king': 'hunyuan',
  // Pine Hollow (art/pine-hollow/round-9-creature-refs/)
  'deer-hind': 'trellis', 'deer-stag': 'hunyuan', boar: 'hunyuan', 'elk-cow': 'hunyuan', 'elk-bull': 'hunyuan',
  'bear-black': 'hunyuan', 'bear-brown': 'hunyuan', 'antler-king': 'hunyuan',
};

/** species whose mesh is a generated GLB of its own, not a hull on the shared rigs (Driftwood's Drowned Captain) */
export const SPECIES_PIPELINE: Readonly<Record<string, Pipeline>> = { captain: 'hunyuan' };
