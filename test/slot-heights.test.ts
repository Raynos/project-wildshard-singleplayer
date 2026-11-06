import {expect,test} from 'vitest';
import {Vector3} from 'three';
import {createSimHost} from '../src/engine/server/sim';
import {fixtureBytes} from '@wildshard/engine/test/nativeBytes';
import {loadRapier} from '../src/engine/shared/physics/rapier';
import {SlotHeights} from '../src/game/server/boss/slotHeights';
import {compileScriptV2} from '../src/sharddev/bake/compileScriptV2';
import {nalatiCreatureViews} from '../src/shards/nalati-grasslands/generators/creatureViews';
import source from '../src/shards/nalati-grasslands/behaviour/creatureViews.as?raw';
import {SIM_LEVEL} from './fixtures/sim-level/level';

const ground=():number=>3;
test('a dying body\'s sink carries through a save, and a live body saves nothing',async()=>{
  const rows=nalatiCreatureViews(),bytes=await compileScriptV2(source,{lane:'view',ioBytes:rows.budget.ioBytes});
  const rapier=await loadRapier(Uint8Array.from(fixtureBytes(new URL('../public/assets/physics/rapier.wasm',import.meta.url))));
  const first=SIM_LEVEL.entities[0];if(first===undefined)throw new Error('Missing a fixture body');
  const make=()=>createSimHost({...SIM_LEVEL,quests:[],entities:[{...first,spec:{...first.spec,kind:'balbal'},id:'view:1'}]},{rapier});
  const record=make(),restored=make(),fresh=make();
  const hosts=[record,restored,fresh].map(host=>{const body=host.entities.get('view:1');if(body===undefined)throw new Error('Missing a body');return {host,body};});
  const [ran,copy,lost]=hosts;if(ran===undefined||copy===undefined||lost===undefined)throw new Error('Missing a host');
  const heights=({host,body}:typeof ran)=>new SlotHeights(bytes,rows,'balbal',host.scope,()=>[body],ground);
  const going=heights(ran),next=heights(copy),restart=heights(lost);
  try{
    const step=(tick:number):void=>{
      for(const {body}of tick<90?[ran]:hosts){body.mem['field']=0;if(tick===30)body.applyDamage(10000,new Vector3(),new Vector3());}
      going.frame(1/30);
      if(tick>90){next.frame(1/30);restart.frame(1/30);}
    };
    expect(going.snapshot()).toBeNull();
    for(let tick=0;tick<=29;tick++)step(tick);
    expect(going.snapshot()).toBeNull();
    for(let tick=30;tick<=90;tick++)step(tick);
    expect(ran.body.alive).toBe(false);expect(ran.body.yOffset).toBeLessThan(0);
    copy.body.restore(ran.body.snapshot());lost.body.restore(ran.body.snapshot());
    const saved=JSON.stringify(going.snapshot());expect(saved.length).toBeLessThan(40_000);
    next.restore(JSON.parse(saved));
    for(let tick=91;tick<120;tick++)step(tick);
    expect(Object.is(copy.body.yOffset,ran.body.yOffset)).toBe(true);
    expect(lost.body.yOffset).toBeGreaterThan(ran.body.yOffset+.5);
  }finally{record.dispose();restored.dispose();fresh.dispose();}
});
