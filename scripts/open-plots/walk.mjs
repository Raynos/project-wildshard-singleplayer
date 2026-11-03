// Live maintained routes against the same immutable preview as OB8's readings.
// scripts/browser-lane.sh node scripts/open-plots/walk.mjs --base=URL --pin=SHA --plot=IDEA --out=FILE
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {withPlotPage} from './hero-page.mjs';

const {values}=parseArgs({options:Object.fromEntries(['base','pin','plot','out'].map(key=>[key,{type:'string'}]))});
for(const key of ['base','pin','plot','out'])if(!values[key])throw new Error(`Requires --${key}`);
const slug=`open-plot-${values.plot}`;
const source=execFileSync('git',['show',`${values.pin}:scripts/physics-route.json`],{encoding:'utf8'});
const legs=JSON.parse(source)[slug];
if(!Array.isArray(legs)||legs.length===0)throw new Error('Missing maintained walk route');
const result={pin:values.pin,base:values.base,slug,clock:'live',routeSource:'scripts/physics-route.json',rows:[],complete:false};
await withPlotPage({base:values.base,pin:values.pin,slug},async page=>{
  for(const leg of legs){
    const row=await page.evaluate(route=>{
      const api=window.__wildshard;
      if(api.app.clock.mode!=='live')throw new Error('Walk requires live clock');
      return api.walkLeg(route);
    },leg);
    const destination=leg.waypoints.at(-1);
    const complete=destination!==undefined&&row.trace.at(-1)?.at(-1)===leg.waypoints.length-1
      &&Math.hypot(row.end.x-destination.x,row.end.z-destination.z)<0.8;
    result.rows.push({...row,complete});writeFileSync(values.out,`${JSON.stringify(result,null,2)}\n`);
    if(row.stuck.length>0||row.out!==0||!complete)throw new Error(`Walk miss: ${JSON.stringify({slug,stuck:row.stuck,out:row.out,complete})}`);
  }
});
result.complete=true;writeFileSync(values.out,`${JSON.stringify(result,null,2)}\n`);
console.info(JSON.stringify({slug,legs:result.rows.length,stuck:0,out:0,complete:true}));
