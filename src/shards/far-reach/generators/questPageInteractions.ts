import FLAGS from '../data/flags.json' with { type: 'json' };
import { STRINGS } from '../data/strings';

/** Notes and native winch permissions, with the existing hint/toast beats. */
export const SKY_QUEST_PAGE_INTERACTIONS={prompts:[
  {id:'winch',label:STRINGS.turnWinch,at:{owner:'frames',path:['winchAt']},radius:3},
  {id:'notes',label:STRINGS.readNotes,at:{owner:'frames',path:['notesAt']},radius:2.6},
],bindings:{
  prompts:[{target:'winch',owner:'world',path:['winch','onInteract']},{target:'notes',owner:'world',path:['notes','onInteract']}],
  observations:[{target:'winch-up',owner:'world',path:['state','raised']}],
  calls:[{target:'winch',owner:'plugin',path:['clientChannels','runtime','command'],args:['far.winch.bridge',1],optional:true}],
},actions:[
  {id:'notes',interaction:'notes',after:[{kind:'toast',text:STRINGS.notesToast}]},
  {id:'winch',needs:[{none:['winch-up'],else:'already'},{all:[FLAGS.roost,FLAGS.vanes],else:'locked'}],
    denied:{locked:STRINGS.winchLocked},after:[{kind:'call',target:'winch'}]},
]} as const;
