import {chromium,devices} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {installInit} from '../parity/init.mjs';
import {poseAt,advance} from '../parity/frames.mjs';
import {developerSettings,saveFixture} from '../debug-settings.mjs';
import {loadingCardIndex} from '../loading-benchmark/catalogue.mjs';
import {installGpuProbe} from './gpu-census-page.mjs';
import {overdraw} from './gpu-census-overdraw.mjs';
/** Modern GPU census entry: native loading cards, immutable preview, explicit modes. */
export async function runGpuCensus(){
const arg=(key,fallback)=>process.argv.find(s=>s.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const url=arg('url',''),out=arg('out','tmp/gpu-census'),slug=arg('chunk','nine-dragon-stack'),modes=arg('mode','legacy,shardfile').split(','),rounds=Number(arg('rounds','5')),K=Number(arg('frames','16'));
const catalog=JSON.parse(readFileSync('art/legacy-goldens/compare/cameras24.json','utf8')).cameras, D=Math.PI/180;
const nine=[...catalog['nine-dragon-stack'].filter(x=>[1,5,14].includes(x.n)).map(x=>({x:x.probe.x,y:x.probe.y,z:x.probe.z,yaw:x.probe.yaw,pitch:x.probe.pitch,id:`cam-${x.n}`,source:'art/legacy-goldens/compare/cameras24.json',fov:x.fov})),
 {id:'cam-27',x:74,y:146,z:6,yaw:.349066,pitch:.0349066,fov:93.01,source:'NF4 cameras-27.json / afed7029ce'},
 {id:'approx-a',x:.95,y:135,z:7.5,yaw:-12*D,pitch:-60*D,hover:true,source:'approx: phone2133-a + sp-o1 trial; not exact phone pose'},
 {id:'approx-b',x:.95,y:135,z:7.5,yaw:-12*D,pitch:-20*D,hover:true,source:'approx: phone2133-b shallower view; not exact phone pose'}];
const pine=[{id:'P1',x:0,z:-235,yaw:Math.PI,pitch:0},{id:'P2',x:0,z:-200,yaw:Math.PI,pitch:0},{id:'P3',x:0,z:-28,yaw:Math.PI,pitch:0},{id:'P4',x:0,z:-28,yaw:Math.PI/2,pitch:-4*D}];
const selected=arg('poses','').split(','),poses=(slug==='nine-dragon-stack'?nine:pine).filter(x=>!selected[0]||selected.includes(x.id));
if(poses.length === 0||!modes.every(x=>['legacy','shardfile'].includes(x)))throw new Error('Invalid pose/mode selection');
if(!url||!['nine-dragon-stack','pine-hollow'].includes(slug)||!Number.isSafeInteger(rounds)||rounds<1||rounds>20||!Number.isSafeInteger(K)||K<1||K>64)throw new Error('Requires URL, supported shard and bounded rounds/frames');
mkdirSync(out,{recursive:true});const version=await(await fetch(new URL('version.json',url))).json();
const browser=await chromium.launch({headless:true,args:['--mute-audio','--use-angle=metal','--ignore-gpu-blocklist']});
const median=xs=>{const a=[...xs].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
try{for(const mode of modes)for(const pose of poses){
 const context=await browser.newContext({...devices['iPhone 16 Pro'],viewport:{width:402,height:874},deviceScaleFactor:2});
 const row={build:version.build,slug,mode,pose,when:new Date().toISOString(),K,rounds,source:'frozen-frame throughput including CPU submission; fresh-write readPixels sync; no official phone GPU timing credit',errors:[]};
 const file=`${out}/${slug}-${mode}-${pose.id}.json`,save=()=>writeFileSync(file,JSON.stringify(row,null,2));
 try{
  await installInit(context,{lane:'sp-x8-g1',sha:version.build,browser:'chromium',capture:30,tier:'phone'});
  await developerSettings(context,{tier:'phone',volume:0,time:'night',weather:'rain'});
  await saveFixture(context,{scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}});
  await saveFixture(context,{scope:'device',key:'debug.global.legacyShardButtons',data:'on'});
  const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
  await page.goto(url,{waitUntil:'load'});await page.locator('.ws-main-select').click();const names=await page.locator('.ws-menu-card b').allTextContents();await page.locator(`.ws-menu-dots i[data-i="${loadingCardIndex(names,slug)}"]`).click();
  const dual=await page.locator('.ws-menu-shardfile').isVisible();if(mode==='legacy'&&!dual)throw new Error('Legacy entry unavailable');await page.locator(mode==='shardfile'&&dual?'.ws-menu-shardfile':'.ws-menu-play').click();
  await page.waitForFunction(()=>window.__wildshard?.world?.hud?.entered&&!document.querySelector('.ws-load'),undefined,{timeout:240000});
  await poseAt(page,pose);if(pose.hover)await page.evaluate(()=>window.__wildshard.world.player.setHover(true));await poseAt(page,pose);await advance(page,90);await poseAt(page,pose);
  await page.evaluate(()=>{window.__wildshard.world.game.frameGate=()=>false;});row.environment=await page.evaluate(installGpuProbe);save();
  if(row.environment.buffer[0]!==804||row.environment.buffer[1]!==1748||!/Metal/i.test(row.environment.renderer))throw new Error('Requires actual Metal 804x1748 buffer');
  const inventory=await page.evaluate(()=>window.__gpuCensus.batch('inventory',1));
  for(const material of inventory.materials){if(material.fragmentShader){material.fragmentShaderHash=createHash('sha256').update(material.fragmentShader).digest('hex');delete material.fragmentShader;}}
  row.inventory=inventory;
  const samples=[];for(let round=0;round<rounds;round++)samples.push(await page.evaluate(k=>window.__gpuCensus.batch('throughput',k),K));
  row.samples=samples;row.whole=median(samples.map(x=>x.whole));row.cpu=median(samples.map(x=>x.cpu));
  row.subtract=[];
  const variants=arg('subtract','1')==='0'?[]:['none','shadow','depthcopy','silhouette','jiehua','alpha-tested',...inventory.materials.flatMap(m=>m.groups).filter((x,i,a)=>x.startsWith('group:')&&a.indexOf(x)===i),...row.environment.passes.filter(p=>p.index>0).map(p=>`pass:${p.index}`)];
  for(const variant of variants){const pairs=[];for(let i=0;i<rounds;i++){const baseline=await page.evaluate(k=>window.__gpuCensus.batch('throughput',k),K),off=await page.evaluate(([k,v])=>window.__gpuCensus.batch('throughput',k,v),[K,variant]);pairs.push({baseline:baseline.whole,off:off.whole,saved:baseline.whole-off.whole});}row.subtract.push({variant,baseline:median(pairs.map(x=>x.baseline)),off:median(pairs.map(x=>x.off)),saved:median(pairs.map(x=>x.saved)),pairs});save();}
  row.baselineEnd=await page.evaluate(k=>window.__gpuCensus.batch('throughput',k),K);
  if(arg('overdraw','0')==='1')row.overdraw=await page.evaluate(overdraw,false);
  row.top5=[...row.subtract].sort((a,b)=>b.saved-a.saved).slice(0,5);row.complete=row.errors.length===0;row.calibration=slug==='nine-dragon-stack'&&pose.id==='approx-a'?{kind:'phone-frame-to-Mac-throughput MODEL',phoneFrameAnchorMs:79,factor:79/row.whole,officialTimingCredit:false}:null;row.partitionStatus='NOT_MEASURABLE (G872): overlapping subtraction, occlusion and tile flushes; no additive sum credit';save();console.log(JSON.stringify({pose:pose.id,mode,gpuMs:row.whole,reconciliation:row.reconciliation,top5:row.top5.map(x=>[x.variant,x.saved])}));
  await page.evaluate(()=>window.__gpuCensus.restore());
 }catch(e){row.error=e.stack;row.complete=false;save();console.error(pose.id,mode,e.message);throw e;}finally{await context.close();}
}}finally{await browser.close();}

}
