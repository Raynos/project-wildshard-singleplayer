import { FLAGS } from '../quests/flags';
import { STRINGS } from './strings';

/** Notes and native winch permissions, with the existing hint/toast beats. */
export const SKY_QUEST_PAGE_INTERACTIONS={bindings:{
  observations:[{target:'winch-up',owner:'world',path:['state','raised']}],
  calls:[{target:'winch',owner:'plugin',path:['isletCalls','runtime','command'],args:['far.winch.bridge',1],optional:true}],
},actions:[
  {id:'notes',interaction:'notes',after:[{kind:'toast',text:STRINGS.notesToast}]},
  {id:'winch',needs:[{none:['winch-up'],else:'already'},{all:[FLAGS.roost,FLAGS.vanes],else:'locked'}],
    denied:{locked:STRINGS.winchLocked},after:[{kind:'call',target:'winch'}]},
]} as const;
