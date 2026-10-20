// G458: read measured receipts, never replace a missing reading with declared costs.
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import * as v from 'valibot';

const sha=v.pipe(v.string(),v.regex(/^[a-f0-9]{40}$/u));
const positive=v.pipe(v.number(),v.finite(),v.minValue(1));
const memory=v.looseObject({measurement:v.literal('native-footprint+gpu'),samples:positive,playingPeakBytes:positive,loadingPeakBytes:positive});
const run=v.looseObject({sha,when:v.string(),surface:v.literal('sim'),cohort:v.literal('grid'),complete:v.literal(true),glObserver:v.literal('off'),
  memory:v.optional(memory),cases:v.array(v.looseObject({shard:v.string(),complete:v.boolean(),errors:v.array(v.unknown()),
    routes:v.array(v.looseObject({name:v.string(),after:v.looseObject({current:v.nullable(v.string())})})),
    rows:v.array(v.looseObject({name:v.string(),frames:positive,pass:v.boolean(),contextLost:v.optional(v.boolean())}))}))});
const milestone=v.looseObject({schema:v.literal(1),source:sha,protocol:v.looseObject({profiler:v.literal(false),glObserver:v.literal('off'),quiet:v.optional(v.boolean())}),runs:v.array(v.unknown())});
const soak=v.looseObject({schema:v.literal(3),sha,driveStarted:v.string(),surface:v.literal('portrait iPhone Simulator Safari'),
  functionalPass:v.literal(true),seconds:positive,circuits:v.pipe(v.number(),v.integer(),v.minValue(2)),errors:v.pipe(v.array(v.unknown()),v.length(0)),grade:v.looseObject({
    sampling:v.literal(true),missingGlSamples:v.literal(0),rehearsal:v.literal(false),calibration:v.literal(true),leakZero:v.literal(true),
    requiredSeconds:positive,admitted:v.array(v.string()),peakBytes:positive,loadingPeakBytes:positive})});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Only committed milestone/soak locations, no scratch logs or process caches.
 * @param {string} root */
export function runtimeReceiptPaths(root) {
  const directory=resolve(root,'progress/shard-platform'),out=[];
  const walk=folder=>{if(!existsSync(folder))return;for(const entry of readdirSync(folder,{withFileTypes:true})) {
    const path=resolve(folder,entry.name);
    if(entry.isDirectory())walk(path);
    else if(entry.isFile()&&/^(?:receipt|(?:dev|shipped)(?:-cells)?)\.json$/u.test(entry.name)&&statSync(path).size<=5_000_000)out.push(relative(root,path));
  }};
  walk(directory);return out.sort((a,b)=>a.localeCompare(b));
}

/** An exact source SHA is mandatory. Receipt bytes are hashed into each verdict;
 * the newest eligible observation overrides older passes, including with a fail.
 * Current frame-floor receipts have no native memory readings: they cannot supply memory.
 * @param {string} root @param {string} slug @param {string|null} revision
 * @param {readonly string[]} paths @param {{explorerMB:number,loadingMB:number}} caps
 * @returns {Partial<Record<'memory'|'oneFrameLooks',import('./shard-milestones.mjs').Criterion>>} */
export function runtimeGridEvidence(root,slug,revision,paths,caps) {
  if(revision===null||!v.is(sha,revision))return {};
  /** @type {Record<'memory'|'oneFrameLooks',Array<{at:number,path:string,criterion:import('./shard-milestones.mjs').Criterion}>>} */
  const candidates={memory:[],oneFrameLooks:[]};
  const add=(name,when,path,bytes,verdict,evidence)=>{
    const at=Date.parse(when);if(!Number.isFinite(at))return;
    candidates[name].push({at,path,criterion:{verdict,evidence:`${path} sha256:${hash(bytes)} at ${revision}: ${evidence}`}});
  };
  const measured=(when,path,bytes,playing,loading)=>add('memory',when,path,bytes,
    playing<=caps.explorerMB*1_000_000&&loading<=caps.loadingMB*1_000_000?'pass':'fail',
    `native WebContent + labelled GPU peaks playing/loading ${playing}/${loading} bytes; caps ${caps.explorerMB}/${caps.loadingMB} MB`);
  for(const path of paths) {
    const file=resolve(root,path);if(!existsSync(file)||statSync(file).size>5_000_000)continue;
    const bytes=readFileSync(file);if(!bytes.includes(revision))continue;
    let input;try{input=JSON.parse(bytes.toString('utf8'));}catch{continue;}
    const recordedSoak=v.safeParse(soak,input);
    if(recordedSoak.success&&recordedSoak.output.sha===revision&&recordedSoak.output.grade.admitted.includes(slug)) {
      const receipt=recordedSoak.output;
      if(receipt.seconds>=receipt.grade.requiredSeconds)measured(receipt.driveStarted,path,bytes,receipt.grade.peakBytes,receipt.grade.loadingPeakBytes);
    }
    const recordedMilestone=v.safeParse(milestone,input);if(!recordedMilestone.success||recordedMilestone.output.source!==revision)continue;
    for(const value of recordedMilestone.output.runs) {
      const parsed=v.safeParse(run,value);if(!parsed.success||parsed.output.sha!==revision)continue;
      const receipt=parsed.output;
      for(const scene of receipt.cases.filter(row=>row.shard==='grid'&&row.complete&&row.errors.length===0)) {
        const names=scene.routes.filter(route=>route.after.current===slug).map(route=>`grid-${route.name}`);
        const rows=scene.rows.filter(row=>names.some(name=>row.name===name||row.name===`${name}-travel`||row.name===`${name}-drive`));
        if(rows.length===0||!names.every(name=>rows.some(row=>row.name===`${name}-drive`)))continue;
        if(recordedMilestone.output.protocol.quiet!==false)add('oneFrameLooks',receipt.when,path,bytes,rows.every(row=>row.pass&&row.contextLost!==true)?'pass':'fail',
          `completed Safari grid entry and ${rows.length} plain milestone look/travel windows for ${slug}`);
        if(receipt.memory!==undefined)measured(receipt.when,path,bytes,receipt.memory.playingPeakBytes,receipt.memory.loadingPeakBytes);
      }
    }
  }
  return Object.fromEntries(Object.entries(candidates).flatMap(([name,rows])=>{
    rows.sort((a,b)=>b.at-a.at||a.path.localeCompare(b.path));return rows.slice(0,1).map(row=>[name,row.criterion]);
  }));
}
