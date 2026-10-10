import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { readMemoryReport } from '../memory-report-data.mjs';
import { parsePlan,parsePlaytest } from './markdown.mjs';
import { RECOUNT_PREFIX,newestRecount,parseRecountReadme,readRecountJson,readSharePlatform } from './progress.mjs';
import { readAdminBundle,readLoadingReport,readItemizedReport } from './validate.mjs';

const MAX_TEXT_BYTES=32_000_000;
const MAX_MEDIA_BYTES=64_000_000;
/** @param {Uint8Array} bytes */
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
/** @param {string} path */
export function safeSourcePath(path){
  if(!path||path.includes('\\')||path.includes('\0')||path.startsWith('/')||path.split('/').some(part=>part==='..'||part==='.'||part===''))throw new Error(`Unsafe report source path: ${path}`);
  return path;
}
/** Deterministic JSON bytes independent of locale, object insertion order or wall time.
 * @param {unknown} value @returns {string} */
export function stableJson(value){
  /** @param {unknown} entry @returns {unknown} */
  const sort=entry=>{
    if(Array.isArray(entry))return entry.map(sort);
    if(entry!==null&&typeof entry==='object')return Object.fromEntries(Object.entries(entry).sort(([left],[right])=>left<right?-1:left>right?1:0).map(([key,child])=>[key,sort(child)]));
    return entry;
  };
  return `${JSON.stringify(sort(value),null,2)}\n`;
}
/** `platform` runs `node scripts/shard-platform.mjs --json` on exactly this revision (never the shared working tree).
 * @typedef {{revision:string;paths:readonly string[];read:(path:string)=>Uint8Array;platform:()=>unknown}} CommittedTree */
/** Read only an explicit immutable tree. Report captures, scripts and unrelated diagnostics are never glob-imported.
 * @param {CommittedTree} tree @returns {{bundle:import('./types.mjs').AdminBundle;files:Map<string,Uint8Array>}} */
export function collectAdminData(tree){
  if(!/^[a-f\d]{40}$/u.test(tree.revision))throw new Error('Admin bundle requires a full committed revision');
  const paths=[...new Set(tree.paths)].sort();
  paths.forEach(path=>{safeSourcePath(path);});
  const files=new Map();let totalMedia=0;
  /** @param {string} path @param {number} limit */
  const read=(path,limit)=>{
    if(!paths.includes(path))throw new Error(`Missing committed report: ${path}`);
    const bytes=tree.read(path);if(bytes.byteLength>limit)throw new Error(`Report source too large: ${path}`);
    return bytes;
  };
  /** @param {string} path @param {Uint8Array} bytes @returns {import('./types.mjs').Source} */
  const source=(path,bytes)=>({path,sha256:digest(bytes),bytes:bytes.byteLength});
  /** @param {string} path */
  const text=path=>{const bytes=read(path,MAX_TEXT_BYTES);return {source:source(path,bytes),text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};};
  /** @type {import('./types.mjs').MemoryEntry[]} */
  const memory=[];
  /** @type {import('./types.mjs').Media[]} */
  const media=[];
  /** @param {string} path */
  const addMedia=path=>{
    const extension=posix.extname(path).toLowerCase();
    const bytes=read(path,MAX_MEDIA_BYTES),row=source(path,bytes),url=`media/${row.sha256}${extension}`;
    if(!files.has(url)){totalMedia+=bytes.byteLength;if(totalMedia>512_000_000)throw new Error('Admin media exceeds 512 MB');files.set(url,bytes);}
    media.push({...row,url,kind:extension==='.mp4'||extension==='.webm'?'video':'image'});
  };
  const isMedia=/** @param {string} path */path=>/\.(?:jpe?g|png|webp|svg|mp4|webm)$/iu.test(path);
  for(const path of paths){
    if(!path.startsWith('progress/memory/'))continue;
    if(path.endsWith('/itemized.json')){
      const raw=text(path),data=readItemizedReport(JSON.parse(raw.text));
      // The complete legacy object is kept: confidence M/E/U and overlapping vmmap regions are not reinterpreted.
      memory.push({id:path,source:raw.source,pins:[],format:'itemized',data});
    }else if(path.endsWith('/report.json')){
      const raw=text(path),data=/** @type {unknown} */(JSON.parse(raw.text));
      const schema=data!==null&&typeof data==='object'?Reflect.get(data,'schema'):undefined;
      if(typeof schema==='string'&&schema.startsWith('memory-report/')&&schema!=='memory-report/1')throw new Error(`Unsupported memory report schema: ${path}`);
      if(path.startsWith('progress/memory/sf64-report/')&&schema!=='memory-report/1')throw new Error(`Invalid SF64 report: ${path}`);
      if(schema==='memory-report/1'){
        const report=readMemoryReport(data);
        memory.push({id:path,source:raw.source,pins:[report.pin,...report.poses.flatMap(pose=>typeof pose.evidence?.pin==='string'?[pose.evidence.pin]:[])],format:'sf64',data:report});
      }
    }
  }
  for(const entry of memory){
    entry.pins=[...new Set(entry.format==='itemized'?entry.data.situations.map(pose=>pose.pin):entry.pins)].sort();
    const directory=`${posix.dirname(entry.source.path)}/`;
    for(const path of paths)if(path.startsWith(directory)&&isMedia(path)&&!media.some(row=>row.path===path))addMedia(path);
  }
  const loadingReports=paths.filter(path=>/^progress\/loading\/sf67\/(?:[^/]+\/)*report\.json$/u.test(path)).map(path=>{
    const raw=text(path);return {source:raw.source,data:readLoadingReport(JSON.parse(raw.text))};
  });
  const playtests=paths.filter(path=>/^art\/playtest\/round-[^/]+\/README\.md$/u.test(path)).map(path=>{
    const directory=`${posix.dirname(path)}/`,own=[];
    for(const asset of paths)if(asset.startsWith(directory)&&isMedia(asset)){addMedia(asset);own.push(media.at(-1));}
    const raw=text(path);return parsePlaytest(raw.text,raw.source,own.filter(row=>row!==undefined));
  });
  // Progress: the share measured on this revision, and the newest committed effort recount with its chart. Both required.
  const share=readSharePlatform(tree.platform());
  const folder=newestRecount(paths),chart=`${folder}/share-vs-hours.jpg`;
  const recountJson=`${folder}/effort.json`,recountReadme=`${folder}/README.md`;
  /** @type {import('./types.mjs').EffortRecount} */
  let effort;
  if(paths.includes(recountJson)){
    const raw=text(recountJson),data=readRecountJson(JSON.parse(raw.text),recountJson);
    effort={folder,date:data.asOf.slice(0,10),asOf:data.asOf,confidence:data.confidence,format:'json',source:raw.source,chart,shards:data.shards,totals:data.totals,finish:data.finish};
  }else{
    if(!paths.includes(recountReadme))throw new Error(`Missing committed effort recount: ${recountReadme} (or effort.json)`);
    const raw=text(recountReadme),data=parseRecountReadme(raw.text,recountReadme),date=folder.slice(RECOUNT_PREFIX.length,RECOUNT_PREFIX.length+10);
    effort={folder,date,asOf:date,confidence:data.confidence,format:'readme',source:raw.source,chart,shards:data.shards,totals:data.totals,finish:[]};
  }
  if(!paths.includes(chart))throw new Error(`Missing committed effort chart: ${chart}`);
  if(!media.some(row=>row.path===chart))addMedia(chart);
  const rawPlan=text('docs/plans/SHARD-PLATFORM.md');
  const bundle=readAdminBundle({schema:'wildshard-admin/1',revision:tree.revision,memory,loading:{status:loadingReports.length > 0?'available':'unavailable',reports:loadingReports,missing:loadingReports.length > 0?[]:['No committed SF67 loading-benchmark/1 report at progress/loading/sf67/**/report.json']},playtests,plan:parsePlan(rawPlan.text,rawPlan.source),progress:{share,effort},media:media.sort((left,right)=>left.path<right.path?-1:left.path>right.path?1:0)});
  return {bundle,files};
}
