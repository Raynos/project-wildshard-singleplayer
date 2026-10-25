import * as v from 'valibot';
import {expect,test,vi} from 'vitest';
import {Scope} from '../src/engine/app/scope';
import {BinarySourceSchema} from '../src/format/binarySource';
import {binarySourceBytes,prepareBinarySources} from '../src/game/models/binarySource';

test('binary rows refuse ambiguity and getters before touching the file owner',async()=>{
  let getters=0;const source=Object.defineProperty({},'file',{enumerable:true,get:()=>{getters++;return 'shape';}}),file=vi.fn(()=>Promise.resolve(new Uint8Array(4)));
  await expect(prepareBinarySources({file},[{source,bytes:4}])).rejects.toThrow();
  expect(getters).toBe(0);expect(file).not.toHaveBeenCalled();
  expect(()=>v.parse(BinarySourceSchema,{file:'shape',data:'inline'})).toThrow();
  for(const bytes of [-1,.5,Infinity,Number.NaN])await expect(prepareBinarySources({file},[{source:{file:'shape'},bytes}])).rejects.toThrow();
  await expect(prepareBinarySources({file},[{source:{file:'shape'},bytes:4},{source:{file:'shape'},bytes:8}])).rejects.toThrow('Conflicting');
  expect(file).not.toHaveBeenCalled();
});

test('preparation reads each exact file once, keeping raw bytes and the legacy decode unchanged',async()=>{
  const raw=Uint8Array.from([0,255,4,128]),file=vi.fn(()=>Promise.resolve(raw));
  const rows=[{source:{file:'shape'},bytes:4},{source:{file:'shape'},bytes:4}];
  const files=await prepareBinarySources({file,hasFile:()=>true},rows);
  expect(file.mock.calls).toEqual([['shape']]);expect(binarySourceBytes({file:'shape'},files)).toBe(raw);
  const data='eJxj+M/SAAADiQGE'; // The same zlib wire for [0, 255, 4, 128], without an encoder in the fixture.
  expect(binarySourceBytes({data})).toEqual(raw);
  expect(await prepareBinarySources({},[{source:{data},bytes:4}])).toEqual(new Map());
  await expect(prepareBinarySources({file},[{source:{file:'shape'},bytes:8}])).rejects.toThrow('byte count');
  await expect(prepareBinarySources({file,hasFile:()=>false},rows)).rejects.toThrow('Missing');
});

test('held reads refuse reader replacement and sliced ancestor retirement without publication',async()=>{
  for(const retire of [false,true]){
    const parent=new Scope('binary.parent'),scope=parent.child('binary.child');let finish:(bytes:Uint8Array)=>void=()=>undefined;
    const held=new Promise<Uint8Array>(resolve=>{finish=resolve;}),file=vi.fn(()=>held),product={file};
    const pending=prepareBinarySources(product,[{source:{file:'shape'},bytes:4}],scope);
    expect(file).toHaveBeenCalledTimes(1);
    if(retire){const steps=parent.disposeSteps();steps.next();expect(scope.disposing||scope.disposed).toBe(true);}
    else product.file=vi.fn(()=>Promise.resolve(new Uint8Array(4)));
    finish(new Uint8Array(4));await expect(pending).rejects.toThrow(retire?'retired':'changed');parent.dispose();
  }
  const scope=new Scope('binary.ended');scope.dispose();const file=vi.fn(()=>Promise.resolve(new Uint8Array(4)));
  await expect(prepareBinarySources({file},[{source:{file:'shape'},bytes:4}],scope)).rejects.toThrow('retired');expect(file).not.toHaveBeenCalled();
});
