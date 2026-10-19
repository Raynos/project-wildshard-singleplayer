import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath, extname, sep } from 'node:path';

const built=resolvePath(process.argv[2]??'tmp/shared-arena-build1'), out=resolvePath(process.argv[3]??'tmp/shared-arena-qa1');mkdirSync(out,{recursive:false});
const retained=resolvePath(process.argv[4]);
const requests=[];
const report={schema:'wildshard.shared-arena.qa.v1',startedAt:new Date().toISOString(),errors:[],checks:{},enemies:[],caveat:'Muted cloud Chromium portrait diagnostic, not physical iPhone performance or visual acceptance. Only diagnostic player positioning and real attack input; no enemy clocks/health/AI injection.'};
const save=()=>writeFileSync(resolvePath(out,'report.json'),`${JSON.stringify(report,null,2)}\n`);
const server=createServer((req,res)=>{
 const url=new URL(req.url??'/','http://localhost');
 const mounted=url.pathname.startsWith('/shared-arena/');
 const root=mounted?built:retained;
 const relative=mounted?url.pathname.slice('/shared-arena'.length):url.pathname;
 const path=resolvePath(root,`.${relative}`);
 if(!path.startsWith(`${root}${sep}`)){res.writeHead(403).end();return;}
 try{
  const bytes=readFileSync(path);requests.push({url:url.pathname,status:200,bytes:bytes.length,source:mounted?'candidate':'retained'});
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'})[extname(path)]??'application/octet-stream');res.end(bytes);
 }catch{requests.push({url:url.pathname,status:404});res.writeHead(404).end();}
});
await new Promise(resolve=>{server.listen(0,'127.0.0.1',resolve);});const address=server.address();if(typeof address!=='object'||address===null)throw new Error('No server');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--mute-audio','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({...devices['iPhone 16 Pro'],viewport:{width:402,height:874},deviceScaleFactor:1});const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>{report.errors.push(e.message);save();});
 const storage=()=>page.evaluate(async()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),caches:await caches.keys(),databases:await indexedDB.databases(),workers:(await navigator.serviceWorker.getRegistrations()).length}));
 const sample=()=>page.evaluate(()=>{const d=window.__practiceDemo,a=d?.arena.activeTargets[0];return {gameExists:Boolean(d),entered:d?.arena.entered,frame:d?.game.frameTime,targets:d?.arena.activeTargets.length,canvas:document.querySelectorAll('canvas').length,iframes:document.querySelectorAll('iframe').length,enemy:a?{kind:a.kind,hp:a.hp,maxHp:a.maxHp,alive:a.alive,state:a.state,mem:{...a.mem},position:a.position.toArray()}:null,player:d?.arena.playerVitals,loot:d?.arena.opponent?.loot?.receipt,status:document.querySelector('#arena-status')?.textContent};});
 const place=(placementDistance,placementPitch=.08)=>page.evaluate(({distance,pitch})=>{const d=window.__practiceDemo,a=d.arena.activeTargets[0];d.player.spawn(a.position.x,a.position.z+distance,0,a.position.y);d.player.pitch=pitch;return d.player.position.toArray();},{distance:placementDistance,pitch:placementPitch});
 for (const [suffix,kind] of [['#mantis','splinter-mantis'],['#conch','conch-duelist'],['#colossus','tideRootColossus'],['#puffer','brine-puffer'],['?enemy=conch','conch-duelist'],['?opponent=%70uffer','brine-puffer'],['#%','splinter-mantis'],['?enemy=%E0%A4%A','splinter-mantis'],['#unknown','splinter-mantis'],['#bellback','bellback'],['?enemy=brine-pitcher-matriarch','brine-pitcher-matriarch'],['#pearlglass-medusa','pearlglass-medusa'],['?opponent=keelmaw','keelmaw'],['#bloomthroat-iguana','bloomthroat-iguana']]) {
  await page.goto('about:blank');
  await page.goto(`http://127.0.0.1:${address.port}/shared-arena/arena.html${suffix}`,{waitUntil:'domcontentloaded'});
  report.checks[`link:${suffix}`]=await page.evaluate(expected=>document.querySelector('#arena-opponent').value===expected&&!window.__practiceDemo&&!document.querySelector('#arena-start').hidden&&document.querySelector('#arena-start').disabled===(['bellback','brine-pitcher-matriarch','pearlglass-medusa','keelmaw','bloomthroat-iguana'].includes(expected)),kind);
 }
 await page.goto('about:blank');
 await page.goto(`http://127.0.0.1:${address.port}/shared-arena/arena.html#puffer`,{waitUntil:'domcontentloaded'});report.storageBefore=await storage();report.checks.lazy=await page.evaluate(()=>!window.__practiceDemo&&document.querySelectorAll('canvas').length===1&&document.querySelectorAll('iframe').length===0);
 report.checks.basisOpaqueBytes=await page.evaluate(async()=>{
  const response=await fetch('/mantis-engine/assets/basis_transcoder-VXdx5NbI.wasm');
  const bytes=await response.arrayBuffer();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  return response.ok&&bytes.byteLength===527333&&hash==='6cf17dc889352c42e9acf8897107978d127005fe3386c36a0e3845e27967630a';
 });
 await page.locator('#arena-start').tap();await page.waitForFunction(()=>window.__practiceDemo?.arena.entered===true||!document.querySelector('#arena-start')?.disabled);
 if(!await page.evaluate(()=>window.__practiceDemo?.arena.entered===true))throw new Error(await page.locator('#arena-status').textContent());
 report.checks.aliasActualStart=await page.evaluate(()=>window.__practiceDemo.arena.activeTargets[0]?.kind==='brine-puffer');
 await page.selectOption('#arena-opponent','splinter-mantis');
 await page.waitForFunction(()=>window.__practiceDemo.arena.activeTargets[0]?.kind==='splinter-mantis'&&!document.querySelector('#arena-opponent').disabled);
 await page.evaluate(()=>{window.__sharedArenaTestGame=window.__practiceDemo.game;});
 for(const kind of ['splinter-mantis','conch-duelist','tideRootColossus','brine-puffer']){
  if(kind!=='splinter-mantis'){await page.selectOption('#arena-opponent',kind);await page.waitForFunction(selectedKind=>window.__practiceDemo?.arena.activeTargets[0]?.kind===selectedKind&&!document.querySelector('#arena-opponent')?.disabled,kind);}
  const row={kind,entry:await sample(),samples:[],placements:[],checks:{}};report.enemies.push(row);save();
  row.checks.singleInstance=await page.evaluate(()=>window.__practiceDemo.game===window.__sharedArenaTestGame&&document.querySelectorAll('canvas').length===1&&document.querySelectorAll('iframe').length===0);
  row.checks.fresh=row.entry.enemy?.alive===true&&row.entry.enemy.hp===row.entry.enemy.maxHp&&row.entry.player?.health===100&&row.entry.targets===1;
  row.placements.push({reason:'Diagnostic player placement for real enemy attack',position:await place(kind==='tideRootColossus'?4:kind==='brine-puffer'?2.2:3)});
  const until=Date.now()+35000;
  while(Date.now()<until){await page.waitForTimeout(600);const s=await sample();row.samples.push(s);save();if(s.player?.health<100)break;}
  row.defense=await sample();row.checks.actualPlayerDamage=row.defense.player?.health<100;
  await page.locator('#arena-retry').tap();await page.waitForTimeout(150);row.retry=await sample();row.checks.retry=row.retry.enemy?.hp===row.retry.enemy?.maxHp&&row.retry.player?.health===100&&row.retry.loot?.coins===0;
  for(let n=0;n<12;n++){const s=await sample();if(!s.enemy?.alive||s.player?.health===0||s.enemy.hp<s.enemy.maxHp)break;row.placements.push({reason:'Diagnostic sword range; actual touch attack',position:await place(kind==='tideRootColossus'?2.8:1.8,kind==='tideRootColossus'?-.3:.08)});await page.locator('.ws-touch-attack').tap();await page.waitForTimeout(650);row.samples.push(await sample());save();}
  row.attack=await sample();row.checks.actualEnemyDamage=row.attack.enemy?.hp<row.attack.enemy?.maxHp;
  await page.screenshot({path:resolvePath(out,`${kind}.jpg`),type:'jpeg',quality:80,scale:'css'});row.storage=await storage();save();
 }
 await page.locator('#arena-back').tap();report.back=await sample();report.checks.back=report.back.entered===false&&report.back.targets===0;
 await page.locator('#arena-start').tap();await page.waitForFunction(()=>window.__practiceDemo?.arena.entered===true&&!document.querySelector('#arena-opponent')?.disabled);report.restart=await sample();report.checks.restartSameGame=await page.evaluate(()=>window.__practiceDemo.game===window.__sharedArenaTestGame);report.checks.restartFresh=report.restart.player?.health===100&&report.restart.enemy?.hp===report.restart.enemy?.maxHp;
 report.storageAfter=await storage();await page.reload({waitUntil:'domcontentloaded'});report.reload=await sample();report.checks.reloadFresh=!report.reload.gameExists&&!await page.locator('#arena-start').isHidden();report.storageAfterReload=await storage();
 report.checks.persistence=[report.storageBefore,report.storageAfter,report.storageAfterReload,...report.enemies.map(row=>row.storage)].every(s=>s.local.length===0&&s.session.length===0&&s.caches.length===0&&s.databases.length===0&&s.workers===0);
 report.checks.bellbackUnavailable=await page.locator('option[value="bellback"]').isDisabled();report.checks.noErrors=report.errors.length===0;
 report.requests=requests;
 report.checks.noMissingRequests=requests.every(row=>row.status===200);
 report.checks.allJavaScriptOwned=requests.filter(row=>row.url.endsWith('.js')).every(row=>row.source==='candidate');
 report.checks.allProductsRetained=['mantis','conch','colossus','puffer'].every(id=>requests.some(row=>row.url===`/${id}-engine/practice-product/shard.json`));
 report.checks.physicsRetained=requests.some(row=>row.url==='/mantis-engine/assets/physics/rapier.wasm');
 await context.close();
}catch(error){report.fatal=error.message;process.exitCode=1;}finally{await browser.close();await new Promise(resolve=>{server.close(resolve);});report.endedAt=new Date().toISOString();save();writeFileSync(resolvePath(out,'completed-report.json'),`${JSON.stringify(report,null,2)}\n`,{flag:'wx'});}
if(Object.values(report.checks).some(v=>v!==true)||report.enemies.some(row=>Object.values(row.checks).some(v=>v!==true)))process.exitCode=1;
console.log(JSON.stringify({checks:report.checks,enemies:report.enemies.map(r=>({kind:r.kind,checks:r.checks})),fatal:report.fatal}));
