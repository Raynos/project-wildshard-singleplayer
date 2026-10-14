import { FAN_GUST } from './items';
import { VANES } from './layout';
import { FLAGS } from '../quests/flags';
import { STRINGS } from './strings';

/** Notes and native winch permissions, with the existing hint/toast beats. */
export const SKY_QUEST_PAGE_INTERACTIONS={world:VANES.map(vane=>({id:vane.id,at:{kind:'point',x:vane.x,y:vane.y+3.3,z:vane.z},radius:0,
  cone:{reach:FAN_GUST.reach+2,halfAngle:FAN_GUST.halfAngle+0.15},needs:{all:[FLAGS.notes],none:[`far.vane.${vane.id}`]},sets:[`far.vane.${vane.id}`],toast:STRINGS.vaneTurned})),bindings:{
  prompts:[{target:'notes',owner:'world',path:['notes','onInteract']},{target:'winch',owner:'world',path:['winch','onInteract']}],
  observations:[{target:'winch-up',owner:'world',path:['state','raised']}],
  calls:[{target:'winch',owner:'plugin',path:['isletCalls','runtime','command'],args:['far.winch.bridge',1],optional:true}],
},actions:[
  {id:'notes',interaction:'notes',after:[{kind:'toast',text:STRINGS.notesToast}]},
  {id:'winch',needs:[{none:['winch-up'],else:'already'},{all:[FLAGS.roost,FLAGS.vanes],else:'locked'}],
    denied:{locked:STRINGS.winchLocked},after:[{kind:'call',target:'winch'}]},
]} as const;
