(function writeSaveFixture(fixture) {
  try {
    if (fixture.once && sessionStorage.getItem(fixture.once)) return;
    const storage = fixture.scope === 'session' ? sessionStorage : localStorage;
    const name = `wildshard.save.v2.${fixture.scope}`;
    const doc = JSON.parse(storage.getItem(name) ?? '{"keys":{}}');
    const previous = doc.keys?.[fixture.key]?.data;
    doc.keys ??= {};
    doc.keys[fixture.key] = { v: 1, data: fixture.merge ? { ...(typeof previous === 'object' && previous !== null ? previous : {}), ...(typeof fixture.data === 'object' && fixture.data !== null ? fixture.data : {}) } : fixture.data };
    storage.setItem(name, JSON.stringify(doc));
    // Fixtures must survive the first v2 boot's one-time legacy reset.
    if (!localStorage.getItem('wildshard.save.v2.global')) localStorage.setItem('wildshard.save.v2.global', '{"keys":{}}');
    if (fixture.once) sessionStorage.setItem(fixture.once, '1');
  } catch { /* opaque origin / blocked storage: use the game's defaults */ }
})({"scope":"global","key":"settings","data":{"tier":"phone","fps":"30"},"merge":true});(function writeSaveFixture(fixture) {
  try {
    if (fixture.once && sessionStorage.getItem(fixture.once)) return;
    const storage = fixture.scope === 'session' ? sessionStorage : localStorage;
    const name = `wildshard.save.v2.${fixture.scope}`;
    const doc = JSON.parse(storage.getItem(name) ?? '{"keys":{}}');
    const previous = doc.keys?.[fixture.key]?.data;
    doc.keys ??= {};
    doc.keys[fixture.key] = { v: 1, data: fixture.merge ? { ...(typeof previous === 'object' && previous !== null ? previous : {}), ...(typeof fixture.data === 'object' && fixture.data !== null ? fixture.data : {}) } : fixture.data };
    storage.setItem(name, JSON.stringify(doc));
    // Fixtures must survive the first v2 boot's one-time legacy reset.
    if (!localStorage.getItem('wildshard.save.v2.global')) localStorage.setItem('wildshard.save.v2.global', '{"keys":{}}');
    if (fixture.once) sessionStorage.setItem(fixture.once, '1');
  } catch { /* opaque origin / blocked storage: use the game's defaults */ }
})({"scope":"global","key":"gfx","data":{"dpr":"2","aa":"auto"}});(function writeSaveFixture(fixture) {
  try {
    if (fixture.once && sessionStorage.getItem(fixture.once)) return;
    const storage = fixture.scope === 'session' ? sessionStorage : localStorage;
    const name = `wildshard.save.v2.${fixture.scope}`;
    const doc = JSON.parse(storage.getItem(name) ?? '{"keys":{}}');
    const previous = doc.keys?.[fixture.key]?.data;
    doc.keys ??= {};
    doc.keys[fixture.key] = { v: 1, data: fixture.merge ? { ...(typeof previous === 'object' && previous !== null ? previous : {}), ...(typeof fixture.data === 'object' && fixture.data !== null ? fixture.data : {}) } : fixture.data };
    storage.setItem(name, JSON.stringify(doc));
    // Fixtures must survive the first v2 boot's one-time legacy reset.
    if (!localStorage.getItem('wildshard.save.v2.global')) localStorage.setItem('wildshard.save.v2.global', '{"keys":{}}');
    if (fixture.once) sessionStorage.setItem(fixture.once, '1');
  } catch { /* opaque origin / blocked storage: use the game's defaults */ }
})({"scope":"device","key":"devMode","data":true});
window.__coldBoot = {stages:[],longTasks:[],wasm:[],decode:[],fetch:[],hash:[],errors:[],firstFrame:null,playable:null};
performance.setResourceTimingBufferSize(10000);
window.addEventListener('error',e=>window.__coldBoot.errors.push(String(e.message)));
window.addEventListener('unhandledrejection',e=>window.__coldBoot.errors.push(String(e.reason)));
const long = new PerformanceObserver(list=>{for(const row of list.getEntries())window.__coldBoot.longTasks.push({start:row.startTime,ms:row.duration})});
try{long.observe({type:'longtask',buffered:true})}catch{}
const restores=[];
const fetching=window.fetch;
window.fetch=function(...args){const start=performance.now(),url=String(args[0]?.url??args[0]);return Reflect.apply(fetching,this,args).finally(()=>window.__coldBoot.fetch.push({url,start,ms:performance.now()-start}))};restores.push(()=>window.fetch=fetching);
const digest=crypto.subtle.digest;
crypto.subtle.digest=function(...args){const start=performance.now();return Reflect.apply(digest,this,args).finally(()=>window.__coldBoot.hash.push({start,ms:performance.now()-start}))};restores.push(()=>crypto.subtle.digest=digest);
for(const key of ['compile','instantiate','compileStreaming','instantiateStreaming']){const original=WebAssembly[key];if(!original)continue;WebAssembly[key]=function(...args){const start=performance.now();return Reflect.apply(original,this,args).finally(()=>window.__coldBoot.wasm.push({key,start,ms:performance.now()-start}))};restores.push(()=>WebAssembly[key]=original)}
const image=window.createImageBitmap;
if(image){window.createImageBitmap=function(...args){const start=performance.now();return Reflect.apply(image,this,args).finally(()=>window.__coldBoot.decode.push({start,ms:performance.now()-start}))};restores.push(()=>window.createImageBitmap=image)}
let previous='';
const timer=setInterval(()=>{const b=window.__coldBoot; const doc=JSON.parse(localStorage.getItem('wildshard.save.v2.device')??'{}');const trace=doc.keys?.['boot.trace']?.data;const stage=trace?.stage??document.querySelector('.ws-load')?.getAttribute('data-step')??'';if(stage!==previous){b.stages.push({at:performance.now(),stage,trace});previous=stage}const w=window.__wildshard?.world;if(w?.game?.frameCount>0&&b.firstFrame===null)b.firstFrame=performance.now();if(w?.hud?.entered&&!document.querySelector('.ws-load')&&b.playable===null){b.playable=performance.now();clearInterval(timer);long.disconnect();for(const undo of restores)undo();}},50);
