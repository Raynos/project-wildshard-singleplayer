import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath, extname, sep } from 'node:path';

const built=resolvePath(process.argv[2]??'tmp/shared-arena-build3'), out=resolvePath(process.argv[3]??'tmp/shared-arena-cycles1');mkdirSync(out,{recursive:false});
const report={schema:'wildshard.shared-arena.cycles.v1',startedAt:new Date().toISOString(),errors:[],checks:{},enemies:[],caveat:'Muted cloud Chromium portrait diagnostic, not physical iPhone performance or visual acceptance. Only diagnostic player positioning and real attack input; no enemy clocks/health/AI injection.'};
const save=()=>writeFileSync(resolvePath(out,'report.json'),`${JSON.stringify(report,null,2)}\n`);
const server=createServer((req,res)=>{const url=new URL(req.url??'/','http://localhost'),path=resolvePath(built,url.pathname==='/'?'index.html':`.${url.pathname}`);if(!path.startsWith(`${built}${sep}`)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'})[extname(path)]??'application/octet-stream');res.end(readFileSync(path));}catch{res.writeHead(404).end();}});
await new Promise(resolve=>{server.listen(0,'127.0.0.1',resolve);});const address=server.address();if(typeof address!=='object'||address===null)throw new Error('No server');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--mute-audio','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({...devices['iPhone 16 Pro'],viewport:{width:402,height:874},deviceScaleFactor:1,recordVideo:{dir:resolvePath(out,'video'),size:{width:402,height:874}}});const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>{report.errors.push(e.message);save();});
 const storage=()=>page.evaluate(async()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),caches:await caches.keys(),databases:await indexedDB.databases(),workers:(await navigator.serviceWorker.getRegistrations()).length}));
 const sample=()=>page.evaluate(()=>{const d=window.__practiceDemo,a=d?.arena.activeTargets[0];return {gameExists:Boolean(d),entered:d?.arena.entered,wall:performance.now(),frame:d?.game.frameTime,targets:d?.arena.activeTargets.length,canvas:document.querySelectorAll('canvas').length,iframes:document.querySelectorAll('iframe').length,enemy:a?{kind:a.kind,hp:a.hp,maxHp:a.maxHp,alive:a.alive,state:a.state,strike:JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike,mem:{...a.mem},position:a.position.toArray()}:null,player:d?.arena.playerVitals,loot:d?.arena.opponent?.loot?.receipt,status:document.querySelector('#arena-status')?.textContent};});
 const place=(placementDistance,placementPitch=.08)=>page.evaluate(({distance,pitch})=>{const d=window.__practiceDemo,a=d.arena.activeTargets[0];d.player.spawn(a.position.x,a.position.z+distance,0,a.position.y);d.player.pitch=pitch;return d.player.position.toArray();},{distance:placementDistance,pitch:placementPitch});
 await page.goto(`http://127.0.0.1:${address.port}/arena.html`,{waitUntil:'domcontentloaded'});report.storageBefore=await storage();report.checks.lazy=await page.evaluate(()=>!window.__practiceDemo&&document.querySelectorAll('canvas').length===1&&document.querySelectorAll('iframe').length===0);
 await page.locator('#arena-start').tap();await page.waitForFunction(()=>window.__practiceDemo?.arena.entered===true||!document.querySelector('#arena-start')?.disabled);
 if(!await page.evaluate(()=>window.__practiceDemo?.arena.entered===true))throw new Error(await page.locator('#arena-status').textContent());
 await page.evaluate(()=>{window.__sharedArenaTestGame=window.__practiceDemo.game;});
 const stateStore=()=>page.evaluate(()=>{const s=window.__practiceDemo.game.app.saves;return{docs:JSON.parse(s.exportAll()).docs,shard:s.inspectShard({id:'driftwood-isle'}),generation:s.inspectShardGeneration({id:'driftwood-isle'})};});
 report.stateBefore=await stateStore();
 await page.evaluate(()=>{
  window.__cycleFrameLog=[];window.__cyclePhase='begin';window.__cycleRecord=true;
  const badge=document.createElement('div');badge.id='cycle-qa';badge.style.cssText='position:fixed;bottom:6px;left:8px;z-index:9999;color:white;background:#000c;padding:5px;font:11px monospace;pointer-events:none';document.body.append(badge);
  const tick=wall=>{if(!window.__cycleRecord)return;const d=window.__practiceDemo,a=d?.arena.activeTargets[0];if(d){window.__cycleFrameLog.push([wall,d.game.frameTime,a?.hp??null,d.arena.playerVitals?.health??null,window.__cyclePhase]);badge.textContent=`SHARED ARENA QA | ${a?.kind??'none'} | ${window.__cyclePhase} | sim ${d.game.frameTime.toFixed(2)}s`; }requestAnimationFrame(tick);};requestAnimationFrame(tick);
 });
 for(const [kind,coins] of [['splinter-mantis',3],['conch-duelist',3],['tideRootColossus',35],['brine-puffer',2]]){
  if(kind!=='splinter-mantis'){await page.selectOption('#arena-opponent',kind);await page.waitForFunction(selectedKind=>window.__practiceDemo?.arena.activeTargets[0]?.kind===selectedKind&&!document.querySelector('#arena-opponent')?.disabled,kind);}
  const row={kind,expectedCoins:coins,entry:await sample(),samples:[],placements:[],checks:{}};report.enemies.push(row);save();
  const phase=async name=>{row.phase=name;await page.evaluate(value=>{window.__cyclePhase=value;},`${kind}:${name}`);save();};
  const observe=async()=>{const value=await sample();row.samples.push({phase:row.phase,...value});save();return value;};
  const position=async(distance,pitch,reason)=>{row.placements.push({wall:Date.now(),reason,position:await place(distance,pitch)});};
  const capture=async name=>{await page.screenshot({path:resolvePath(out,`${kind}-${name}.jpg`),type:'jpeg',quality:80,scale:'css'});};
  row.checks.singleInstance=await page.evaluate(()=>window.__practiceDemo.game===window.__sharedArenaTestGame&&document.querySelectorAll('canvas').length===1&&document.querySelectorAll('iframe').length===0);
  row.checks.fresh=row.entry.enemy?.alive===true&&row.entry.enemy.hp===row.entry.enemy.maxHp&&row.entry.player?.health===100&&row.entry.targets===1;
  await phase('sword-kill');
  const killDeadline=Date.now()+180000;
  let attacks=0;
  while(Date.now()<killDeadline){const before=await observe();if(!before.enemy?.alive||before.player?.health===0)break;
   await position(kind==='tideRootColossus'?2.2:1.8,kind==='tideRootColossus'?.03:.08,'Diagnostic sword range; actual touch attack');
   await page.locator('.ws-touch-attack').tap();attacks++;
   for(let beat=0;beat<5;beat++){await page.waitForTimeout(150);const current=await observe();if(!current.enemy?.alive||current.player?.health===0)break;}
  }
  row.attackCount=attacks;row.afterSword=await observe();row.checks.enemyDefeated=row.afterSword.enemy?.alive===false;await capture('kill');
  if(row.checks.enemyDefeated){
   await phase('corpse-loot');const health=row.afterSword.player?.health,lootDeadline=Date.now()+45000;
   while(Date.now()<lootDeadline){await position(.7,.1,'Diagnostic coin collection position; no reward injection');await page.waitForTimeout(500);const current=await observe();if(current.loot?.complete===true)break;}
   row.afterLoot=await observe();row.checks.boutLocalReward=row.afterLoot.loot?.scope==='practice'&&row.afterLoot.loot?.coins===coins&&row.afterLoot.loot?.complete===true;
   row.checks.noPostDeathDamage=row.afterLoot.player?.health===health;await capture('loot');
  }else{row.checks.boutLocalReward=false;row.checks.noPostDeathDamage=false;}
  row.stateAfterLoot=await stateStore();row.storageAfterLoot=await storage();
  await phase('retry-after-kill');await page.locator('#arena-retry').tap();await page.waitForTimeout(150);row.retryAfterKill=await observe();
  row.checks.retryAfterKill=row.retryAfterKill.enemy?.alive===true&&row.retryAfterKill.enemy.hp===row.retryAfterKill.enemy.maxHp&&row.retryAfterKill.player?.health===100&&row.retryAfterKill.loot?.coins===0&&row.retryAfterKill.loot?.complete===false;
  await phase('player-defeat');const defeatDeadline=Date.now()+180000;
  while(Date.now()<defeatDeadline){const before=await observe();if(before.player?.health===0)break;
   await position(kind==='tideRootColossus'?.85:kind==='brine-puffer'?1.6:.85,.15,'Diagnostic enemy attack range; no player attack');
   for(let beat=0;beat<8;beat++){await page.waitForTimeout(200);const current=await observe();if(current.player?.health===0)break;}
  }
  row.playerDefeat=await observe();row.checks.playerDefeated=row.playerDefeat.player?.health===0;await capture('player-defeat');
  await phase('defeated-attack');await page.locator('.ws-touch-attack').tap();await page.waitForTimeout(700);row.afterDefeatedAttack=await observe();
  row.checks.defeatedAttackBlocked=row.checks.playerDefeated&&row.afterDefeatedAttack.enemy?.hp===row.playerDefeat.enemy?.hp;
  await phase('retry-after-defeat');await page.locator('#arena-retry').tap();await page.waitForTimeout(150);row.finalRetry=await observe();
  row.checks.finalRetry=row.finalRetry.enemy?.alive===true&&row.finalRetry.enemy.hp===row.finalRetry.enemy.maxHp&&row.finalRetry.player?.health===100&&row.finalRetry.loot?.coins===0&&row.finalRetry.loot?.complete===false;
  row.storage=await storage();row.stateAfterRetry=await stateStore();
  row.checks.emptyWorldState=[report.stateBefore,row.stateAfterLoot,row.stateAfterRetry].every(state=>JSON.stringify(state)===JSON.stringify(report.stateBefore)&&state.generation===0&&Object.keys(state.shard).length===0&&Object.values(state.docs).every(doc=>Object.keys(doc.keys).length===0));
  const frames=await page.evaluate(()=>{const values=window.__cycleFrameLog;window.__cycleFrameLog=[];return values;});
  writeFileSync(resolvePath(out,`${kind}-frames.json`),`${JSON.stringify({columns:['rafMilliseconds','simulationSeconds','enemyHP','playerHP','phase'],frames})}\n`,{flag:'wx'});
  row.frameCount=frames.length;row.firstFrame=frames[0];row.lastFrame=frames.at(-1);await capture('final-retry');save();
 }
 await page.evaluate(()=>{window.__cycleRecord=false;});
 await page.locator('#arena-back').tap();report.back=await sample();report.checks.back=report.back.entered===false&&report.back.targets===0;
 await page.locator('#arena-start').tap();await page.waitForFunction(()=>window.__practiceDemo?.arena.entered===true&&!document.querySelector('#arena-opponent')?.disabled);report.restart=await sample();report.checks.restartSameGame=await page.evaluate(()=>window.__practiceDemo.game===window.__sharedArenaTestGame);report.checks.restartFresh=report.restart.player?.health===100&&report.restart.enemy?.hp===report.restart.enemy?.maxHp;
 report.storageAfter=await storage();await page.reload({waitUntil:'domcontentloaded'});report.reload=await sample();report.checks.reloadFresh=!report.reload.gameExists&&!await page.locator('#arena-start').isHidden();report.storageAfterReload=await storage();
 report.checks.persistence=[report.storageBefore,report.storageAfter,report.storageAfterReload,...report.enemies.map(row=>row.storage)].every(s=>s.local.length===0&&s.session.length===0&&s.caches.length===0&&s.databases.length===0&&s.workers===0);
 report.checks.recording=true;report.checks.bellbackUnavailable=await page.locator('option[value="bellback"]').isDisabled();report.checks.noErrors=report.errors.length===0;
 await context.close();
}catch(error){report.fatal=error.message;process.exitCode=1;}finally{await browser.close();await new Promise(resolve=>{server.close(resolve);});report.endedAt=new Date().toISOString();save();writeFileSync(resolvePath(out,'completed-report.json'),`${JSON.stringify(report,null,2)}\n`,{flag:'wx'});}
if(Object.values(report.checks).some(v=>v!==true)||report.enemies.some(row=>Object.values(row.checks).some(v=>v!==true)))process.exitCode=1;
console.log(JSON.stringify({checks:report.checks,enemies:report.enemies.map(r=>({kind:r.kind,checks:r.checks})),fatal:report.fatal}));
