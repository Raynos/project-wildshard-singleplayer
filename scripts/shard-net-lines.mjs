// G455: visible storage growth, never a credit, budget or claim of causality.
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';

export const PLATFORM_LAYERS=['engine','game','sdk'];
/** The same unit at both dates: nonblank, comment-free TS and standalone
 * GLSL, excluding tests and declaration files. Build tools ARE included.
 * @param {string} path */
export function platformLineFile(path) {
  return /^src\/(?:engine|game|sdk)\//u.test(path)&&/\.(?:tsx?|glsl)$/u.test(path)&&!path.endsWith('.d.ts')
    &&!/(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.tsx?$/u.test(path);
}
/** @param {string} root @param {(source:string,path:string)=>number} count */
export function platformLineTotals(root,count) {
  const totals={engine:0,game:0,sdk:0};
  const walk=folder=>{if(!existsSync(folder))return;for(const entry of readdirSync(folder,{withFileTypes:true})) {
    const path=resolve(folder,entry.name),local=relative(root,path).replaceAll('\\','/');
    if(entry.isDirectory())walk(path);
    else if(entry.isFile()&&platformLineFile(local)) {
      const layer=PLATFORM_LAYERS.find(value=>local.startsWith(`src/${value}/`));
      if(layer===undefined)throw new Error('Unrecognised platform layer');
      totals[layer]+=count(readFileSync(path,'utf8'),local);
    }
  }};
  for(const layer of PLATFORM_LAYERS)walk(resolve(root,'src',layer));
  return totals;
}
/** Historical M0 custom counts retain their source unit. A negative cut is
 * shown, never clamped. Platform growth is charged ONCE per wave, not once
 * per shard, and includes unrelated concurrent platform work.
 * @param {Record<string,{customLines:number,basis:string}|undefined>} current
 * @param {import('./shard-net-lines.mjs').WaveBaseline[]} baselines
 * @param {Record<string,number>} platform */
export function netLineReport(current,baselines,platform) {
  return baselines.map(baseline=>{
    const shards=Object.fromEntries(Object.entries(baseline.customLines).map(([slug,before])=>{
      const row=current[slug];
      return [slug,{before,after:row?.customLines??null,basis:row?.basis??'unknown',cut:row===undefined?null:before-row.customLines}];
    }));
    const values=Object.values(shards),customCut=values.some(row=>row.cut===null)?null:values.reduce((sum,row)=>sum+(row.cut??0),0);
    const layers=Object.fromEntries(PLATFORM_LAYERS.map(layer=>[layer,{before:baseline.platformLines[layer],after:platform[layer],growth:platform[layer]-baseline.platformLines[layer]}]));
    const platformGrowth=Object.values(layers).reduce((sum,row)=>sum+row.growth,0);
    return {wave:baseline.wave,revision:baseline.revision,record:baseline.record,baselineBasis:'historical source M0',
      enforcement:'report-only',shards,layers,customCut,platformGrowth,netCut:customCut===null?null:customCut-platformGrowth};
  });
}
