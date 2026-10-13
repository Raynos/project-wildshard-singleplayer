import {expect,it} from 'vitest';
import {bindDirectorActions} from '@wildshard/game/plugin/director';
import {QUEST_REPAIR,QUEST_REPAIR_INITIAL} from '../src/shards/sunscar-dunes/data/questRepair';
import {COMPLETE_FLAG,LATER_FLAGS,PAID_FLAG} from '../src/shards/sunscar-dunes/data/signalQuest';
import {SCOUT_FLAG} from '../src/shards/sunscar-dunes/data/flags';

it('preserves every old-save flag result and ordered writes, then repeats idempotently without a saved cursor',()=>{
  const later=[...LATER_FLAGS,COMPLETE_FLAG];
  for(let mask=0;mask<2**later.length;mask++)for(const paid of [false,true])for(const scouted of [false,true])for(const legacy of [false,true]){
    const initial=later.filter((_,i)=>(mask&(2**i))!==0);
    if(paid)initial.push(PAID_FLAG);if(scouted)initial.push(SCOUT_FLAG);
    const expected=new Set(initial), actual=new Set(initial), oldWrites:string[]=[], writes:string[]=[];
    let oldReads=0, reads=0;
    const oldRead=():boolean=>{oldReads++;return legacy;};
    const read=():boolean=>{reads++;return legacy;};
    if(!expected.has(PAID_FLAG)&&oldRead()){expected.add(PAID_FLAG);oldWrites.push(PAID_FLAG);}
    if(!expected.has(SCOUT_FLAG)&&later.some(flag=>expected.has(flag))){expected.add(SCOUT_FLAG);oldWrites.push(SCOUT_FLAG);}
    const repair=():void=>{
      const legacyPaid=!actual.has(PAID_FLAG)&&read();
      const stage=bindDirectorActions(QUEST_REPAIR,{flags:{has:key=>actual.has(key),set:key=>{actual.add(key);writes.push(key);}},
        initial:[QUEST_REPAIR_INITIAL],bindings:[],observe:binding=>{
          if(binding!=='event:legacy.sunscar.signal')throw new Error('Unknown quest repair observation');return legacyPaid;
        }});
      stage.advance();stage.advance();stage.advance();
    };
    repair();
    expect([...actual].sort()).toEqual([...expected].sort());expect(writes).toEqual(oldWrites);expect(reads).toBe(oldReads);
    repair();expect(writes).toEqual(oldWrites);
  }
});
