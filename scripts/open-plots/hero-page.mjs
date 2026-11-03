// Shared live phone capture owner. Invoked only under scripts/browser-lane.sh.
import {chromium,devices} from 'playwright';
import {existsSync} from 'node:fs';
import {developerSettings,saveFixture,hideDeveloperOverlays,harnessPins} from '../debug-settings.mjs';

// Four round-62 roles, in plot-local metres; a fixed 72-degree vertical lens.
export const HERO_VIEWS=[
  {id:'above-neighbour',eye:[0,140,-430],look:[0,20,0],anchor:[0,-241]},
  {id:'road-entry',eye:[0,1.7,-241],look:[0,16,0],anchor:[0,-241]},
  {id:'top-down',eye:[0,470,-2],look:[0,0,0],anchor:[0,-62]},
  {id:'plaza',eye:[0,1.7,-62],look:[0,12,0],anchor:[0,-62]},
];

export async function withPlotPage({base,pin,slug},run){
  if(!/^open-plot-[a-z]+(?:-[a-z]+)*$/u.test(slug)||!/^[a-f0-9]{40}$/u.test(pin))throw new Error('Requires plot slug and full source pin');
  if(existsSync('.git/quiet'))throw new Error('Official Simulator quiet is active');
  const version=await(await fetch(new URL('/version.json',base))).json();
  if(typeof version.build!=='string'||!version.build.startsWith(pin.slice(0,7)))throw new Error('Served SHA differs');
  const browser=await chromium.launch({headless:true,args:['--mute-audio','--use-angle=metal','--ignore-gpu-blocklist']});
  try{
    const context=await browser.newContext({...devices['iPhone 16 Pro'],viewport:{width:402,height:874}});
    await developerSettings(context,{tier:'phone',volume:0});
    await saveFixture(context,{scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}});
    await context.addInitScript(hideDeveloperOverlays);
    await harnessPins(context,{seed:357,browser:'Chromium / iPhone 16 Pro',lane:'ob2-tools',sha:pin});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const url=new URL('/',base);for(const [key,value]of Object.entries({chunk:slug,tier:'phone',skipintro:'1',nolock:'1',sw:'0',mute:'1'}))url.searchParams.set(key,value);
    await page.goto(url.href,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__wildshard?.world?.hud?.entered&&!document.querySelector('.ws-load'),undefined,{timeout:240000});
    await page.addStyleTag({content:'#hud,.ws-perf,.ws-perf-panel{visibility:hidden!important}'});
    const result=await run(page);
    if(errors.length>0)throw new Error(errors.join('\n'));
    return result;
  }finally{await browser.close();}
}

export async function setHeroCamera(page,view){
  await page.evaluate(async({eye,look,anchor})=>{
    const api=window.__wildshard,world=api.requireWorld();
    await api.pose({x:anchor[0],z:anchor[1],yaw:Math.PI,pitch:0});
    world.freeCamera=true;world.player.keys.clear();world.game.viewmodel.visible=false;
    if(window.__ob2Hero===undefined)world.game.onLate(()=>{
      const camera=world.game.camera,pose=window.__ob2Hero;
      camera.position.set(...pose.eye);camera.lookAt(...pose.look);camera.fov=72;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    },'harness.ob2-hero');
    window.__ob2Hero={eye,look};
  },view);
  await page.waitForTimeout(2000);
}

export function readHeroCamera(page){
  return page.evaluate(()=>{
    const api=window.__wildshard,world=api.requireWorld(),game=world.game,camera=game.camera;
    if(api.app.clock.mode!=='live'||api.boot.tier!=='phone'||game.renderer.getPixelRatio()!==2||game.renderer.getContext().isContextLost())throw new Error('Live phone 2x capture profile failed');
    const direction=camera.getWorldDirection(camera.position.clone());
    return {eye:camera.position.toArray(),look:camera.position.clone().add(direction.multiplyScalar(10)).toArray(),fov:camera.fov,viewport:[innerWidth,innerHeight]};
  });
}
