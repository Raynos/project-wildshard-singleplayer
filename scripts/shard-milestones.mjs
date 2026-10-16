// G458: outcome progress and evidence-bound grid readiness, never task counts.
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {outputFormat} from './shard-platform-format.mjs';

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
 * @param {string} root @param {string} slug @param {string} products */
export function gridReady(root,slug,products) {
  const {criteria}=unknownGridReady();
  const result=()=>({verdict:readinessVerdict(criteria),criteria});
  const directory=resolve(products,slug),indexPath=resolve(directory,'shard.json'),receiptPath=resolve(directory,'validation.json');
  if(!existsSync(indexPath)||!existsSync(receiptPath))return result();
  try {
    const bytes=readFileSync(indexPath),index=outputFormat.parseOutputIndex(JSON.parse(bytes.toString('utf8'))),receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
    if(receipt.indexHash!==hash(bytes)||receipt.revision!==index.build.validator||receipt.sourceHash!==index.build.sourceHash)return result();
    const sections=new Map();
    for(const row of index.sections) {
      const payload=readFileSync(resolve(directory,row.path));
      if(payload.length!==row.bytes||hash(payload)!==row.hash)return result();
      sections.set(row.name,JSON.parse(payload.toString('utf8')));
    }
    // The defining validator checks the four 8m midpoint entries at y=0,
    // their edge openings and the accent palette, not a private approximation.
    const source=outputFormat.assembleOutputShardfile(index,sections);
    criteria.bakedTiles={verdict:source.tiles.some(row=>row.lod===0)?'pass':'fail',evidence:`${source.tiles.length} admitted render tiles`};
    criteria.edgeProfile={verdict:'pass',evidence:'Defining edge schema and semantic validation pass'};
    criteria.fourEntryways={verdict:'pass',evidence:'Defining entryway schema: four unique 8m midpoint entries and road-height openings'};
    criteria.hudAccent={verdict:'pass',evidence:`Validated accent ${source.accent}`};
    const caps=JSON.parse(readFileSync(resolve(root,'src/format/memoryGates.json'),'utf8'));
    const playing=receipt.worst?.playing,loading=receipt.worst?.loading;
    if([playing,loading,caps.explorerMB,caps.loadingMB].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0))criteria.memory={
      verdict:playing<=caps.explorerMB*1_000_000&&loading<=caps.loadingMB*1_000_000?'pass':'fail',
      evidence:`Validated model ${playing}/${loading} bytes; playing/loading caps ${caps.explorerMB}/${caps.loadingMB} MB`};
    criteria.oneFrameLooks={verdict:'unknown',evidence:'No exact-output one-frame look witness in the build receipt'};
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
