import { DUNE_RIGS, DUNE_RIG_URLS } from './files';
import { STRIDER_BODY } from './striderRig.baked';
import { RAY_BODY, SKITTERER_BODY } from './species/bodies';
import { SIGNAL_CREATURE_LOOK_ROWS } from './creatureLooks';
import { STRINGS } from './strings';

/** Original rig load order, first-map selection and stand-in skeletons. */
export const SIGNAL_RIG_LIBRARY = { bodies: { creatures: DUNE_RIGS, urls: DUNE_RIG_URLS,
  standIns: { skitterer: SKITTERER_BODY, strider: STRIDER_BODY, ray: RAY_BODY, matriarch: RAY_BODY }, fault: '[sunscar-dunes]' }, looks: SIGNAL_CREATURE_LOOK_ROWS };
const specimen = { parts: 'first', material: { vertexColors: true, roughness: 0.8, flatShading: true } } as const;
const file = 'src/shards/sunscar-dunes/data/rigLibrary.ts';
export const SIGNAL_MODEL_SPECIMENS = [
  { body: 'ray', specimen, model: { id: 'sunscar-dunes/dune-ray', name: STRINGS.ray, category: 'creatures', pipeline: ['hunyuan'], file } },
  { body: 'skitterer', specimen, model: { id: 'sunscar-dunes/sand-skitterer', name: STRINGS.skitterer, category: 'creatures', pipeline: 'code', file } },
  { body: 'strider', specimen, model: { id: 'sunscar-dunes/dune-strider', name: STRINGS.strider, category: 'creatures', pipeline: ['hunyuan', 'code'], file } },
  { body: 'matriarch', specimen: { ...specimen, scale: 3.6 }, model: { id: 'sunscar-dunes/dune-matriarch', name: STRINGS.matriarch, category: 'creatures', pipeline: ['hunyuan', 'code'], file } },
] as const;
