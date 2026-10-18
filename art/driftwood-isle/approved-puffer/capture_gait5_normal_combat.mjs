// Run from an isolated app export; set CHROMIUM_EXECUTABLE_PATH to the installed official browser.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root=path.resolve('tmp/puffer-native-preview-v57-gait5-dist');
const server=http.createServer((req,res)=>{const u=(req.url??'/').split('?')[0];const p=path.resolve(root,'.'+decodeURIComponent(u==='/'?'/index.html':u));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.css':'text/css'})[path.extname(p)]??'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(4486,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,recordVideo:{dir:'tmp/v57-gait5-normal-combat-video',size:{width:390,height:844}}});const page=await context.newPage();const report={start:new Date().toISOString(),errors:[],httpErrors:[],inputs:[]};page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.url());});
try{
await page.goto('http://127.0.0.1:4486/',{waitUntil:'load'});await page.getByRole('button',{name:'Start practice',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#practice-status')?.textContent?.startsWith('Practice bout.'));
await page.evaluate(()=>{window.__motionCapture={start:performance.now(),phase:'normal-combat',samples:[]};const overlay=document.createElement('div');overlay.id='motion-label';overlay.style.cssText='position:fixed;right:4px;top:65px;z-index:99999;color:white;background:#000d;font:10px monospace;pointer-events:none;max-width:270px';document.body.append(overlay);const tick=()=>{const c=window.__motionCapture,t=(performance.now()-c.start)/1000;overlay.textContent=`NORMAL RENDERER COMBAT t=${t.toFixed(3)}s`;const a=window.__practiceDemo.arena.activeTargets[0];c.samples.push({t,phase:c.phase,stage:a?.mem['puffer-st'],clock:a?.mem['regular-clock'],alive:a?.alive,hp:a?.hp,flinch:a?.flinch,speed:a?.speed,gaitPhase:a?.gaitPhase,position:a?.position.toArray(),yaw:a?.yaw,camera:window.__practiceDemo.game.camera.position.toArray(),bones:a?.mesh?.skeleton.bones.map(b=>({name:b.name,p:b.position.toArray(),r:[b.rotation.x,b.rotation.y,b.rotation.z],world:b.matrixWorld.toArray()}))});window.__motionRAF=requestAnimationFrame(tick);};tick();});
const inventory=()=>page.evaluate(()=>{const g=window.__practiceDemo.game,r=g.renderer,gl=r.getContext();return {pixelRatio:r.getPixelRatio(),buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],canvas:[g.canvas.width,g.canvas.height],shadows:r.shadowMap.enabled,passes:g.composer.passes.map(p=>({name:p.constructor.name,enabled:p.enabled,renderToScreen:p.renderToScreen})),camera:g.camera?.position?.toArray(),t:(performance.now()-window.__motionCapture.start)/1000};});
report.before=await inventory();
const input=async(label,fn)=>{report.inputs.push({label,wall:new Date().toISOString(),t:await page.evaluate(()=>(performance.now()-window.__motionCapture.start)/1000)});await fn();};
const cdp=await context.newCDPSession(page);
await input('Real LOOK drag down 48px over300ms',async()=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:340,y:400}]});for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:340,y:400+i*8}]});await page.waitForTimeout(50);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});});
report.distanceSamples=[];
const storage=()=>page.evaluate(async()=>({local:Object.fromEntries(Object.entries(localStorage)),session:Object.fromEntries(Object.entries(sessionStorage)),cookies:document.cookie,cacheKeys:await caches.keys(),serviceWorkers:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope),indexedDBNames:typeof indexedDB.databases==='function'?(await indexedDB.databases()).map(d=>d.name):null}));
report.storageBefore=await storage();
await input('real approach W 1200ms',async()=>{await page.keyboard.down('w');await page.waitForTimeout(1200);await page.keyboard.up('w');});
report.combat=[];
for(let i=0;i<35;i++){
 const row=await page.evaluate(()=>{const d=window.__practiceDemo,a=d.arena.activeTargets[0];return {t:(performance.now()-window.__motionCapture.start)/1000,hp:a?.hp,alive:a?.alive,flinch:a?.flinch,status:document.querySelector('#practice-status')?.textContent,health:[...document.querySelectorAll('.ws-game-hval')].map(x=>x.textContent)};});report.combat.push(row);
 if(row.alive===false||/cleared|victory|defeated/i.test(row.status??''))break;
 await input('real touch attack',async()=>{await page.locator('.ws-touch-attack').tap();});
 if(i%5===4)await input('real approach W 250ms',async()=>{await page.keyboard.down('w');await page.waitForTimeout(250);await page.keyboard.up('w');});
 await page.waitForTimeout(500);
}
await page.waitForTimeout(1600);
report.after=await inventory();report.storageAfterCombat=await storage();
await page.screenshot({path:'tmp/v57-gait5-normal-combat-after.png'});
report.preRetryStatus=await page.locator('#practice-status').textContent();
await input('real Retry button',async()=>{await page.getByRole('button',{name:'Retry',exact:true}).click();});await page.waitForTimeout(1200);
report.storageAfterRetry=await storage();report.retryHealth=await page.locator('.ws-game-hval').allTextContents();
await page.screenshot({path:'tmp/v57-gait5-normal-combat-standoff.png'});
report.capture=await page.evaluate(()=>{cancelAnimationFrame(window.__motionRAF);return window.__motionCapture;});report.status=await page.locator('#practice-status').textContent();await page.screenshot({path:'tmp/v57-gait5-normal-combat-final.png'});
}finally{report.end=new Date().toISOString();await context.close();report.video=await page.video().path();await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync('tmp/v57-gait5-normal-combat-capture.json',JSON.stringify(report,null,2));console.log(JSON.stringify({video:report.video,errors:report.errors,status:report.status,samples:report.capture?.samples.length,start:report.start,end:report.end}));}
