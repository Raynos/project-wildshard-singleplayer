/// <reference path="./init.d.mts" />
import { installFrameDriver } from './clock.mjs';
import { telemetryOnlyWrite } from './saves.mjs';
import { GL_INIT } from './glbytes.mjs';
import { installResources } from './resources.mjs';

/** All observations are installed before boot, using scorecard's RNG and GPU byte hooks.
 * @param {import('playwright').BrowserContext} context
 * @param {{lane:string,sha:string,browser:string,capture?:number|null,accelerated?:boolean,tier?:string}} meta */
export async function installInit(context, meta) {
  await context.addInitScript(GL_INIT);
  await context.addInitScript(`window.__parityTelemetryOnly = (${telemetryOnlyWrite.toString()});`);
  await context.addInitScript(({lane,sha,browser,capture}) => {
    let seed = 0x2545f491;
    Math.random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const saves = {read: /** @type {string[]} */ ([]),written: /** @type {string[]} */ ([])}, errors = /** @type {string[]} */ ([]), audioRequests = /** @type {string[]} */ ([]);
    // oxlint-disable-next-line typescript/unbound-method -- Native methods are deliberately saved and invoked with .call(this) in their wrappers.
    const rawGet = Storage.prototype.getItem, rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
    /** @param {Storage} storage @param {string} key */
    const name = (storage,key) => `${storage === localStorage ? 'local' : 'session'}:${key}`;
    // Telemetry keys are not saves: the error-report queue is read only when a report is pending, the heartbeat on a
    // wall-clock timer (13 B26). They stay out of the save fingerprint; every real save key is still recorded.
    const w = window;
    const telemetry = new Set(['wsErrQueue','ws.alive']);
    Storage.prototype.getItem = function getItem(key) { if (!telemetry.has(key)) saves.read.push(name(this,key)); return rawGet.call(this,key); };
    Storage.prototype.setItem = function setItem(key,value) { if (!telemetry.has(key) && !w.__parityTelemetryOnly(rawGet.call(this,key),value,key)) saves.written.push(name(this,key)); rawSet.call(this,key,value); };
    Storage.prototype.removeItem = function removeItem(key) { if (!telemetry.has(key)) saves.written.push(name(this,key)); rawRemove.call(this,key); };
    w.__wildshardHarness = {seed:0x2545f491,capture:capture ?? null,lane,sha,browser,errors,saves,audioRequests,gpuBytes:()=> {
      const gl = w.__sc_gl();
      const textures = gl.reduce((sum,r)=>sum+r.texBytes,0), renderbuffers=gl.reduce((sum,r)=>sum+r.rbBytes,0), buffers=gl.reduce((sum,r)=>sum+r.bufBytes,0);
      return {textures,renderbuffers,buffers,total:textures+renderbuffers+buffers};
    }};
    Reflect.set(w.__wildshardHarness,'resources',()=>w.__parityResources());
    const rawRAF=window.requestAnimationFrame.bind(window); w.__parity={cpu:0,on:false,rawRAF,free:false,remaining:0,advance:()=>Promise.reject(new Error('frame control not installed'))};
    document.addEventListener('ws:ready',()=>{
      const g=w.__wildshard.requireWorld().game,control=w.__parity,original=g.frameGate.bind(g);
      g.frameGate=()=>{if(!original() || (!control.free && control.remaining===0))return false;if(!control.free)control.remaining--;return true;};
      control.advance=async(frames)=>{
        if(!Number.isInteger(frames)||frames<0||control.remaining>0)throw new Error('invalid concurrent frame advance');
        const drawn=()=>Number(Reflect.get(g,'frameNo'));const end=drawn()+frames;control.remaining=frames;
        await new Promise((resolve)=>{const check=()=>{if(drawn()>=end)resolve(undefined);else rawRAF(check);};rawRAF(check);});
      };
      for(const animal of w.__wildshard.requireWorld().animals.animals)animal.harnessHold=true;
      g.levelScope.onDispose(()=>{control.advance=()=>Promise.reject(new Error('Parity level retired'));});
    },{once:true});
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- requestAnimationFrame is a browser callback API; this wrapper measures synchronous frame work.
    window.requestAnimationFrame=(cb)=>rawRAF((time)=>{ const start=performance.now(); try {cb(time);} finally {if(w.__parity.on) w.__parity.cpu+=performance.now()-start;} });
    // Observe request initiation, not PerformanceObserver delivery: the latter may arrive after the boot barrier.
    const requestAudio=/** @param {string} request */(request)=>{const url=new URL(request,location.href);if(/\/assets\/(music|sfx|audio)\//.test(url.pathname)){url.searchParams.delete('v');const key=url.pathname+url.search;if(!audioRequests.includes(key))audioRequests.push(key);}};
    const rawFetch=window.fetch.bind(window);
    window.fetch=(input,options)=>{requestAudio(typeof input==='string'?input:input instanceof URL?input.href:input.url);return rawFetch(input,options);};
    window.addEventListener('error',(e)=>{errors.push(e.message);});
    window.addEventListener('unhandledrejection',(e)=>{errors.push(String(e.reason));});
    console.error=new Proxy(console.error,{apply(target,self,args){errors.push(args.map(String).join(' '));Reflect.apply(target,self,args);}});
  },meta);
  await context.addInitScript(installFrameDriver,{accelerated:meta.accelerated??false,timerHz:meta.tier==='desktop'?60:30});
  await context.addInitScript(installResources);
}
