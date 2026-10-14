import playback from './heldPlayback.generated.json' with {type:'json'};
import scene from './fanScene.json' with {type:'json'};
import hand from './fanHandScene.json' with {type:'json'};
import { FAN_ROW } from './equipment';
import { FAN_PHASE } from './meleePhase';

/** One held/Explorer assembly, borrowing the optional original hero-hand resources. */
export const FAN_HELD_RECIPE = {equipment:FAN_ROW,phases:FAN_PHASE,playback,scene,attachments:[{id:'hand',row:hand,parent:'root'}]} as const;
