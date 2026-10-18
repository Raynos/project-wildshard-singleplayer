import { parseDeclaredQuestPage } from '@wildshard/format/declaredQuestPage';
import FLAGS from '../data/flags.json' with { type: 'json' };
import STRINGS from '../data/strings.json' with { type: 'json' };

/** Notes and native winch permissions, with the existing hint/toast beats. */
export const SKY_QUEST_PAGE_INTERACTIONS=parseDeclaredQuestPage({version:1,quest:'far.quest',prompts:[
  {id:'winch',action:'winch',label:STRINGS.turnWinch,at:{point:'frames.winch-at'},radius:3,
    labels:[{when:{all:[FLAGS.raised]},text:STRINGS.raised}]},
  {id:'notes',action:'notes',label:STRINGS.readNotes,at:{point:'frames.notes-at'},radius:2.6},
],observations:[{id:'winch-up',source:{mover:'far.winch.bridge',state:'at-end'}}],actions:[

  {id:'notes',interaction:'notes',after:[{kind:'toast',text:STRINGS.notesToast}]},
  {id:'winch',needs:[{none:['winch-up'],else:'already'},{all:[FLAGS.roost,FLAGS.vanes],else:'locked'}],
    denied:{locked:STRINGS.winchLocked},after:[{kind:'mover',id:'far.winch.bridge',command:1}]},
]});
