/** Browser-side independent resource census (03 §2.4); called before page scripts. */
export function installResources() {
  const w=/** @type {Window} */ (window);
  /** @typedef {{id:number,target:EventTarget,type:string,callback:EventListenerOrEventListenerObject,capture:boolean,wrapped:EventListener,stack:string,abort?:()=>void,signal?:AbortSignal}} Entry */
  /** @type {Set<Entry>} */ const listeners=new Set();
  let listenerId=0;
  // oxlint-disable-next-line typescript/unbound-method -- Wrappers preserve the native receiver through call().
  const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
  /** @param {Entry} entry */
  const forget=(entry)=>{listeners.delete(entry);if(entry.signal && entry.abort)remove.call(entry.signal,'abort',entry.abort);};
  EventTarget.prototype.addEventListener=function addEventListener(type,callback,options){
    if(!callback){add.call(this,type,callback,options);return;}
    const capture=typeof options==='boolean'?options:options?.capture??false;
    const prior=[...listeners].find((e)=>e.target===this && e.type===type && e.callback===callback && e.capture===capture);
    if(prior)return;
    const signal=typeof options==='object'?options.signal:undefined;
    if(signal?.aborted)return;
    const once=typeof options==='object' && options.once===true;
    /** @type {Entry} */ const entry={id:++listenerId,target:this,type,callback,capture,stack:new Error(`listener ${type}`).stack??'',wrapped(event){if(once)forget(entry);if(typeof callback==='function')callback.call(this,event);else callback.handleEvent(event);}};
    if(signal){entry.signal=signal;entry.abort=()=>forget(entry);add.call(signal,'abort',entry.abort,{once:true});}
    listeners.add(entry);add.call(this,type,entry.wrapped,options);
  };
  EventTarget.prototype.removeEventListener=function removeEventListener(type,callback,options){
    const capture=typeof options==='boolean'?options:options?.capture??false;
    const entry=[...listeners].find((e)=>e.target===this && e.type===type && e.callback===callback && e.capture===capture);
    if(entry){forget(entry);remove.call(this,type,entry.wrapped,options);}else remove.call(this,type,callback,options);
  };
  /** @type {Map<number,string>} */ const timeouts=new Map(),intervals=new Map(),raf=new Map();
  const timeout=w.setTimeout.bind(w),interval=w.setInterval.bind(w),clearTimeout=w.clearTimeout.bind(w),clearInterval=w.clearInterval.bind(w),request=w.requestAnimationFrame.bind(w),cancel=w.cancelAnimationFrame.bind(w);
  w.setTimeout=(handler,delay,...args)=>{
    const id=typeof handler==='function'?timeout(()=>{timeouts.delete(id);Reflect.apply(handler,window,args);},delay):timeout(handler,delay,...args);
    if(typeof handler!=='function')timeout(()=>{timeouts.delete(id);},delay);
    timeouts.set(id,new Error('timeout').stack??'');return id;
  };
  w.setInterval=(handler,delay,...args)=>{const id=interval(handler,delay,...args);intervals.set(id,new Error('interval').stack??'');return id;};
  w.clearTimeout=(id)=>{if(id!==undefined){timeouts.delete(id);intervals.delete(id);}clearTimeout(id);};
  w.clearInterval=(id)=>{if(id!==undefined){timeouts.delete(id);intervals.delete(id);}clearInterval(id);};
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Preserve the native rAF callback API while removing its pending entry before invocation.
  w.requestAnimationFrame=(callback)=>{const id=request((time)=>{raf.delete(id);callback(time);});raf.set(id,new Error('raf').stack??'');return id;};
  w.cancelAnimationFrame=(id)=>{raf.delete(id);cancel(id);};
  window.__parityResources=()=>{
    const counts={window:0,document:0,canvas:0,other:0};
    const listenerDetails=[...listeners].map(e=>({id:e.id,type:e.type,capture:e.capture,
      kind:e.target===window?'window':e.target===document?'document':e.target instanceof HTMLCanvasElement?'canvas':'other',
      target:e.target.constructor.name,stack:e.stack}));
    for(const e of listenerDetails)counts[e.kind]++;
    return {listeners:counts,listenerDetails,timers:{timeouts:timeouts.size,intervals:intervals.size,raf:raf.size},timerIds:{timeouts:[...timeouts.keys()],intervals:[...intervals.keys()],raf:[...raf.keys()]},stacks:{listeners:[...listeners].slice(0,5).map((e)=>e.stack),timers:[...timeouts.values(),...intervals.values(),...raf.values()].slice(0,5)}};
  };
}
