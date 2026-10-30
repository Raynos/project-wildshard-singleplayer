import {expect,test} from 'vitest';
import * as v from 'valibot';
import {checkTitanLedger,TitanHandoffSchema,type TitanPart} from './fixtures/headless/titanHandoff';

function parts(count:number,ticks=1,commands=0,ownerBytes=0):TitanPart[]{
  return Array.from({length:count},(_,index)=>({plan:{version:1,observe:['nalati.titan','nalati.weapons','nalati.chapter-records'],
    segments:[{id:`titan-${index}`,ticks,commands:[],frames:Array.from({length:ticks},()=>Array.from({length:commands},()=>({kind:'script' as const,actorId:'input',value:1})))}]},
    expected:{version:1,ticks,observations:[{id:`titan-${index}`,tick:900+(index+1)*ticks,position:[0,0,0],peakY:0,grounded:true,flags:[],quests:[],effects:[],
      adapters:[{id:'native',state:'x'.repeat(ownerBytes)}]}]},digest:'a'.repeat(64)}));
}

test('the earned prefix remains charged when a second case continues it',()=>{
  const prefix=parts(64),whole=parts(128);
  expect(()=>checkTitanLedger(prefix,900)).not.toThrow();
  expect(()=>checkTitanLedger(whole,900)).not.toThrow();
  expect(()=>checkTitanLedger(parts(129),900)).toThrow('part allowance');
  // Each half alone fits. Their combined commands, fixed ticks and actual
  // observation bytes must fit the original single tape, not two budgets.
  expect(()=>checkTitanLedger(parts(64,1,512),900)).not.toThrow();
  expect(()=>checkTitanLedger(parts(128,1,512),900)).toThrow('aggregate tape');
  expect(()=>checkTitanLedger(parts(118,512),900)).toThrow('aggregate tape');
  expect(()=>checkTitanLedger(parts(9,1,0,500_000),900)).not.toThrow();
  expect(()=>checkTitanLedger(parts(18,1,0,500_000),900)).toThrow('aggregate tape');
});

function entry<T>(rows:readonly T[],index:number):T{
  const value=rows[index];if(value===undefined)throw new Error('Missing test input');return value;
}

test('a handoff cannot omit, reorder or relabel the checked input intervals',()=>{
  const gap=parts(2);entry(entry(gap,1).expected.observations,0).tick++;
  expect(()=>checkTitanLedger(gap,900)).toThrow('skipped');
  const reordered=parts(2).reverse();
  expect(()=>checkTitanLedger(reordered,900)).toThrow('ordered');
  const selection=parts(2);entry(selection,1).plan.observe.pop();
  expect(()=>checkTitanLedger(selection,900)).toThrow('ordered');
  const truncated=parts(2);entry(entry(truncated,1).plan.segments,0).frames?.pop();
  expect(()=>checkTitanLedger(truncated,900)).toThrow('ordered');
});

test('only the checked pre-combat storm handoff may have an empty combat ledger',()=>{
  const common={version:1,source:'a'.repeat(64),snapshot:'actual-wire',digest:'b'.repeat(64),checkpointTick:900,captureTicks:900,initialKills:0};
  expect(()=>v.parse(TitanHandoffSchema,{...common,stage:'storm',parts:[]})).not.toThrow();
  expect(()=>v.parse(TitanHandoffSchema,{...common,stage:'storm',captureTicks:901,parts:[]})).toThrow();
  expect(()=>v.parse(TitanHandoffSchema,{...common,stage:'storm',captureTicks:901,parts:parts(1)})).toThrow();
  expect(()=>v.parse(TitanHandoffSchema,{...common,stage:'fire',parts:[]})).toThrow();
  expect(()=>v.parse(TitanHandoffSchema,{...common,stage:'fire',captureTicks:901,parts:parts(1)})).not.toThrow();
  expect(()=>v.parse(TitanHandoffSchema,{...common,stage:'fire',captureTicks:902,parts:parts(1)})).toThrow();
});
