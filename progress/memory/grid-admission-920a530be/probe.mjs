import { chromium, devices } from 'playwright';
import { saveFixture, writeSaveFixture } from '../../../scripts/debug-settings.mjs';
import { driveGridSeam, gridSeamRoute, gridDriveFailures } from '../../../scripts/physics-grid.mjs';
import { writeFileSync } from 'node:fs';
const [base,out] = process.argv.slice(2);
const version = await (await fetch(new URL('version.json',base))).json();
const results = [];
const browser = await chromium.launch({args:['--mute-audio','--use-angle=metal','--ignore-gpu-blocklist']});
try {
for (const layout of ['developer','shipped']) {
 const context = await browser.newContext({...devices['iPhone 16 Pro'], serviceWorkers:'block'});
 await saveFixture(context,{scope:'global',key:'settings',data:{tier:'phone',fps:'auto'},merge:true});
 await saveFixture(context,{scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}});
 await saveFixture(context,{scope:'device',key:'devMode',data:true});
 await saveFixture(context,{scope:'device',key:'debug.global.gridMemoryAdmission',data:'on'});
 if(layout==='shipped') await context.addInitScript(`${writeSaveFixture.toString()};if(sessionStorage.getItem('spx2.admission.shipped')==='yes'){writeSaveFixture({scope:'device',key:'devMode',data:false});}`);
 const page = await context.newPage(), errors=[], consoleRows=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(['warn','error'].includes(message.type()))consoleRows.push({type:message.type(),text:message.text().slice(0,1600)});});
 const result = {layout,version,protocol:layout==='shipped'?'Real Developer title tap, then Developer OFF before grid document imports; shipped menu gate unchanged':'Real Developer title tap',snapshots:[],errors,console:consoleRows};
 results.push(result);
 console.log(layout,'title');
 try {
  await page.goto(`${base}?mute=1&nolock=1&sw=0`,{waitUntil:'commit',timeout:180000});
  await page.locator('.ws-main-grid').waitFor({timeout:120000});
  if(layout==='shipped') await page.evaluate(()=>sessionStorage.setItem('spx2.admission.shipped','yes'));
  await page.locator('.ws-main-grid').click();
  await page.waitForFunction(()=>Boolean(document.querySelector('#wserr .msg')?.textContent)||(!document.querySelector('.ws-load')&&Boolean(window.__wildshard?.shard?.grid?.state().live?.live)),null,{timeout:240000,polling:250});
  const error = await page.evaluate(()=>document.querySelector('#wserr .msg')?.textContent??null);
  if(error)throw new Error(error);
  const witness = await page.evaluate(()=>({build:window.__wildshard.boot.build,dev:document.documentElement.hasAttribute('data-dev'),device:JSON.parse(localStorage.getItem('wildshard.save.v2.device')??'{}').keys?.['debug.global.gridMemoryAdmission']?.data,level:window.__wildshard.world.game.level.id}));
  result.witness=witness;
  if(witness.build!==version.build||witness.dev!==(layout==='developer')||witness.device!=='on'||witness.level!=='driftwood-isle')throw new Error('Build/layout/admission fixture mismatch');
  console.log(layout,'entered',witness.build);
  await page.evaluate(()=>window.__wildshard.world.hud.enterNow());
  await page.waitForFunction(()=>window.__wsReveal?.endedMs!==null&&window.__wsReveal?.endedMs!==undefined,null,{timeout:45000,polling:250});
  const snapshot=async(label)=>{const data=await page.evaluate(()=>({state:window.__wildshard.shard.grid.state(),residency:window.__wildshard.shard.grid.residency(),roadResident:window.__wildshard.shard.grid.roadResident(),reveal:window.__wsReveal}));result.snapshots.push({label,...data});writeFileSync(out,JSON.stringify({version,results},null,2)+'\n');console.log(layout,label,data.state.playingMB,'MB',data.state.rings, data.state.live.live.issues);return data;};
  await snapshot('home-after-reveal');
  await page.waitForTimeout(10000);
  const settled=await snapshot('home-settled');
  const route=gridSeamRoute(settled.state,15);
  result.drive=await page.evaluate(driveGridSeam,route);result.driveFailures=gridDriveFailures(result.drive);
  await snapshot('after-home-deck-template-deck-home');
  result.admitted=Boolean(result.snapshots.every(s=>s.residency.home?.bytes===341781982&&s.residency.cost.playing<=1000000000)&&result.driveFailures.length===0&&errors.length===0);
  await page.screenshot({path:out+'.'+layout+'.jpg',type:'jpeg',quality:65});
 }catch(error){result.failure=String(error);console.log(layout,'FAIL',result.failure);await page.screenshot({path:out+'.'+layout+'.jpg',type:'jpeg',quality:65}).catch(()=>{});}
 finally{await context.close();writeFileSync(out,JSON.stringify({version,results},null,2)+'\n');}
}
}finally{await browser.close();}
console.log('RESULT',results.map(r=>({layout:r.layout,admitted:r.admitted,failure:r.failure,driveFailures:r.driveFailures,errors:r.errors})));
