// @vitest-environment happy-dom
import {afterEach,expect,test,vi} from 'vitest';
import { isDev, setDev } from '../core/devMode';

const previousDeveloper = isDev();

afterEach(async()=>{
  const button=document.querySelector('.ws-update');
  if(button!==null)(await import('./hudSlots')).hudSlots.ownerOf(button)?.dispose();
  (await import('../app/resources')).pageScope.dispose();
  document.body.replaceChildren();
  Reflect.deleteProperty(window,'__ws_sw');
  setDev(previousDeveloper);
  vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();
});

test('one update reports completed files through adoption and a slow reload, then releases on pagehide',async()=>{
  setDev(false);
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout','setInterval','clearInterval','Date','performance','requestAnimationFrame','cancelAnimationFrame']});
  vi.stubGlobal('__BUILD_ID__','fixture-before');
  vi.stubGlobal('fetch',()=>Promise.resolve(Response.json({build:'fixture-before'})));
  document.body.innerHTML='<div class="ws-load"></div>';
  let adopted:()=>void=()=>{throw new Error('Adoption has not started');};
  const pending=new Promise<void>(resolve=>{adopted=resolve;}),adopt=vi.fn(()=>pending);
  Object.defineProperty(window,'__ws_sw',{configurable:true,value:{waiting:{state:'installed'},adopt}});
  const replace=vi.fn<(url:string)=>void>();
  vi.stubGlobal('location',Object.assign(new URL('https://example.com/?chunk=canal-reserve'),{replace,reload:vi.fn()}));
  await import('./Update');
  const button=document.querySelector('.ws-update');
  if(!(button instanceof HTMLButtonElement))throw new Error('Missing update pill');
  button.click();button.dispatchEvent(new Event('pointerup'));
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(adopt).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(100);
  expect(adopt).toHaveBeenCalledTimes(1);expect(replace).not.toHaveBeenCalled();
  expect(button.textContent).toContain('0 files · 0.0s');
  const {receiveWorkerDownloads}=await import('../boot/download');
  receiveWorkerDownloads({type:'WS_WORKER_DOWNLOAD',origin:performance.timeOrigin,timings:[
    {name:'https://example.com/assets/one.js',startTime:0,responseEnd:100,transferSize:512,encodedBodySize:400},
    {name:'https://example.com/assets/two.js',startTime:0,responseEnd:120,transferSize:600,encodedBodySize:488},
  ]},performance.timeOrigin);
  await vi.advanceTimersByTimeAsync(750);
  expect(button.textContent).toContain('2 files · 0.8s');
  adopted();await vi.advanceTimersByTimeAsync(500);
  expect(replace).toHaveBeenCalledTimes(1);
  const destination=new URL(replace.mock.calls[0]?.[0]??'');
  expect(destination.searchParams.has('v')).toBe(true);
  expect(destination.searchParams.get('chunk')).toBe('canal-reserve');
  expect(button.textContent).toContain('2 files · 1.3s');
  window.dispatchEvent(new Event('pagehide'));
  const ended=button.textContent;
  await vi.advanceTimersByTimeAsync(1500);
  expect(button.textContent).toBe(ended);
});
