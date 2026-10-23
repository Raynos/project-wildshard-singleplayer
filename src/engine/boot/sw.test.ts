// @vitest-environment happy-dom
import {afterEach,expect,test,vi} from 'vitest';

function buildPort(value:unknown):value is {postMessage:(message:unknown)=>void}{
  return typeof value==='object'&&value!==null&&'postMessage' in value&&typeof value.postMessage==='function';
}
class WorkerHandle extends EventTarget implements ServiceWorker {
  onerror:ServiceWorker['onerror']=null;
  onstatechange:ServiceWorker['onstatechange']=null;
  readonly scriptURL='https://example.com/sw.js';
  state:ServiceWorkerState='installed';
  readonly messages:unknown[]=[];
  refuse=false;
  build:string|undefined;
  postMessage(message:unknown,transfer?:Transferable[]|StructuredSerializeOptions):void{
    if(this.refuse)throw new Error('Worker retired');this.messages.push(message);
    const port=Array.isArray(transfer)?transfer[0]:undefined;
    if(buildPort(port)&&this.build!==undefined){port.postMessage({build:this.build});}
  }
}

afterEach(async()=>{
  (await import('../app/resources')).pageScope.dispose();
  Reflect.deleteProperty(window,'__ws_sw');
  vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();
});

test('adoption skips stale workers, fences its controller and retires expired navigation callbacks',async()=>{
  vi.useFakeTimers();vi.stubGlobal('__BUILD_ID__','before-build');
  const reload=vi.fn<()=>void>(),replace=vi.fn<(url:string)=>void>();
  vi.stubGlobal('location',Object.assign(new URL('https://example.com/?sw=1'),{reload,replace}));
  const original=new WorkerHandle();original.state='activated';
  const installing=new WorkerHandle();installing.state='installing';installing.build='before-build-stamp';
  const registration=Object.assign(new EventTarget(),{waiting:null,installing,update:()=>Promise.resolve()});
  const container=Object.assign(new EventTarget(),{controller:original,register:()=>Promise.resolve(registration)});
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:container});
  const {wsSw,swAdopt}=await import('./sw');await wsSw.ready;
  const initial=vi.getTimerCount(),originalMessages=[...original.messages];
  await swAdopt();expect(vi.getTimerCount()).toBe(initial);
  for(const state of ['installing','activated','redundant'] as const){
    const stale=new WorkerHandle();stale.state=state;wsSw.waiting=stale;
    await swAdopt();expect(stale.messages).toEqual([]);expect(vi.getTimerCount()).toBe(initial);
  }
  wsSw.waiting=original;await swAdopt();expect(original.messages).toEqual(originalMessages);
  const announced=new WorkerHandle();wsSw.waiting=announced;
  void swAdopt('/resume','fixture');
  expect(announced.messages).toEqual([{type:'SKIP_WAITING'}]);
  container.controller=new WorkerHandle();container.dispatchEvent(new Event('controllerchange'));
  expect(replace).not.toHaveBeenCalled();expect(reload).not.toHaveBeenCalled();
  container.controller=announced;container.dispatchEvent(new Event('controllerchange'));
  expect(replace).toHaveBeenCalledExactlyOnceWith('/resume');
  const expired=new WorkerHandle();wsSw.waiting=expired;
  const pending=swAdopt('/late');await vi.advanceTimersByTimeAsync(2500);await pending;
  container.controller=expired;container.dispatchEvent(new Event('controllerchange'));
  expect(replace).toHaveBeenCalledTimes(1);
  const retired=new WorkerHandle();wsSw.waiting=retired;
  const refused=swAdopt('/retired');retired.state='redundant';retired.dispatchEvent(new Event('statechange'));await refused;
  await vi.advanceTimersByTimeAsync(2500);
  expect(replace).toHaveBeenCalledTimes(1);expect(reload).not.toHaveBeenCalled();
  const unavailable=new WorkerHandle();unavailable.refuse=true;wsSw.waiting=unavailable;
  await swAdopt('/unavailable');expect(vi.getTimerCount()).toBe(initial);
  installing.state='installed';installing.dispatchEvent(new Event('statechange'));
  await vi.waitFor(()=>{expect(vi.getTimerCount()).toBe(initial);});
  expect(installing.messages).toEqual([{type:'BUILD'}]);
  document.dispatchEvent(new Event('ws:ready'));
  expect(installing.messages).toEqual([{type:'BUILD'},{type:'SKIP_WAITING'}]);
  expect(expired.messages).toContainEqual({type:'WARM_CODE'});
});
