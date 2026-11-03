#!/usr/bin/env node
// G987: SHARD SELECT card art for the built open plots, captured live in the engine (phone tier, 2x, iPhone 16 Pro).
// capture: scripts/browser-lane.sh node scripts/open-plots/card-capture.mjs --base=URL --pin=SHA --out=NEW_DIR [--plots=a,b] [--views=a,b]
//   writes <out>/<idea>-<view>-{portrait,landscape}.png for every candidate view
// encode:  node scripts/open-plots/card-capture.mjs --encode=<out> --pick=idea:portraitView:landscapeView,...
//   writes src/shards/open-plots/thumbs/<idea>{,-portrait,-landscape}.jpg in the main shards' card formats (thumb from landscape)
import {mkdirSync,existsSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import sharp from 'sharp';
import {withPlotPage} from './hero-page.mjs';

export const CARD_PLOTS=['night-market','lantern-bayou','frostline-peaks','ember-forge','coral-drift','mosslight-ruins','jungle-ziggurat'];
// Plot-local metres, as HERO_VIEWS; `fov` is vertical per orientation (72 portrait = the hero lens, 45 landscape ≈ 72 across).
export const CARD_VIEWS={
  plaza:{eye:[0,1.7,-62],look:[0,12,0],anchor:[0,-62]},
  raised:{eye:[0,9,-80],look:[0,14,0],anchor:[0,-62]},
  approach:{eye:[0,24,-120],look:[0,10,0],anchor:[0,-62]},
  high:{eye:[0,70,-170],look:[0,0,-10],anchor:[0,-62]},
};
const FOV={portrait:72,landscape:45};
const VIEWPORT={portrait:{width:402,height:874},landscape:{width:800,height:450}};
// The main shards' card formats (driftwood-isle/thumbs): thumb 640x360, portrait 804x1626, landscape 1600x900.
const FORMATS=[['',640,360,'landscape'],['-portrait',804,1626,'portrait'],['-landscape',1600,900,'landscape']];

const {values}=parseArgs({options:Object.fromEntries(['base','pin','out','plots','views','encode','pick'].map(key=>[key,{type:'string'}]))});

async function setCardCamera(page,view,lens){
  await page.evaluate(async({eye,look,anchor,fov})=>{
    const api=window.__wildshard,world=api.requireWorld();
    await api.pose({x:anchor[0],z:anchor[1],yaw:Math.PI,pitch:0});
    world.freeCamera=true;world.player.keys.clear();world.game.viewmodel.visible=false;
    if(window.__cardCamera===undefined)world.game.onLate(()=>{
      const camera=world.game.camera,pose=window.__cardCamera;
      camera.position.set(...pose.eye);camera.lookAt(...pose.look);camera.fov=pose.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    },'harness.card-camera');
    window.__cardCamera={eye,look,fov};
  },{...view,fov:lens});
  await page.waitForTimeout(2500);
}

async function capture(){
  for(const key of ['base','pin','out'])if(!values[key])throw new Error(`Requires --${key}`);
  const out=resolve(values.out);if(existsSync(out))throw new Error(`${out} exists`);mkdirSync(out,{recursive:true});
  const plots=values.plots?.split(',')??CARD_PLOTS,views=values.views?.split(',')??Object.keys(CARD_VIEWS);
  for(const idea of plots)await withPlotPage({base:values.base,pin:values.pin,slug:`open-plot-${idea}`},async page=>{
    for(const orientation of ['portrait','landscape']){
      // The rotate gate (src/engine/ui/RotateGate.ts) stops a coarse-pointer page from drawing in landscape; the landscape
      // backdrop is the desktop menu's, so that view drops touch (pointer: fine) and keeps the phone tier and 2x.
      if(orientation==='landscape')await (await page.context().newCDPSession(page)).send('Emulation.setTouchEmulationEnabled',{enabled:false});
      await page.setViewportSize(VIEWPORT[orientation]);
      for(const id of views){
        const view=CARD_VIEWS[id];if(view===undefined)throw new Error(`No view ${id}`);
        await setCardCamera(page,view,FOV[orientation]);
        const file=join(out,`${idea}-${id}-${orientation}.png`);
        await page.screenshot({path:file,type:'png',animations:'allow'});
        console.info(file);
      }
    }
  });
}

async function encode(){
  const dir=resolve(values.encode),thumbs=resolve('src/shards/open-plots/thumbs');
  for(const pick of (values.pick??'').split(',').filter(Boolean)){
    const [idea,portrait,landscape]=pick.split(':'),view={portrait,landscape};
    if(!CARD_PLOTS.includes(idea)||CARD_VIEWS[portrait]===undefined||CARD_VIEWS[landscape]===undefined)throw new Error(`Bad pick ${pick}`);
    for(const [suffix,width,height,orientation]of FORMATS){
      const file=join(thumbs,`${idea}${suffix}.jpg`);
      await sharp(join(dir,`${idea}-${view[orientation]}-${orientation}.png`)).resize(width,height,{fit:'cover',position:'centre'}).jpeg({quality:82,mozjpeg:true}).toFile(file);
      console.info(`${file}: ${statSync(file).size} B`);
    }
  }
}

await (values.encode?encode():capture());
