import { readFileSync } from 'node:fs';
import { readMemoryReport } from '../memory-report-data.mjs';

/** @typedef {{type?:string;const?:unknown;enum?:unknown[];minimum?:number;maximum?:number;exclusiveMinimum?:number;pattern?:string;properties?:Record<string,Schema>;required?:string[];additionalProperties?:boolean;items?:Schema;anyOf?:Schema[];oneOf?:Schema[]}} Schema */
/** @type {Schema} */
const bundleSchema=JSON.parse(readFileSync(new URL('schema.json',import.meta.url),'utf8'));
/** @type {Schema} */
const loadingSchema=JSON.parse(readFileSync(new URL('loading.schema.json',import.meta.url),'utf8'));

/** A deliberately small validator for exactly the keywords used by the checked-in schemas.
 * External consumers may use a draft-2020-12 validator on the same JSON files.
 * @param {unknown} value @param {Schema} schema @param {string} path @returns {void} */
function validate(value,schema,path){
  /** @type {()=>never} */
  const fail=()=>{throw new TypeError(`Invalid admin data at ${path}`);};
  if(schema.anyOf||schema.oneOf){
    let matches=0;
    for(const option of schema.anyOf??schema.oneOf??[]){try{validate(value,option,path);matches++;}catch(error){if(!(error instanceof TypeError))throw error;}}
    if(schema.oneOf?matches!==1:matches===0)fail();
  }
  if('const' in schema && value!==schema.const)fail();
  if(schema.enum&&!schema.enum.includes(value))fail();
  switch(schema.type){
    case 'null':if(value!==null)fail();break;
    case 'boolean':if(typeof value!=='boolean')fail();break;
    case 'string':
      if(typeof value!=='string'||(schema.pattern&&!new RegExp(schema.pattern,'u').test(value)))fail();break;
    case 'number':case 'integer':
      if(typeof value!=='number'||!Number.isFinite(value)||(schema.type==='integer'&&!Number.isSafeInteger(value))||(schema.minimum!==undefined&&value<schema.minimum)||(schema.maximum!==undefined&&value>schema.maximum)||(schema.exclusiveMinimum!==undefined&&value<=schema.exclusiveMinimum))fail();break;
    case 'array':
      if(!Array.isArray(value))fail();
      if(schema.items){const items=schema.items;value.forEach((entry,index)=>validate(entry,items,`${path}[${index}]`));}break;
    case 'object':{
      if(value===null||typeof value!=='object'||Array.isArray(value))fail();
      const object=/** @type {Record<string,unknown>} */(value);
      for(const key of schema.required??[])if(!Object.hasOwn(object,key))throw new TypeError(`Missing admin data at ${path}.${key}`);
      for(const [key,entry]of Object.entries(object)){
        const property=schema.properties?.[key];
        if(property)validate(entry,property,`${path}.${key}`);else if(schema.additionalProperties===false)throw new TypeError(`Unknown admin field ${path}.${key}`);
      }
      break;
    }
    case undefined:break;
    default:break;
  }
}
/** @param {unknown} value @returns {import('./types.mjs').LoadingReport} */
export function readLoadingReport(value){
  validate(value,loadingSchema,'loading');
  const report=/** @type {import('./types.mjs').LoadingReport} */(value);
  if(!report.pin.trim()||!report.device.trim())throw new Error('Loading report requires build and device');
  if(report.runs.length === 0&&report.missing.length === 0)throw new Error('Empty loading report must state what is missing');
  for(const run of report.runs)for(const phase of run.phases)if(phase.endMs<phase.startMs)throw new Error('Loading phase ends before it starts');
  return report;
}
/** @param {unknown} value @returns {import('./types.mjs').ItemizedReport} */
export function readItemizedReport(value){
  const schema=bundleSchema.properties?.memory.items?.oneOf?.at(1)?.properties?.data;
  if(!schema)throw new Error('Missing itemized report schema');
  validate(value,schema,'itemized');
  const report=/** @type {import('./types.mjs').ItemizedReport} */(value);
  for(const pose of report.situations){
    if(!pose.pin.trim()||!pose.build.trim())throw new Error('Itemized memory pose requires build provenance');
    if(Math.abs(pose.wcBytes+pose.glBytes-pose.totalBytes)>1)throw new Error('Itemized memory ruler must equal WC + GL');
  }
  return report;
}
/** @param {unknown} value @returns {import('./types.mjs').AdminBundle} */
export function readAdminBundle(value){
  validate(value,bundleSchema,'bundle');
  const bundle=/** @type {import('./types.mjs').AdminBundle} */(value);
  for(const entry of bundle.memory){
    if(entry.format==='sf64')readMemoryReport(entry.data);
    else readItemizedReport(entry.data);
  }
  for(const report of bundle.loading.reports)readLoadingReport(report.data);
  if((bundle.loading.status==='available')!==(bundle.loading.reports.length>0))throw new Error('Loading availability disagrees with reports');
  if(bundle.loading.status==='unavailable'&&bundle.loading.missing.length === 0)throw new Error('Missing loading evidence requires a reason');
  const paths=new Set(bundle.media.map(row=>row.path));
  if(paths.size!==bundle.media.length)throw new Error('Duplicate media path');
  if(!paths.has(bundle.progress.effort.chart))throw new Error(`Unknown effort chart ${bundle.progress.effort.chart}`);
  if(bundle.progress.share.shards.length===0)throw new Error('Progress requires the share script rows');
  for(const report of bundle.playtests){
    if(report.builds.length === 0&&report.missing.length === 0)throw new Error('Playtest requires build provenance or a missing reason');
    const ranks=new Set(report.findings.map(row=>row.rank));
    if(ranks.size!==report.findings.length)throw new Error('Duplicate playtest rank');
    for(const path of [...report.media,...report.findings.flatMap(row=>row.media)])if(!paths.has(path))throw new Error(`Unknown playtest media ${path}`);
  }
  return bundle;
}
