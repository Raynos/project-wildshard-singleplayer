import { COIL_SURFACE } from './surfaces';
import playback from './heldPlayback.generated.json' with {type:'json'};
import lash from './lash.json' with {type:'json'};
import { WHIP_ROW } from './equipment';
import { WHIP_PHASE } from './meleePhase';
import { WHIP_SCENE, WHIP_WRAP_SCENE, HD_GLOVE_SIZE } from './whip';

/** One held/Explorer assembly and caught-wrap recipe. */
export const WHIP_HELD_RECIPE = {equipment:WHIP_ROW,phases:WHIP_PHASE,playback,scene:WHIP_SCENE,
  resources:{reads:[
    {id:'world',from:{owner:'world',path:['last']},args:[]},
    {id:'lash',from:{owner:'locals',path:['world','get'],optional:true},args:['lash']},
    {id:'hero',from:{owner:'library',path:['hd']},args:['glove-hd4',{size:HD_GLOVE_SIZE,by:'span'}]},
  ],geometry:[
    {id:'coil',from:{owner:'locals',path:['lash','get'],optional:true},args:['coil'],result:['geometry'],copyGeometry:true,indexArray:true},
    {id:'loop',from:{owner:'locals',path:['lash','get'],optional:true},args:['loop'],result:['geometry'],copyGeometry:true,indexArray:true},
    {id:'cord',from:{owner:'locals',path:['lash','get'],optional:true},args:['cord'],result:['geometry'],copyGeometry:true,indexArray:true},
    {id:'wrap',from:{owner:'locals',path:['lash','get'],optional:true},args:['wrap'],result:['geometry'],copyGeometry:true,indexArray:true},
  ],objects:[{id:'hero',from:{owner:'locals',path:['hero']}}],
  textures:[{id:'plait',from:{owner:'world',path:['bytes']},args:['plait'],requires:'hero',bytes:196608}],
  repeats:[{id:'plait.repeat',value:[lash.along,1]}],decorators:[{id:'plait',from:{owner:'surface',path:['decorate']},args:[COIL_SURFACE]}]},
  tip:[lash.tip[0]??0,lash.tip[1]??0,lash.tip[2]??0],restingGroup:'glove',caught:{row:WHIP_WRAP_SCENE,part:'wrap'}} as const;
