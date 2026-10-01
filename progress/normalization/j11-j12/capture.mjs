import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const repo=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\/$/u,'');
const {cachedTree,serve}=await import(repo+'/scripts/parity/serve.mjs');
const {browserPool}=await import(repo+'/scripts/parity/pool.mjs');
const {installInit}=await import(repo+'/scripts/parity/init.mjs');
const {debugSettings}=await import(repo+'/scripts/debug-settings.mjs');
const {advance,poseAt}=await import(repo+'/scripts/parity/frames.mjs');
const [sha,out]=process.argv.slice(2);mkdirSync(out,{recursive:true});
const tree=await cachedTree(repo,sha), preview=await serve(tree.tree,sha,true),pool=browserPool(repo,1,'metal');
try {
 const browser=await pool.browser(0),context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'});
 try {
 await installInit(context,{lane:'m5',sha,browser:browser.version(),capture:30,accelerated:true,tier:'desktop'});
 await debugSettings(context,{time:'midday',weather:'clear'});
 const page=await context.newPage();page.setDefaultTimeout(120000);await page.goto(preview.url+'/?chunk=pine-hollow&tier=desktop&skipintro&nolock&mute&sw=0');
 await page.waitForFunction(()=>Boolean(window.__wildshard)&&!document.querySelector('.ws-load')&&!document.querySelector('.ws-load-error'));
 await advance(page,30);
 const pose=await page.evaluate(()=>window.__wildshard.world.game.level.spawn);
 const sample=()=>page.evaluate(()=>{const w=window.__wildshard,p=w.world.player,b=w.world.weapons.current;return {pos:{x:p.position.x,y:p.position.y,z:p.position.z},eye:p.camera?.position.y??w.world.game.camera.position.y,crouching:p.crouching,charge:b.charge,ammo:b.state.ammo??b.state.bolts,weapon:b.id,clock:w.state().clockNow};});
 await poseAt(page,pose);await advance(page,30);const start=await sample();
 await page.keyboard.down('c');await page.keyboard.down('w');await advance(page,60);const crouchWalk=await sample();await page.screenshot({path:out+'/crouch-walk.jpg',type:'jpeg',quality:80});await page.keyboard.up('w');await page.keyboard.up('c');await advance(page,30);
 await poseAt(page,pose);await page.evaluate(()=>{const w=window.__wildshard;w.world.weapons.unlock('bow');w.combat.equip('bow');});await advance(page,30);
 const beforeF=await sample();await page.keyboard.press('f');await advance(page,60);const afterF=await sample();await page.screenshot({path:out+'/bow-f.jpg',type:'jpeg',quality:80});
 await page.mouse.move(800,450);await page.mouse.down();await advance(page,30);const fullDraw=await sample();await page.mouse.up();await advance(page,1);const manualRelease=await sample();
 writeFileSync(out+'/actions.json',JSON.stringify({sha,start,crouchWalk,beforeF,afterF,fullDraw,manualRelease},null,2));
 }finally{await context.close();}
}finally{await pool.close();preview.close();tree.cleanup();}
