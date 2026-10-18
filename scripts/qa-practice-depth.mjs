/** Run through scripts/browser-lane.sh against a pinned serve-build preview.
 * CHROME_PATH selects an installed official headless browser; CAPTURE_SOURCE records the immutable tree.
 * These tests use owner-rejected geometry only as real mechanics fixtures, never visual acceptance. */
import { chromium, devices } from 'playwright';
import { developerSettings, harnessPins } from './debug-settings.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const out=process.env.PRACTICE_QA_OUT??'tmp/practice-qa'; mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),source:process.env.CAPTURE_SOURCE,enemies:[],errors:[],visualStatus:'Rejected geometry; mechanics fixtures only'};
const save=()=>writeFileSync(`${out}/practice-depth-report.json`,JSON.stringify(report,null,2));
const mark=phase=>{report.phase=phase;save();console.log(new Date().toISOString(),phase);};
mark('launch');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox','--mute-audio','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const context=await browser.newContext({...devices['iPhone 16 Pro'],viewport:{width:402,height:874},deviceScaleFactor:1});
 await developerSettings(context,{});await harnessPins(context,{});
 const page=await context.newPage();page.setDefaultTimeout(120000);
 page.on('pageerror',error=>{report.errors.push(error.message);save();});page.on('crash',()=>{report.crash=true;save();});
 await page.goto(`${process.env.PRACTICE_QA_URL??'http://127.0.0.1:4455/'}?chunk=driftwood-isle&explore=hub`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__wildshard?.world!==undefined,undefined,{timeout:240000});
 mark('world-ready');
 report.boot=await page.evaluate(()=>({state:window.__wildshard.state().appState,dev:Object.hasOwn(document.documentElement.dataset,'dev'),picker:document.querySelector('.ws-practice-picker')?.outerHTML,body:document.body.textContent.slice(-2500)}));save();
 await page.screenshot({path:`${out}/practice-picker-before.jpg`,type:'jpeg',quality:80,scale:'css'});
 report.pickerHit=await page.locator('.ws-practice-picker summary').evaluate(el=>{const r=el.getBoundingClientRect(), hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:hit?.className,inside:hit===el||el.contains(hit),parent:el.parentElement?.parentElement?.tagName};});save();
 await page.locator('.ws-practice-picker summary').tap({timeout:15000});
 for(const kind of ['tideRootColossus','conch-duelist']) {
  mark(`select:${kind}`);
  await page.locator('.ws-practice-picker select').selectOption(`${kind}:${kind==='tideRootColossus'?'tide-root-colossus':kind}`);
  await page.waitForFunction(()=>{const value=document.querySelector('.ws-practice-picker p')?.textContent;return value!==undefined&&!value.includes('Preparing isolated opponent');});
  const preparation=await page.locator('.ws-practice-picker p').textContent();
  if(!preparation?.includes('One opponent ready'))throw new Error(`Opponent ${kind}: ${preparation}`);
  const worldBefore=await page.evaluate(()=>window.__wildshard.state());
  await page.locator('.ws-x-card[data-m="practice"]').click();
  await page.waitForFunction(()=>window.__wildshard.world.arena.entered&&window.__wildshard.world.arena.activeTargets.length===1);
  const sample=()=>page.evaluate(()=>{const p=window.__wildshard,a=p.world.arena.activeTargets[0];return {kind:a.kind,hp:a.hp,maxHp:a.maxHp,alive:a.alive,state:a.state,mem:{...a.mem},position:a.position.toArray(),targets:p.world.arena.activeTargets.length,localHealth:p.world.arena.opponent?.playerHealth,localMaxHealth:p.world.arena.opponent?.playerMaxHealth,loot:p.world.arena.opponent?.loot?.receipt,clock:p.state().clockNow,elapsed:p.world.arena.opponent?.elapsed,flash:a.flash,material:(Array.isArray(a.mesh.material)?a.mesh.material:[a.mesh.material]).map(m=>({type:m.type,emissive:m.emissive?.toArray(),emissiveIntensity:m.emissiveIntensity,color:m.color?.toArray(),toneMapped:m.toneMapped})),dummies:p.world.arena.targets.map(t=>({visible:t.model.root.visible})),player:p.state().player,status:document.querySelector('.ws-practice-picker p')?.textContent};});
  const entry={kind,worldBefore,before:await sample()};report.enemies.push(entry);save();
  await page.evaluate(async()=>{const p=window.__wildshard,a=p.world.arena.activeTargets[0];await p.pose({x:a.position.x,y:900,z:a.position.z+2,yaw:0,pitch:-.1});});
  await page.screenshot({path:`${out}/depth-${kind}-before-hit.jpg`,type:'jpeg',quality:82,scale:'css'});entry.beforeHit=await sample();save();
  const startClock=entry.beforeHit.clock;
  await page.waitForFunction(start=>window.__wildshard.state().clockNow>=start+4||window.__wildshard.world.arena.opponent.playerHealth<=0,startClock,{timeout:120000});
  entry.afterIdle=await sample();save();
  const attack=await page.locator('.ws-touch-attack').boundingBox();
  if(attack===null)throw new Error('Attack button is missing');
  await page.touchscreen.tap(attack.x+attack.width/2,attack.y+attack.height/2);await page.waitForTimeout(1500);
  entry.afterTouch=await sample();save();
  await page.waitForFunction(start=>window.__wildshard.state().clockNow>=start+20||window.__wildshard.world.arena.opponent.playerHealth<=0,startClock,{timeout:180000});
  entry.afterLongContact=await sample();save();
  if(kind==='brine-puffer') {
   for(let attempt=0;attempt<12;attempt++) {
    const current=await sample();if(!current.alive||current.localHealth<=0)break;
    await page.evaluate(async()=>{const p=window.__wildshard,a=p.world.arena.activeTargets[0];await p.pose({x:a.position.x,y:900,z:a.position.z+1.4,yaw:0,pitch:-.18});});
    await page.touchscreen.tap(attack.x+attack.width/2,attack.y+attack.height/2);await page.waitForTimeout(800);
   }
   await page.waitForTimeout(3000);entry.afterContactFight=await sample();save();
  }
  await page.screenshot({path:`${out}/depth-${kind}-after-contact.jpg`,type:'jpeg',quality:82,scale:'css',timeout:120000});
  entry.afterCapture=await sample();save();
  await page.locator('.ws-practice-picker button').tap();entry.afterRetry=await sample();save();
  if(!await page.evaluate(()=>window.__wildshard.world.hud.paused))await page.keyboard.press('Escape');
  await page.locator('.ws-gmenu-exit').click();await page.waitForFunction(()=>!window.__wildshard.world.arena.entered);
  entry.exited=true;entry.worldAfter=await page.evaluate(()=>window.__wildshard.state());
  entry.isolation={health:entry.worldBefore.player.health===entry.worldAfter.player.health,quest:JSON.stringify(entry.worldBefore.quest)===JSON.stringify(entry.worldAfter.quest),weaponRestored:entry.worldBefore.weapon.id===entry.worldAfter.weapon.id};save();
 }
 if(report.errors.length>0)process.exitCode=1;
}catch(error){report.fatal={message:error.message};process.exitCode=1;}finally{await browser.close();save();console.log(JSON.stringify(report.enemies.map(row=>({kind:row.kind,entered:row.before?.targets===1,exited:row.exited}))));}
