import playback from './heldPlayback.generated.json' with {type:'json'};
import lash from './lash.json' with {type:'json'};
import { WHIP_ROW } from './equipment';
import { WHIP_PHASE } from './meleePhase';
import { WHIP_SCENE, WHIP_WRAP_SCENE } from './whip';

/** One held/Explorer assembly and caught-wrap recipe. */
export const WHIP_HELD_RECIPE = {equipment:WHIP_ROW,phases:WHIP_PHASE,playback,scene:WHIP_SCENE,
  tip:[lash.tip[0]??0,lash.tip[1]??0,lash.tip[2]??0],restingGroup:'glove',caught:{row:WHIP_WRAP_SCENE,part:'wrap'}} as const;
