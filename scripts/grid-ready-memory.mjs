import * as v from 'valibot';

const hex = v.pipe(v.string(), v.regex(/^[a-f0-9]+$/iu));
const named = v.looseObject({pid:v.number(),name:v.literal('process_name'),args:v.looseObject({name:v.string()})});
const dump = v.looseObject({pid:v.number(),id:v.string(),ph:v.literal('v'),args:v.looseObject({dumps:v.looseObject({
  process_totals:v.looseObject({private_footprint_bytes:hex})})})});

/** Sum simultaneous processes by role within each dump, then retain each role's observed peak.
 * Chromium's memory-infra byte counts are hexadecimal. Missing roles refuse a receipt.
 * @param {readonly unknown[]} events */
export function chromiumProcessPeaks(events) {
  const names = new Map();
  for (const event of events) { const result=v.safeParse(named,event); if(result.success) names.set(result.output.pid,result.output.args.name); }
  /** @type {Map<string,Map<number,{role:string,bytes:number}>>} */
  const dumps = new Map();
  for (const event of events) {
    const result=v.safeParse(dump,event); if(!result.success)continue;
    const row=result.output,role=names.get(row.pid),bytes=Number.parseInt(row.args.dumps.process_totals.private_footprint_bytes,16);
    if(!['Browser','Renderer','GPU Process'].includes(role)||!Number.isSafeInteger(bytes)||bytes<=0)continue;
    let processes=dumps.get(row.id); if(processes===undefined){processes=new Map();dumps.set(row.id,processes);}
    processes.set(row.pid,{role,bytes});
  }
  const peaks={browser:0,renderer:0,gpu:0};
  for(const processes of dumps.values()) {
    const totals={browser:0,renderer:0,gpu:0};
    for(const {role,bytes} of processes.values()) {
      if(role==='Browser')totals.browser+=bytes;
      if(role==='Renderer')totals.renderer+=bytes;
      if(role==='GPU Process')totals.gpu+=bytes;
    }
    for(const key of /** @type {const} */ (['browser','renderer','gpu']))peaks[key]=Math.max(peaks[key],totals[key]);
  }
  if(Object.values(peaks).some(bytes=>bytes===0))throw new Error('CDP memory dump omitted a required process role');
  return peaks;
}

/** Attribute the cell's effective deduplicated claims plus its shared product transport once.
 * Other cells, platform and commons remain page totals, never another copy of the shard's charge.
 * @param {readonly {id:string,owner:string,accountedBytes:number}[]} claims @param {string} instance @param {string} slug */
export function ownedResidencyBytes(claims,instance,slug) {
  let bytes=0;
  for(const claim of claims)if(claim.owner===instance||claim.id===`product:grid:${slug}`) {
    if(!Number.isSafeInteger(claim.accountedBytes)||claim.accountedBytes<0)throw new Error('Invalid owned residency claim');
    bytes+=claim.accountedBytes;
  }
  return bytes;
}
