import { nativeEliteCore } from './fixtures/nativeEliteCore';
import {expect,test} from 'vitest';
import * as v from 'valibot';
import {installEliteEncounters,eliteBindings,type EliteEncounterPorts,type EliteEncounterRow} from './fixtures/nativeEliteEncounters';
import type {SimHost,SimValue} from '../src/engine/sim';
import {legacyDouble} from './fake/FakeGame';
import { nativeKernelOwners } from './fixtures/nativeEliteKernelOwners';
import { installEliteEncounters as originalInstall, type EliteEncounterPorts as OriginalPorts, type EliteEncounterRow as OriginalRow } from './fixtures/originalEliteEncounters';
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with {type:'json'};

test('native member admission preserves strict pack fields and original continuation bytes',()=>{
  let adapter:Parameters<SimHost['onStep']>[2];
  const fixture=nativeKernelOwners(),host=fixture.host;
  Object.defineProperty(host,'onStep',{value:(_id:string,_step:unknown,saved:Parameters<SimHost['onStep']>[2])=>{adapter=saved;return ()=>undefined;}});
  const pouncer=ecology.keeperElites.find(row=>row.pattern==='pouncer'),howler=ecology.keeperElites.find(row=>row.pattern==='howler');
  if(pouncer?.pattern!=='pouncer'||howler?.pattern!=='howler')throw new Error('Missing original native profiles');
  const originalRows:OriginalRow[]=[{def:pouncer.def,keeper:'pouncer',snapshot:'solo',member:{kind:pouncer.kind,variant:pouncer.def.id,source:'boot',yaw:pouncer.yaw}},
    {def:howler.def,keeper:'howler',snapshot:'group',member:{kind:howler.kind,variant:howler.def.id,source:'boot',yaw:howler.yaw},pack:{offset:[0,0],variants:[],kind:'herd',idPrefix:'herd'}}];
  const rows:EliteEncounterRow[]=originalRows.map(row=>({...row,keeper:'kernel'}));
  const ports=legacyDouble<EliteEncounterPorts>({bindings:eliteBindings(),groups:{packs:[],herds:[]},
    kernels:{rows:fixture.rows,contacts:fixture.loans.contacts,strikes:fixture.loans.strikes,terrain:fixture.loans.terrain,
      environment:fixture.loans.environment,ledges:[]}});
  installEliteEncounters(host,{step:'marsh.elites',version:1,core:nativeEliteCore(host),rows,ports,wire:{}});
  if(adapter===undefined)throw new Error('Missing original native save adapter');
  const savedAdapter=adapter;
  const save=savedAdapter.snapshot();
  if(save===null||typeof save!=='object'||Array.isArray(save))throw new Error('Missing native envelope');
  const solo=save['solo'],group=save['group'];
  if(solo===null||typeof solo!=='object'||Array.isArray(solo)||group===null||typeof group!=='object'||Array.isArray(group))throw new Error('Missing native members');
  const bytes=JSON.stringify(save),{pack:_pack,...missingPack}=group;
  const originalFixture=nativeKernelOwners();let originalAdapter:Parameters<SimHost['onStep']>[2];
  Object.defineProperty(originalFixture.host,'onStep',{value:(_id:string,_step:unknown,saved:Parameters<SimHost['onStep']>[2])=>{originalAdapter=saved;return ()=>undefined;}});
  const oldPorts=legacyDouble<OriginalPorts>({bindings:eliteBindings(),keepers:{pouncer:pouncer.spec,howler:howler.spec,herd:{rows:{},program:{}}},
    ledges:[],heightAt:()=>0,environment:()=>originalFixture.loans.environment,packs:()=>[]});
  originalInstall(originalFixture.host,{step:'marsh.elites',version:1,conditions:{mode:'phase',phase:()=> 'day',storm:()=>false},rows:originalRows,ports:oldPorts,wire:{}});
  expect(JSON.stringify(originalAdapter?.snapshot())).toBe(bytes);
  originalFixture.scope.dispose();

  expect(Object.hasOwn(solo,'pack')).toBe(false);expect(group['pack']).toBeNull();
  expect(()=>savedAdapter.restore({...save,solo:{...solo,pack:null}})).toThrow();
  expect(()=>savedAdapter.restore({...save,group:missingPack})).toThrow();
  expect(()=>savedAdapter.restore({...save,solo:{...solo,extra:true}})).toThrow();
  expect(JSON.stringify(savedAdapter.snapshot())).toBe(bytes);
  const Value:v.GenericSchema<SimValue>=v.lazy(()=>v.union([v.null(),v.boolean(),v.number(),v.string(),v.array(Value),v.record(v.string(),Value)]));
  savedAdapter.restore(v.parse(Value,JSON.parse(bytes)));
  expect(JSON.stringify(savedAdapter.snapshot())).toBe(bytes);
  fixture.scope.dispose();
});
