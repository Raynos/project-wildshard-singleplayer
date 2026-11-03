#!/usr/bin/env node
// One command per plot: live matched four-camera phone captures and bar-5 board.
// scripts/browser-lane.sh node scripts/open-plots/comparison.mjs --plot=ember-forge --base=URL --pin=SHA --out=NEW_DIR
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import {makeComparisonBoard} from './ob2.mjs';
import {withPlotPage,setHeroCamera,readHeroCamera,HERO_VIEWS} from './hero-page.mjs';

const {values}=parseArgs({options:Object.fromEntries(['plot','base','pin','out'].map(key=>[key,{type:'string'}]))});
for(const key of ['plot','base','pin','out'])if(!values[key])throw new Error(`Requires --${key}`);
if(!['frostline-peaks','lantern-bayou','ember-forge','mosslight-ruins','coral-drift'].includes(values.plot))throw new Error('Expected one of the five OB plots');
const recipe=JSON.parse(readFileSync(new URL(`recipes/${values.plot}.json`,import.meta.url),'utf8'));
const crops=[{left:4,top:84,width:431,height:645},{left:446,top:84,width:431,height:645},
  {left:4,top:744,width:431,height:654},{left:446,top:744,width:431,height:654}];
const out=resolve(values.out);mkdirSync(out,{recursive:true});
// A completed or partial run is never overwritten and mistaken for this run.
mkdirSync(join(out,'captures'));
const input={idea:values.plot,title:`${recipe.name} · round 62 / now / Night Market`,views:HERO_VIEWS.map((view,i)=>({id:view.id,mockup:{file:recipe.reference,crop:crops[i]}}))};
for(const [column,slug]of [['now',`open-plot-${values.plot}`],['nightMarket','open-plot-night-market']]){
  await withPlotPage({base:values.base,pin:values.pin,slug},async page=>{
    for(const [i,view]of HERO_VIEWS.entries()){
      await setHeroCamera(page,view);
      const camera=await readHeroCamera(page),file=join(out,'captures',`${column}-${view.id}.png`);
      await page.screenshot({path:file,type:'png',scale:'css',animations:'allow'});
      input.views[i][column]={file,pin:values.pin,camera};
      writeFileSync(join(out,'input.json'),`${JSON.stringify(input,null,2)}\n`);
    }
  });
}
const result=await makeComparisonBoard(input),file=join(out,'board.jpg');
writeFileSync(file,result.jpeg);writeFileSync(`${file}.json`,`${JSON.stringify(result.reading,null,2)}\n`);
console.info(`${file}: ${result.reading.width}x${result.reading.height} JPEG, ${result.jpeg.length} B`);
