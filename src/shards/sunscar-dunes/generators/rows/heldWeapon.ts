import * as SURFACES from './surfaces';
import { heldPlayback } from '../heldPlayback';

import { WHIP_ROW } from './equipment';
import { WHIP_PHASE } from './meleePhase';
import { WHIP_SCENE, WHIP_WRAP_SCENE, HD_GLOVE_SIZE } from './whip';

const playback: ReturnType<typeof heldPlayback> = heldPlayback();

const resources: { readonly reads: readonly [{ readonly id: "hero"; readonly from: { readonly owner: "library"; readonly path: readonly ["hd"]; }; readonly args: readonly ["glove-hd4", { readonly size: 0.14; readonly by: "span"; }]; }]; readonly geometry: readonly [{ readonly id: "coil"; readonly from: { readonly owner: "world"; readonly path: readonly ["geometry"]; }; readonly args: readonly ["lash", "coil", { readonly index: "array"; }]; }, { readonly id: "loop"; readonly from: { readonly owner: "world"; readonly path: readonly ["geometry"]; }; readonly args: readonly ["lash", "loop", { readonly index: "array"; }]; }, { readonly id: "cord"; readonly from: { readonly owner: "world"; readonly path: readonly ["geometry"]; }; readonly args: readonly ["lash", "cord", { readonly index: "array"; }]; }, { readonly id: "wrap"; readonly from: { readonly owner: "world"; readonly path: readonly ["geometry"]; }; readonly args: readonly ["lash", "wrap", { readonly index: "array"; }]; }]; readonly objects: readonly [{ readonly id: "hero"; readonly from: { readonly owner: "locals"; readonly path: readonly ["hero"]; }; }]; readonly textures: readonly [{ readonly id: "plait"; readonly from: { readonly owner: "world"; readonly path: readonly ["bytes"]; }; readonly args: readonly ["plait"]; readonly requires: "hero"; readonly bytes: 196608; }]; } = {reads:[
    {id:'hero',from:{owner:'library',path:['hd']},args:['glove-hd4',{size:HD_GLOVE_SIZE,by:'span'}]},
  ],geometry:[
    {id:'coil',from:{owner:'world',path:['geometry']},args:['lash','coil',{index:'array'}]},
    {id:'loop',from:{owner:'world',path:['geometry']},args:['lash','loop',{index:'array'}]},
    {id:'cord',from:{owner:'world',path:['geometry']},args:['lash','cord',{index:'array'}]},
    {id:'wrap',from:{owner:'world',path:['geometry']},args:['lash','wrap',{index:'array'}]},
  ],objects:[{id:'hero',from:{owner:'locals',path:['hero']}}],
  textures:[{id:'plait',from:{owner:'world',path:['bytes']},args:['plait'],requires:'hero',bytes:196608}]} as const;
const decorators: readonly [{ readonly id: 'plait'; readonly from: { readonly owner: 'surface'; readonly path: readonly ['decorate'] }; readonly args: readonly [typeof SURFACES.COIL_SURFACE] }] = [{id:'plait',from:{owner:'surface',path:['decorate']},args:[SURFACES.COIL_SURFACE]}] as const;
const caught: { readonly row: typeof WHIP_WRAP_SCENE; readonly part: 'wrap' } = {row:WHIP_WRAP_SCENE,part:'wrap'} as const;
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
