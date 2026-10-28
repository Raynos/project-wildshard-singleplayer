// @vitest-environment happy-dom
import {afterEach,expect,test,vi} from 'vitest';
import {Scope} from '../src/engine/app/scope';
import {readPrefetchIndex} from '../src/game/grid/prefetchIndex';
import type {OutputDownloadIndex} from '../src/format/outputDownload';

const hash='a'.repeat(64);
const index={format:'wildshard.shardfile',formatVersion:2,sections:[],schemas:[],files:[],runtime:null} satisfies OutputDownloadIndex & {format:'wildshard.shardfile';formatVersion:2};
afterEach(()=>{vi.unstubAllGlobals();});

test('index admission delegates bytes to the existing cache writer and closes its worker',async()=>{
  let closed=0;const calls:unknown[]=[],body=new Uint8Array([1,2,3]);
  class Port extends EventTarget {
    terminate():void{closed++;}
    postMessage(input:unknown):void{
      if(input===null||typeof input!=='object')throw new Error('Missing request');
      calls.push(input);
      if(Reflect.get(input,'kind')==='prepare')queueMicrotask(()=>{this.dispatchEvent(new MessageEvent('message',{data:{kind:'cache-get',id:1,hash}}));});
      else {
        expect(Reflect.get(input,'value')).toEqual(body);
        queueMicrotask(()=>{this.dispatchEvent(new MessageEvent('message',{data:{kind:'prepared',index}}));});
      }
    }
  }
  vi.stubGlobal('Worker',Port);
  const result=await readPrefetchIndex({url:'http://localhost/shard.json',indexHashes:[hash],phone:true},
    {get:key=>{expect(key).toBe(hash);return Promise.resolve(body);},put:()=>Promise.reject(new Error('Unexpected second writer'))});
  expect(result).toEqual(index);expect(calls).toHaveLength(2);expect(closed).toBe(1);
});

test('malformed worker schedules refuse and release the same owner',async()=>{
  let closed=0;
  class Port extends EventTarget {
    terminate():void{closed++;}
    postMessage():void{queueMicrotask(()=>{this.dispatchEvent(new MessageEvent('message',{data:{kind:'prepared',index:{...index,files:[{path:'../escape',hash,compressed:1}]}}}));});}
  }
  vi.stubGlobal('Worker',Port);
  await expect(readPrefetchIndex({url:'http://localhost/shard.json',indexHashes:[hash],phone:false},
    {get:()=>Promise.resolve(null),put:()=>Promise.resolve(false)})).rejects.toThrow();
  expect(closed).toBe(1);
});


test('retired estimates close their worker without forwarding late cache replies',async()=>{
  let closed=0,release:((body:Uint8Array|null)=>void)|undefined,started:(()=>void)|undefined;
  const calls:unknown[]=[],reading=new Promise<void>(resolve=>{started=resolve;});
  class Port extends EventTarget {
    terminate():void{closed++;}
    postMessage(input:unknown):void{
      calls.push(input);
      queueMicrotask(()=>{this.dispatchEvent(new MessageEvent('message',{data:{kind:'cache-get',id:1,hash}}));});
    }
  }
  vi.stubGlobal('Worker',Port);
  const owner=new Scope('offline-estimate-test');
  try{
    const pending=readPrefetchIndex({url:'http://localhost/shard.json',indexHashes:[hash],phone:true},
      {get:()=>{started?.();return new Promise<Uint8Array|null>(resolve=>{release=resolve;});},put:()=>Promise.reject(new Error('Unexpected second writer'))},owner);
    const refused=expect(pending).rejects.toThrow('Prefetch index owner ended');
    await reading;owner.dispose();await refused;
    expect(closed).toBe(1);expect(calls).toHaveLength(1);
    release?.(new Uint8Array([1,2,3]));
    for(let i=0;i<5;i++)await Promise.resolve();
    expect(calls).toHaveLength(1);expect(closed).toBe(1);
    await expect(readPrefetchIndex({url:'http://localhost/shard.json',indexHashes:[hash],phone:true},
      {get:()=>Promise.resolve(null),put:()=>Promise.resolve(false)},owner)).rejects.toThrow('Prefetch index owner ended');
    expect(calls).toHaveLength(1);expect(closed).toBe(1);
  }finally{owner.dispose();}
});
