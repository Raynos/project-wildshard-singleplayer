import * as MODELS from './files';
import { RAY_BODY, SKITTERER_BODY } from './species/bodies';
import { SIGNAL_CREATURE_LOOK_ROWS } from './creatureLooks';
import STRINGS from '../../data/strings.json' with { type: 'json' };

export interface StriderBody {
  readonly bones: readonly { readonly name: string; readonly parent: string | null; readonly pos: readonly [number, number, number] }[];
  readonly dims: { readonly bodyY: number; readonly bodyHalfLen: number; readonly bodyRadius: number; readonly headRadius: number; readonly legLen: number; readonly halfWidth: number };
}
export interface RigLibrary {
  readonly bodies: { readonly creatures: typeof MODELS.DUNE_RIGS; readonly urls: Readonly<Record<MODELS.DuneRigName, string>>;
    readonly standIns: { readonly skitterer: typeof SKITTERER_BODY; readonly strider: StriderBody; readonly ray: typeof RAY_BODY; readonly matriarch: typeof RAY_BODY }; readonly fault: string };
  readonly looks: typeof SIGNAL_CREATURE_LOOK_ROWS;
}
/** Original rig load order, first-map selection and stand-in skeletons. */
export function signalRigLibrary(urls: Readonly<Record<MODELS.DuneRigName, string>>, strider: StriderBody): RigLibrary {
  return { bodies: { creatures: MODELS.DUNE_RIGS, urls,
    standIns: { skitterer: SKITTERER_BODY, strider, ray: RAY_BODY, matriarch: RAY_BODY }, fault: '[sunscar-dunes]' }, looks: SIGNAL_CREATURE_LOOK_ROWS };
}
const specimen = { parts: 'first', material: { vertexColors: true, roughness: 0.8, flatShading: true } } as const;
const file = 'src/shards/sunscar-dunes/generators/rows/rigLibrary.ts';
export const SIGNAL_MODEL_SPECIMENS = [
  { body: 'ray', specimen, model: { id: 'sunscar-dunes/dune-ray', name: STRINGS.ray, category: 'creatures', pipeline: ['hunyuan'], file } },
  { body: 'skitterer', specimen, model: { id: 'sunscar-dunes/sand-skitterer', name: STRINGS.skitterer, category: 'creatures', pipeline: 'code', file } },
  { body: 'strider', specimen, model: { id: 'sunscar-dunes/dune-strider', name: STRINGS.strider, category: 'creatures', pipeline: ['hunyuan', 'code'], file } },
  { body: 'matriarch', specimen: { ...specimen, scale: 3.6 }, model: { id: 'sunscar-dunes/dune-matriarch', name: STRINGS.matriarch, category: 'creatures', pipeline: ['hunyuan', 'code'], file } },
] as const;
