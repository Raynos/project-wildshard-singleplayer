import * as SURFACES from './surfaces';
import { heldPlayback } from '../heldPlayback';

import { WHIP_ROW } from './equipment';
import { WHIP_PHASE } from './meleePhase';
import { WHIP_SCENE, WHIP_WRAP_SCENE, HD_GLOVE_SIZE } from './whip';

const playback = heldPlayback();

const resources = {reads:[
    {id:'hero',from:{owner:'library',path:['hd']},args:['glove-hd4',{size:HD_GLOVE_SIZE,by:'span'}]},
  ],geometry:[
    {id:'coil',from:{owner:'world',path:['geometry']},args:['lash','coil',{index:'array'}]},
    {id:'loop',from:{owner:'world',path:['geometry']},args:['lash','loop',{index:'array'}]},
    {id:'cord',from:{owner:'world',path:['geometry']},args:['lash','cord',{index:'array'}]},
    {id:'wrap',from:{owner:'world',path:['geometry']},args:['lash','wrap',{index:'array'}]},
  ],objects:[{id:'hero',from:{owner:'locals',path:['hero']}}],
  textures:[{id:'plait',from:{owner:'world',path:['bytes']},args:['plait'],requires:'hero',bytes:196608}]} as const;
const decorators = [{id:'plait',from:{owner:'surface',path:['decorate']},args:[SURFACES.COIL_SURFACE]}] as const;
const caught = {row:WHIP_WRAP_SCENE,part:'wrap'} as const;
/** Original held rows, including the caller's exact baked lash dimensions. */
export interface WhipHeldRecipe {
  readonly equipment: typeof WHIP_ROW; readonly phases: typeof WHIP_PHASE; readonly playback: typeof playback; readonly scene: typeof WHIP_SCENE;
  readonly resources: typeof resources & { readonly repeats: readonly [{ readonly id: 'plait.repeat'; readonly value: readonly [number, 1] }]; readonly decorators: typeof decorators };
  readonly tip: readonly [number, number, number]; readonly restingGroup: 'glove'; readonly caught: typeof caught;
}
/** One held/Explorer assembly and caught-wrap recipe. */
export function whipHeldRecipe(dimensions: { readonly along: number; readonly tip: readonly number[] }): WhipHeldRecipe {
  return {equipment:WHIP_ROW,phases:WHIP_PHASE,playback,scene:WHIP_SCENE,
    resources:{...resources,repeats:[{id:'plait.repeat',value:[dimensions.along,1]}],decorators},
    tip:[dimensions.tip[0]??0,dimensions.tip[1]??0,dimensions.tip[2]??0],restingGroup:'glove',caught};
}
