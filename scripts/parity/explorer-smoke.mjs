#!/usr/bin/env node
// V3: every primary shard's actual Model Explorer catalogue and built thumbnails.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browserPool, parallel } from './pool.mjs';
import { serve } from './serve.mjs';
import { bootCases, discoverCatalogue } from './boot-smoke.mjs';
import { saveFixture } from '../debug-settings.mjs';

/** Browser-side, read-only: the existing card canvases after the ordinary Explorer has drawn every one.
 * No re-render, material replacement or injected scene supplies the pixels. */
export function explorerCards() {
  return [...document.querySelectorAll('.ws-x-grid .ws-x-model')].map(card => {
    if(!(card instanceof HTMLElement))throw new Error('Invalid model card');
    const id=card.dataset.id??'', canvas=card.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return {id,ready:false,pixels:0,darkShare:1};
    const context=canvas.getContext('2d');
    if (context===null || canvas.width===0 || canvas.height===0) return {id,ready:false,pixels:0,darkShare:1};
    const data=context.getImageData(0,0,canvas.width,canvas.height).data;
    let dark=0,pixels=0;
    for(let at=0;at<data.length;at+=16){
      pixels++;
      if(Math.max(data[at]??0,data[at+1]??0,data[at+2]??0)<16)dark++;
    }
    return {id,ready:true,pixels,darkShare:pixels===0?1:dark/pixels};
  });
}

/** @param {readonly {slug:string,status:string,legacy:boolean,shardSelect?:boolean}[]} catalogue */
export function explorerCases(catalogue) {
  return [...new Set([...bootCases(catalogue).filter(row=>row[0]!=='grid').map(row=>row[1]),
    ...catalogue.filter(row=>!row.legacy && row.shardSelect===false).map(row=>row.slug)])];
}

/** @param {readonly {id:string,ready:boolean,pixels:number,darkShare:number}[]} cards */
export function explorerFailures(cards) {
  const seen=new Set(), failures=[];
  for(const card of cards){
    if(card.id.length===0 || seen.has(card.id))failures.push('Missing or duplicate model identity');
    seen.add(card.id);
    if(!card.ready || !Number.isFinite(card.pixels) || card.pixels<=0)failures.push(`${card.id}: thumbnail never drew`);
    else if(!Number.isFinite(card.darkShare) || card.darkShare<0 || card.darkShare>=.9)failures.push(`${card.id}: thumbnail is at least 90% near-black`);
  }
  return failures;
}

/** Readiness only, at the existing polling cadence; pixel validation still runs after every card draws. */
export function explorerState() {
  const fatal=[...document.querySelectorAll('#wserr,.ws-load-error,.ws-game-dev-alert,[data-boot-fatal]')].map(node=>node.textContent);
  const root=document.querySelector('.ws-x.show[data-mode="model"]');
  const cards=root?.querySelectorAll('.ws-x-grid .ws-x-model');
  const readyIds=cards===undefined?[]:[...cards].filter(card=>card.querySelector('canvas')!==null).map(card=>{
    if(!(card instanceof HTMLElement))throw new Error('Invalid model card');
    return card.dataset.id??'';
  });
  return {fatal,empty:root?.querySelector('.ws-x-empty-models.show')!==null && root!==null,
    ready:cards!==undefined && cards.length>0 && readyIds.length===cards.length,readyIds};
}

/** @param {import('playwright').Browser} browser @param {string} base @param {string} slug @param {string} out */
async function sweep(browser,base,slug,out){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await saveFixture(context,{scope:'device',key:'devMode',data:true});
  await context.route(new URL('/api/telemetry',base).href,route=>route.fulfill({status:204}));
  const page=await context.newPage();
  /** @type {string[]} */ const faults=[];
  page.on('pageerror',error=>faults.push(error.message));
  page.on('crash',()=>faults.push('Page crashed'));
  page.on('console',message=>{if(message.type()==='error')faults.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)faults.push(`HTTP ${response.status()}: ${response.url()}`);});
  const started=Date.now(),deadline=started+180000;
  /** @type {Map<string,number>} */ const firstReady=new Map();
  try{
    const url=new URL(base);
    for(const [key,value]of Object.entries({chunk:slug,explore:'model',tier:'phone',touch:'1',mute:'1',nolock:'1',sw:'0'}))url.searchParams.set(key,value);
    await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:30000});
    let empty=false,drawn=false;
    while(Date.now()<deadline){
      if(faults.length>0)throw new Error(faults.join('\n'));
      const state=await page.evaluate(explorerState),observedMs=Date.now()-started;
      for(const id of state.readyIds)if(!firstReady.has(id))firstReady.set(id,observedMs);
      if(state.fatal.length>0)throw new Error(`Explorer fatal: ${state.fatal.join('; ')}`);
      if(state.empty){empty=true;break;}
      if(state.ready){drawn=true;break;}
      await new Promise(_resolve=>{setTimeout(_resolve,250);});
    }
    if(!empty && !drawn)throw new Error('Explorer catalogue/thumbnail deadline');
    const cards=await page.evaluate(explorerCards),failures=explorerFailures(cards);
    if(!empty && cards.length===0)failures.push('Explorer catalogue disappeared');
    if(faults.length>0)failures.push(...faults);
    const result={slug,elapsedMs:Date.now()-started,empty,cards,failures,firstReadyMs:Object.fromEntries(firstReady)};
    writeFileSync(join(out,`${slug}.json`),`${JSON.stringify(result,null,2)}\n`);
    if(failures.length>0)throw new Error(`${slug}: ${failures.join('; ')}`);
    console.info(`Explorer ${slug}: ${empty?'explicit empty catalogue':`${cards.length} real thumbnails`} PASS`);
  }catch(error){
    await page.screenshot({path:join(out,`${slug}-failure.jpg`),type:'jpeg',quality:70}).catch(()=>undefined);
    writeFileSync(join(out,`${slug}-failure.json`),`${JSON.stringify({slug,elapsedMs:Date.now()-started,error:String(error),faults,cards:await page.evaluate(explorerCards).catch(()=>[]),firstReadyMs:Object.fromEntries(firstReady)},null,2)}\n`);
    throw error;
  }finally{await context.close();}
}

async function main(){
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const option=(/** @type {string} */name)=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
  const out=resolve(option('out')??'boot-smoke-results/explorer');mkdirSync(out,{recursive:true});
  const external=option('url');
  if(external===undefined && !existsSync(join(root,'dist/index.html')))throw new Error('Build dist before Explorer smoke');
  const preview=external===undefined?await serve(root,'',true):null,base=external??preview?.url;
  if(base===undefined)throw new Error('Missing exact built dist');
  const pool=browserPool(root,2,process.platform==='darwin'?'metal':'swiftshader');
  try{
    const catalogue=await discoverCatalogue(await pool.browser(0),base),cases=explorerCases(catalogue);
    writeFileSync(join(out,'cases.json'),`${JSON.stringify({catalogue,cases},null,2)}\n`);
    await parallel(cases,2,async(slug,index,slot)=>sweep(await pool.browser(slot),base,slug,out),slot=>pool.release(slot));
  }finally{try{await pool.close();}finally{preview?.close();}}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
