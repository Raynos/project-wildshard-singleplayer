// G458: outcome progress and evidence-bound grid readiness, never task counts.
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {outputFormat,gridReadinessFormat} from './shard-platform-format.mjs';
import {runtimeGridEvidence} from './grid-runtime-evidence.mjs';

export const MILESTONE_SHARDS=['far-reach','sunscar-dunes','pine-hollow','driftwood-isle','nalati-grasslands','nine-dragon-stack'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
/** @param {Record<string,{verdict:'pass'|'fail'|'unknown',evidence:string}>} criteria */
export function readinessVerdict(criteria) {
  const values=Object.values(criteria);
  return values.some(row=>row.verdict==='fail')?'fail':values.length>0&&values.every(row=>row.verdict==='pass')?'pass':'unknown';
}
export function unknownGridReady(evidence='No bound output validation evidence') {
  /** @type {Record<string,import('./shard-milestones.mjs').Criterion>} */
  const criteria=Object.fromEntries(['bakedTiles','edgeProfile','fourEntryways','memory','hudAccent','oneFrameLooks'].map(name=>[name,{verdict:'unknown',evidence}]));
  return {verdict:readinessVerdict(criteria),criteria};
}
/** Only byte-bound emitted metadata and the writer's matching receipt supply
 * evidence. Missing or stale artifacts stay unknown; source declarations and
 * a successful standalone boot never stand in for grid readiness.
 * @param {string} root @param {string} slug @param {string} products
 * @param {{revision?:string|null,receipts?:readonly string[]}} options */
export function gridReady(root,slug,products,{revision=null,receipts=[]}={}) {
  const {criteria}=unknownGridReady();
  /** @type {import('./shard-milestones.mjs').GridReady['binding']} */
  let binding;
  const result=()=>({verdict:readinessVerdict(criteria),criteria,...(binding===undefined?{}:{binding})});
  const directory=resolve(products,slug),indexPath=resolve(directory,'shard.json'),receiptPath=resolve(directory,'validation.json');
  if(!existsSync(indexPath)||!existsSync(receiptPath))return result();
  try {
    const bytes=readFileSync(indexPath),index=outputFormat.parseOutputIndex(JSON.parse(bytes.toString('utf8'))),receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
    if(receipt.indexHash!==hash(bytes)||receipt.revision!==index.build.validator||receipt.sourceHash!==index.build.sourceHash)return result();
    binding={indexHash:hash(bytes),validationHash:hash(readFileSync(receiptPath)),sourceHash:index.build.sourceHash,validator:index.build.validator,revision};
    const sections=new Map();
    for(const row of index.sections) {
      const payload=readFileSync(resolve(directory,row.path));
      if(payload.length!==row.bytes||hash(payload)!==row.hash)return result();
      sections.set(row.name,JSON.parse(payload.toString('utf8')));
    }
    if(receipt.gridReady===undefined)return result();
    // The writer emits this only after actual asset admission, including the full
    // 8x15m terrain/mesh/prop/collider/water checks, not just the metadata schema.
    const source=outputFormat.assembleOutputShardfile(index,sections);
    const structural=gridReadinessFormat.parseGridStructuralEvidence(receipt.gridReady);
    if(JSON.stringify(structural)!==JSON.stringify(gridReadinessFormat.structuralGridEvidence(source)))throw new Error('Grid evidence differs from emitted sections');
    for(const [name,criterion] of Object.entries(structural.criteria))criteria[name]={...criterion,
      evidence:`index sha256:${hash(bytes)}, validation sha256:${hash(readFileSync(receiptPath))}: ${criterion.evidence}`};
    const caps=JSON.parse(readFileSync(resolve(root,'src/format/memoryGates.json'),'utf8'));
    criteria.memory={verdict:'unknown',evidence:'No qualified exact-SHA boot/soak/milestone native memory receipt; declared costs are not readings'};
    criteria.oneFrameLooks={verdict:'unknown',evidence:'No exact-SHA Safari grid look/travel witness'};
    if([caps.explorerMB,caps.loadingMB].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>0))Object.assign(criteria,runtimeGridEvidence(root,slug,revision,receipts,caps));
  } catch(error) {
    criteria.validation={verdict:'fail',evidence:`Output validation refused: ${error instanceof Error?error.message:String(error)}`};
  }
  return result();
}

/** @param {string} slug @param {{basis:'source'|'output',customLines:number,legacyLines:number|null}} input */
export function m3Progress(slug,input) {
  if(input.legacyLines===null)return null;
  const target=(slug==='far-reach'||slug==='sunscar-dunes')?0.1:0.2;
  const mustGo=input.legacyLines*(1-target),cut=Math.max(0,input.legacyLines-input.customLines);
  return {...input,target,mustGo,cut,fraction:cut/mustGo};
}
/** @param {Record<string,{m3:ReturnType<typeof m3Progress>,gridReady:{verdict:'pass'|'fail'|'unknown'}}|undefined>} rows */
export function planProgress(rows) {
  const ports=MILESTONE_SHARDS.map(slug=>rows[slug]),measured=ports.flatMap(row=>row?.m3??[]);
  const mustGo=measured.reduce((sum,row)=>sum+row.mustGo,0),cut=measured.reduce((sum,row)=>sum+row.cut,0);
  const m3=measured.length===6&&mustGo>0?cut/mustGo:null;
  const ready=ports.filter(row=>row?.gridReady.verdict==='pass').length;
  const unknown=ports.filter(row=>row===undefined||row.gridReady.verdict==='unknown').length;
  const m2={lower:ready/6,upper:(ready+unknown)/6,ready,unknown,total:6};
  return {m3:{fraction:m3,cut,mustGo,shards:measured.length},m2,
    plan:m3===null?null:{lower:.6*m3+.4*m2.lower,upper:.6*m3+.4*m2.upper}};
}
