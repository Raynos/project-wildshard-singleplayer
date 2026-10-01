/// <reference path="./init.d.mts" />
import { GL_INIT } from './glbytes.mjs';

/** All observations are installed before boot, using scorecard's RNG and GPU byte hooks.
 * @param {import('playwright').BrowserContext} context
 * @param {{lane:string,sha:string,browser:string,capture?:number|null}} meta */
export async function installInit(context, meta) {
  await context.addInitScript(GL_INIT);
  await context.addInitScript(({lane,sha,browser,capture}) => {
    let seed = 0x2545f491;
    Math.random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const saves = {read: /** @type {string[]} */ ([]),written: /** @type {string[]} */ ([])}, errors = /** @type {string[]} */ ([]), audioRequests = /** @type {string[]} */ ([]);
    // oxlint-disable-next-line typescript/unbound-method -- Native methods are deliberately saved and invoked with .call(this) in their wrappers.
    const rawGet = Storage.prototype.getItem, rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
    /** @param {Storage} storage @param {string} key */
    const name = (storage,key) => `${storage === localStorage ? 'local' : 'session'}:${key}`;
    Storage.prototype.getItem = function getItem(key) { saves.read.push(name(this,key)); return rawGet.call(this,key); };
    Storage.prototype.setItem = function setItem(key,value) { saves.written.push(name(this,key)); rawSet.call(this,key,value); };
    Storage.prototype.removeItem = function removeItem(key) { saves.written.push(name(this,key)); rawRemove.call(this,key); };
    const w = window;
    w.__wildshardHarness = {seed:0x2545f491,capture:capture ?? null,lane,sha,browser,errors,saves,audioRequests,gpuBytes:()=> {
      const gl = w.__sc_gl();
      const textures = gl.reduce((sum,r)=>sum+r.texBytes,0), renderbuffers=gl.reduce((sum,r)=>sum+r.rbBytes,0), buffers=gl.reduce((sum,r)=>sum+r.bufBytes,0);
      return {textures,renderbuffers,buffers,total:textures+renderbuffers+buffers};
    }};
    const rawRAF=window.requestAnimationFrame.bind(window); w.__parity={cpu:0,on:false,rawRAF};
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- requestAnimationFrame is a browser callback API; this wrapper measures synchronous frame work.
    window.requestAnimationFrame=(cb)=>rawRAF((time)=>{ const start=performance.now(); try {cb(time);} finally {if(w.__parity.on) w.__parity.cpu+=performance.now()-start;} });
    const updateRequests=()=> { for(const entry of performance.getEntriesByType('resource')) if (/\/assets\/(music|sfx|audio)\//.test(entry.name)) {const url=new URL(entry.name);url.searchParams.delete('v');const key=url.pathname+url.search;if(!audioRequests.includes(key)) audioRequests.push(key);} };
    new PerformanceObserver(updateRequests).observe({type:'resource',buffered:true});
    document.addEventListener('ws:ready',updateRequests);
    window.addEventListener('error',(e)=>{errors.push(e.message);});
    window.addEventListener('unhandledrejection',(e)=>{errors.push(String(e.reason));});
    console.error=new Proxy(console.error,{apply(target,self,args){errors.push(args.map(String).join(' '));Reflect.apply(target,self,args);}});
  },meta);
}
