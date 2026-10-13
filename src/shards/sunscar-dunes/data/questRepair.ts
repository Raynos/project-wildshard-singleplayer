import { COMPLETE_FLAG, LATER_FLAGS, PAID_FLAG } from './signalQuest';
import { SCOUT_FLAG } from './flags';

const later = [...LATER_FLAGS, COMPLETE_FLAG];
const scouted = `!scouted && (${later.map((_,i)=>`later${String(i)}`).join(' || ')})`;
/** One transient startup repair: old reward first, then any post-scout save; permanent flags retain the result. */
export const QUEST_REPAIR = {
  version:2,id:'sunscar.quest-repair',
  inputs:{paid:`flag:${PAID_FLAG}`,scouted:`flag:${SCOUT_FLAG}`,legacy:'event:legacy.sunscar.signal',
    ...Object.fromEntries(later.map((flag,i)=>[`later${String(i)}`,`flag:${flag}`]))},
  stages:[
    {id:'initial',do:[],next:[{target:'paid',when:'!paid && legacy'},{target:'scouted',when:scouted},{target:'done',when:'true'}]},
    {id:'paid',do:[{flag:{key:PAID_FLAG,value:true}}],next:[{target:'scouted',when:scouted},{target:'done',when:'true'}]},
    {id:'scouted',do:[{flag:{key:SCOUT_FLAG,value:true}}]},
    {id:'done',do:[],next:'done'},
  ],
};
/** Quiet unconditional initial stage; no save repair command is replayed during seeding. */
export const QUEST_REPAIR_INITIAL = Object.fromEntries(Object.keys(QUEST_REPAIR.inputs).map(name=>[name,false]));
