import { FLAGS } from '../quest/flags';
import { STRINGS } from './strings';

/** Notes and native winch permissions, with the existing hint/toast beats. */
export const SKY_QUEST_PAGE_INTERACTIONS={actions:[
  {id:'notes',interaction:'notes',after:[{kind:'toast',text:STRINGS.notesToast}]},
  {id:'winch',needs:[{none:['winch-up'],else:'already'},{all:[FLAGS.roost,FLAGS.vanes],else:'locked'}],
    denied:{locked:STRINGS.winchLocked},after:[{kind:'call',target:'winch'}]},
]} as const;
