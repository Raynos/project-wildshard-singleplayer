// E435 G216: caller holds browser-lane; sequential fresh phone contexts in one muted Metal browser.
import { chromium, devices } from 'playwright';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const [base, out, rev] = process.argv.slice(2);
if (!base || !out || !rev) throw new Error('browser.mjs <preview> <output> <revision>');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel:'chromium', args:['--mute-audio','--use-angle=metal','--ignore-gpu-blocklist'] });
const results = [];
try {
for (const variant of [{slug:'pine-hollow',dev:false}, {slug:'pine-hollow',dev:true}, {slug:'driftwood-isle',dev:false}, {slug:'grid',dev:true}]) {
 const context = await browser.newContext({...devices['iPhone 16 Pro'],serviceWorkers:'allow'});
 try {
 const version = await (await context.request.get(new URL('version.json',base).href)).json();
 if(!version.build.startsWith(rev.slice(0,7))) throw new Error('Preview revision mismatch');
 const picks = [{scope:'global',key:'settings',data:{tex:'auto'},merge:true}, {scope:'device',key:'devMode',data:variant.dev}];
 
 await context.addInitScript(picks.map(saveFixtureCode).join(';'));
 await context.addInitScript(build=>{window.__wildshardHarness={seed:1,capture:null,lane:'g216',sha:build,browser:'chromium',errors:[],audioRequests:[],saves:{read:[],written:[]}};},version.build);
 const page = await context.newPage(); const errors=[];
 page.on('pageerror',error=>errors.push(error.stack??error.message));
 const diagnostic=setInterval(()=>{ void page.evaluate(()=>({url:location.href,body:document.body.textContent?.slice(-1500),world:!!window.__wildshard?.world?.game})).then(value=>{writeFileSync(out+'/diagnostic.json',JSON.stringify({variant,value,errors},null,2));}).catch(()=>{}); },2000);
 context.on('close',()=>clearInterval(diagnostic));
 await page.goto(base);
 if (variant.slug==='grid') { await page.waitForSelector('.ws-main-grid',{timeout:90000}); await page.locator('.ws-main-grid').click(); }
 else { await page.waitForSelector('.ws-main-select',{timeout:90000}); await page.locator('.ws-main-select').click();
 const name=variant.slug==='pine-hollow'?'Pine Hollow':'Driftwood Isle';
 await page.evaluate(name=>{const card=[...document.querySelectorAll('.ws-menu-card')].find(e=>e.querySelector('b')?.textContent===name); if(!card)throw new Error('Missing shard card');document.querySelector('.ws-menu-dots i[data-i="'+card.dataset.i+'"]')?.click();},name);
 await page.locator('.ws-menu-play').click(); }
 if (variant.slug==='pine-hollow' && !variant.dev) await page.waitForSelector('#wserr',{timeout:60000});
 else { await page.waitForFunction(()=>Boolean(window.__wildshard?.world?.game)&&!document.querySelector('.ws-load'),undefined,{timeout:180000}); await page.evaluate(()=>{window.__wildshard.world.hud.enterNow();}); await page.waitForTimeout(3000); if(variant.slug==='grid') await page.waitForFunction(()=>window.__wildshard?.shard?.grid?.state?.().ringsReady===true,undefined,{timeout:90000}); }
 const state = await page.evaluate(()=>({build:window.__wildshard?.boot?.build,world:window.__wildshard?.world?.game?.level?.id??null,developer:JSON.parse(localStorage.getItem('wildshard.save.v2.device')??'{}').keys?.devMode?.data,warning:[...document.querySelectorAll('.ws-memory-warning-report')].map(e=>({text:e.textContent,...e.dataset})),warningVisible:!!document.querySelector('.ws-memory-warning')?.getClientRects().length,body:document.body.textContent,fatal:document.querySelector('#wserr')?.textContent??null,grid:window.__wildshard?.shard?.grid?.state?.()??null,ktx2:performance.getEntriesByType('resource').filter(e=>e.name.includes('.ktx2')).length}));
 results.push({variant,version,state,errors}); writeFileSync(out+'/results.json',JSON.stringify(results,null,2)+'\n');
 await page.screenshot({path:out+'/'+variant.slug+'-'+variant.dev+'.jpg',type:'jpeg',quality:60});
 console.log(JSON.stringify({variant,world:state.world,warning:state.warning,warningVisible:state.warningVisible,errors,grid:state.grid===null?null:{playingMB:state.grid.playingMB,accountedBytes:state.grid.accountedBytes,rings:state.grid.rings,live:state.grid.live}}));
 if((state.world!==null && state.build!==version.build) || state.developer!==variant.dev) throw new Error('Wrong pin/Developer setting');
 if(variant.slug==='pine-hollow'&&!variant.dev) { if(state.world!==null||state.warningVisible||!state.fatal?.includes('Home residency admission deferred by the shared budget')||errors.length)throw new Error('Public over-budget boot allocated/overrode'); }
 else { if(!state.world||errors.length)throw new Error('Entered boot failed'); if(variant.slug==='pine-hollow' && (!state.warningVisible||!state.warning.some(w=>Number(w.playingBytes)>Number(w.playingCap)&&Number(w.claimedBytes)>800000000)))throw new Error('Missing truthful Developer warning'); if(!variant.dev && state.warningVisible)throw new Error('Public under-cap warning'); if(variant.slug==='grid' && (state.grid?.home!=='driftwood-isle'||state.grid.rings.refused!==0||Object.keys(state.grid.live.live.issues).length))throw new Error('Grid admission issue'); }
 }finally{await context.close();}
}
}finally{await browser.close();}
