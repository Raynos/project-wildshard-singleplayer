/** Plan progress for the admin card: the share script's measured rows and the newest measured effort recount.
 * Both are required inputs: a missing script, a missing recount or an unreadable one fails the build (no fallback). */
import { markdownTables } from './markdown.mjs';

export const SHARE_COMMAND='node scripts/shard-platform.mjs --json';
export const SHARE_TARGET=0.8;
export const RECOUNT_PREFIX='progress/shard-platform/effort-recount-';
const PROOFS=/** @type {const} */(['headless']);

/** @param {unknown} value @returns {value is Record<string,unknown>} */
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
/** @param {unknown} value @param {string} where @returns {number} */
function count(value,where){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error(`Share script output: ${where} is not a nonnegative number`);
  return value;
}
/** @param {unknown} value @param {string} where @returns {boolean} */
function flag(value,where){
  if(typeof value!=='boolean')throw new Error(`Share script output: ${where} is not a boolean`);
  return value;
}

/** Validate G291's additive measure; unavailable never becomes zero.
 * @param {unknown} value @param {string} slug @returns {import('../shard-platform.mjs').ConversionMeasure} */
function conversion(value,slug){
  if(!isObject(value)||!['runtime-vs-legacy','native'].includes(String(value.metric)))throw new Error(`Share script output: ${slug}.conversion is invalid`);
  const metric=value.metric==='runtime-vs-legacy'?'runtime-vs-legacy':'native';
  const customRuntimeLines=count(value.customRuntimeLines,`${slug}.customRuntimeLines`);
  const rawGlslLines=count(value.rawGlslLines,`${slug}.rawGlslLines`),additionalGlslLines=count(value.additionalGlslLines,`${slug}.additionalGlslLines`);
  if(additionalGlslLines>rawGlslLines)throw new Error(`Share script output: ${slug} has inconsistent GLSL lines`);
  const shardRuntimeLines=count(value.shardRuntimeLines,`${slug}.shardRuntimeLines`),attribution=value.gameSystemAttribution;
  if(!isObject(attribution)||attribution.status!=='import-graph'||attribution.review!=='G294-primary-reach'||!Array.isArray(attribution.modules))throw new Error(`Share script output: ${slug} requires explicit game-system attribution`);
  const modules=attribution.modules.map(module=>{
    if(!isObject(module)||typeof module.path!=='string'||!/^src\/(?:engine|game|sdk)\//u.test(module.path))throw new Error(`Share script output: ${slug} has invalid attributed module`);
    return {path:module.path,lines:count(module.lines,`${slug}.${module.path}`)};
  });
  // G294 per export: one-shard declarations inside files two or more shards reach (absent before sp-o53, read as none).
  if(attribution.exports!==undefined&&!Array.isArray(attribution.exports))throw new Error(`Share script output: ${slug} has invalid attributed exports`);
  const exports=(attribution.exports??[]).map(entry=>{
    if(!isObject(entry)||typeof entry.path!=='string'||!/^src\/(?:engine|game|sdk)\//u.test(entry.path)||typeof entry.name!=='string'||typeof entry.exported!=='boolean')throw new Error(`Share script output: ${slug} has invalid attributed export`);
    return {path:entry.path,name:entry.name,exported:entry.exported,lines:count(entry.lines,`${slug}.${entry.path}#${entry.name}`)};
  });
  const lines=count(attribution.lines,`${slug}.gameSystemAttribution.lines`);
  if(new Set(modules.map(module=>module.path)).size!==modules.length||lines!==[...modules,...exports].reduce((total,module)=>total+module.lines,0)||customRuntimeLines!==shardRuntimeLines+additionalGlslLines+lines)throw new Error(`Share script output: ${slug} has inconsistent attributed lines`);
  const gameSystemAttribution={status:/** @type {const} */('import-graph'),review:/** @type {const} */('G294-primary-reach'),lines,modules,exports};
  if(metric==='native'){
    if([value.legacyLines,value.legacyFolder,value.legacyRevision,value.runtimeShare,value.passed].some(field=>field!==null))throw new Error(`Share script output: ${slug} without legacy must be explicitly unavailable`);
    return {metric,customRuntimeLines,shardRuntimeLines,rawGlslLines,additionalGlslLines,legacyLines:null,legacyFolder:null,legacyRevision:null,runtimeShare:null,passed:null,gameSystemAttribution};
  }
  const legacyLines=count(value.legacyLines,`${slug}.legacyLines`),runtimeShare=count(value.runtimeShare,`${slug}.runtimeShare`);
  if(legacyLines===0||value.legacyFolder!==`${slug}-legacy`||typeof value.legacyRevision!=='string'||!/^[a-f0-9]{40}$/u.test(value.legacyRevision)
    ||runtimeShare!==customRuntimeLines/legacyLines||value.passed!==(customRuntimeLines<=legacyLines*0.2))throw new Error(`Share script output: ${slug} has inconsistent G291 numbers`);
  return {metric,customRuntimeLines,shardRuntimeLines,rawGlslLines,additionalGlslLines,legacyLines,legacyFolder:value.legacyFolder,legacyRevision:value.legacyRevision,runtimeShare,passed:flag(value.passed,`${slug}.conversion.passed`),gameSystemAttribution};
}

/** `node scripts/shard-platform.mjs --json` → its rows, verbatim, with headless availability.
 * @param {unknown} value @returns {import('./types.mjs').ShareReport} */
export function readSharePlatform(value){
  if(!isObject(value))throw new Error(`Share script output is not an object (${SHARE_COMMAND})`);
  const shards=Object.entries(value).filter(([slug])=>slug!=='_summary').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([slug,row])=>{
    if(!isObject(row))throw new Error(`Share script output: ${slug} is not an object`);
    const milestones=row.milestones;
    if(!isObject(milestones))throw new Error(`Share script output: ${slug}.milestones is missing`);
    const proofs={headless:flag(milestones.headless,`${slug}.headless`)};
    /** @type {import('./types.mjs').ShardShare} */
    const measured={slug,runtimeLines:count(row.runtimeLines,`${slug}.runtimeLines`),trustedRuntimeLines:count(row.trustedRuntimeLines,`${slug}.trustedRuntimeLines`),
      baseline:count(row.baseline,`${slug}.baseline`),ceiling:count(row.ceiling,`${slug}.ceiling`),enforced:flag(row.enforced,`${slug}.enforced`),proofs,
      proofsPassing:PROOFS.filter(name=>proofs[name]).length};
    if(row.conversion!==undefined)measured.conversion=conversion(row.conversion,slug);
    if(row.port!==undefined){
      if(!isObject(row.port)||!['yes','partial','no','unavailable'].includes(String(row.port.world)))throw new Error(`Share script output: ${slug}.port invalid`);
      const customPercent=row.port.customPercent===null?null:count(row.port.customPercent,`${slug}.customPercent`);
      const world=/** @type {import('../shard-platform.mjs').PortHeadline['world']} */(row.port.world);
      const expected=world==='unavailable'||customPercent===null?null:80*Math.max(0,Math.min(1,(100-customPercent)/80))+(world==='yes'?20:world==='partial'?10:0);
      if(row.port.percent!==expected)throw new Error(`Share script output: ${slug}.port formula drift`);
      measured.port={customPercent,world,percent:expected};
    }
    if(row.generators!==undefined){
      if(!isObject(row.generators)||!isObject(row.generators.explorers))throw new Error(`Share script output: ${slug}.generators invalid`);
      const integer=(field)=>{const n=count(row.generators[field],`${slug}.generators.${field}`);if(!Number.isSafeInteger(n))throw new Error('Invalid inventory count');return n;};
      const explorers={Model:count(row.generators.explorers.Model,'Model'),Set:count(row.generators.explorers.Set,'Set'),World:count(row.generators.explorers.World,'World')};
      measured.generators={shard:slug,ported:integer('ported'),left:integer('left'),portedLines:integer('portedLines'),leftLines:integer('leftLines'),explorers};
      if(measured.generators.ported+measured.generators.left!==explorers.Model+explorers.Set+explorers.World)throw new Error(`Share script output: ${slug}.generators inconsistent`);
    }
    return measured;
  });
  if(shards.length===0)throw new Error(`Share script output lists no shards (${SHARE_COMMAND})`);
  const report={command:SHARE_COMMAND,target:SHARE_TARGET,shards};
  if(value._summary!==undefined){
    const summary=value._summary;
    if(!isObject(summary)||!Array.isArray(summary.shards)||summary.shards.length!==6||new Set(summary.shards).size!==6)throw new Error('Invalid PORT summary');
    const ports=summary.shards.map(slug=>{const row=shards.find(shard=>shard.slug===slug);if(row?.port===undefined)throw new Error('Missing PORT summary shard');return row.port.percent;});
    const expected=ports.some(port=>port===null)?null:ports.reduce((sum,port)=>sum+(port??0),0)/ports.length;
    if(summary.portAverage!==expected)throw new Error('PORT average drift');
    return {...report,portAverage:expected};
  }
  return report;
}

/** The newest recount folder among committed paths (folder names start with an ISO date, so they sort by date).
 * @param {readonly string[]} paths @returns {string} */
export function newestRecount(paths){
  const folders=[...new Set(paths.filter(path=>path.startsWith(RECOUNT_PREFIX)&&path.includes('/',RECOUNT_PREFIX.length))
    .map(path=>path.slice(0,path.indexOf('/',RECOUNT_PREFIX.length))))]
    .filter(folder=>/^\d{4}-\d{2}-\d{2}/u.test(folder.slice(RECOUNT_PREFIX.length))).sort();
  const folder=folders.at(-1);
  if(!folder)throw new Error(`Missing committed effort recount: ${RECOUNT_PREFIX}*/ (effort.json or README.md, and share-vs-hours.jpg)`);
  return folder;
}

/** "57" / "~28" / "57.6 (0.3)" / "≈ 1,050" / "100 %" → number; "—" / "" → null.
 * @param {string} cell @returns {{value:number|null;approximate:boolean}} */
function hours(cell){
  const text=cell.replaceAll('*','').trim();
  if(/^(?:—|-|–|n\/a)?$/iu.test(text))return {value:null,approximate:false};
  const match=/^(~|≈|about\s+)?\s*(\d[\d,]*(?:\.\d+)?)/iu.exec(text);
  if(!match)throw new Error(`Effort recount: cannot read the number in "${cell}"`);
  return {value:Number(match[2].replaceAll(',','')),approximate:Boolean(match[1])};
}
/** @param {number} spent @param {number|null} remaining @returns {number} */
const percentOf=(spent,remaining)=>remaining===null?Number.NaN:spent+remaining===0?100:Math.round(spent/(spent+remaining)*1000)/10;
/** @param {number} value @param {string} where */
function percent(value,where){
  if(!Number.isFinite(value)||value<0||value>100)throw new Error(`Effort recount: ${where} has no effort % in 0..100`);
  return value;
}
const TOTAL=/^(M[123]|Part A|Overall|Total)$/u;

/** The recount's README, for a recount that ships no effort.json: its per-shard table (agent-hours spent / left / effort
 * % done; a bold M3 / Part A row is a total), its confidence sentence, and its **Overall:** / **M3:** / **Part A:** lines
 * ("about N agent-hours spent and about M left, so P % done"). Nothing is estimated; a missing table, confidence or total
 * fails.
 * @param {string} markdown @param {string} path @returns {{confidence:string;shards:import('./types.mjs').EffortShard[];totals:import('./types.mjs').EffortTotal[]}} */
export function parseRecountReadme(markdown,path){
  const table=markdownTables(markdown).find(row=>row.headers.some(cell=>/spent/iu.test(cell))&&row.headers.some(cell=>/remain|left/iu.test(cell)));
  if(!table)throw new Error(`Effort recount ${path} has no table with agent-hours spent and remaining`);
  const column=/** @param {RegExp} test */test=>table.headers.findIndex(cell=>test.test(cell));
  const spentAt=column(/spent/iu),leftAt=column(/remain|left/iu),effortAt=column(/effort/iu);
  /** @type {import('./types.mjs').EffortShard[]} */
  const shards=[];
  /** @type {import('./types.mjs').EffortTotal[]} */
  const totals=[];
  for(const row of table.rows){
    const name=(row.cells[0]??'').replaceAll('*','').trim();
    const spent=hours(row.cells[spentAt]??''),left=hours(row.cells[leftAt]??'');
    if(!name||spent.value===null)throw new Error(`Effort recount ${path}:${row.line} has no shard or hours spent`);
    const written=effortAt===-1?null:hours(row.cells[effortAt]??'').value;
    const effortPercent=percent(written??percentOf(spent.value,left.value),`${path}:${row.line}`);
    if(TOTAL.test(name))totals.push({label:name,spentHours:spent.value,remainingHours:left.value,remainingRange:null,effortPercent});
    else shards.push({slug:null,name,spentHours:spent.value,remainingHours:left.value,approximate:left.approximate,effortPercent,line:row.line});
  }
  if(shards.length===0)throw new Error(`Effort recount ${path} has an empty table`);
  const confidence=/\bconfidence(?:\*\*)?\s*(?:is|:)\s*(?:\*\*)?\s*([^.:;(]+)/iu.exec(markdown)?.[1]?.replaceAll('*','').replaceAll(/\s+/gu,' ').trim();
  if(!confidence)throw new Error(`Effort recount ${path} states no confidence ("Confidence is …")`);
  // The README's title names what it recounts ("M3 effort recount"); its **Overall:** line is that milestone's figure.
  const title=/^#\s+(.+)$/mu.exec(markdown)?.[1]??'';
  const own=/\bM3\b/u.test(title)?'M3':/\bPart A\b/u.test(title)?'Part A':'Overall';
  for(const paragraph of markdown.split(/\n\s*\n/u)){
    const head=/^\s*\*\*(Overall|M3|Part A):?\*\*:?/u.exec(paragraph);
    if(!head)continue;
    const text=paragraph.replaceAll('*','').replaceAll('\n',' ');
    const spent=/(\d[\d,]*(?:\.\d+)?)\s*agent-hours\s+spent/iu.exec(text)?.[1];
    const left=/(\d[\d,]*(?:\.\d+)?)\s*(?:agent-hours\s+)?(?:left|remaining)\b/iu.exec(text)?.[1];
    const done=/(\d+(?:\.\d+)?)\s*%\s*(?:done|by effort)/iu.exec(text)?.[1];
    if(spent===undefined||left===undefined||done===undefined)continue;
    const label=head[1]==='Overall'?own:head[1];
    const row={label,spentHours:Number(spent.replaceAll(',','')),remainingHours:Number(left.replaceAll(',','')),remainingRange:null,effortPercent:percent(Number(done),`${path} ${label}`)};
    const same=totals.findIndex(total=>total.label===label);
    if(same===-1)totals.push(row);else totals[same]=row;
  }
  if(totals.length===0)throw new Error(`Effort recount ${path} has no total (a bold M3 / Part A row, or an **Overall:** line with hours spent, left and % done)`);
  return {confidence,shards,totals:totals.sort((a,b)=>a.label<b.label?-1:a.label>b.label?1:0)};
}

/** @param {Record<string,unknown>} object @param {string} key @param {string} where @returns {number|null} */
function optionalNumber(object,key,where){
  const raw=object[key];
  if(raw===undefined||raw===null)return null;
  if(typeof raw!=='number'||!Number.isFinite(raw)||raw<0)throw new Error(`Effort recount ${where}.${key} is not a nonnegative number`);
  return raw;
}

/** effort.json as the recount writes it: {date, shards:[{slug, name, hoursSpent, hoursRemaining, effortPct, …}],
 * overall:{m3HoursSpent, m3HoursRemaining, m3HoursRemainingRange, m3EffortPct, partAHoursSpent, partAHoursRemaining,
 * partAEffortPct, confidence, finishRange:{<pace>:{from, to, central}}, …}}. Fields it doesn't use are ignored; a missing
 * date, shard hours, M3 effort or confidence fails.
 * @param {unknown} value @param {string} path
 * @returns {{asOf:string;confidence:string;shards:import('./types.mjs').EffortShard[];totals:import('./types.mjs').EffortTotal[];finish:import('./types.mjs').EffortFinish[]}} */
export function readRecountJson(value,path){
  if(!isObject(value))throw new Error(`Effort recount ${path} is not an object`);
  const {date,shards,overall}=value;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}/u.test(date)||!Array.isArray(shards)||!isObject(overall))
    throw new Error(`Effort recount ${path} needs date, shards[] and overall{}`);
  const confidence=typeof overall.confidence==='string'?overall.confidence:value.confidence;
  if(typeof confidence!=='string'||!confidence.trim())throw new Error(`Effort recount ${path} states no confidence`);
  const rows=shards.map((entry,index)=>{
    const where=`${path} shards[${index}]`;
    if(!isObject(entry))throw new Error(`Effort recount ${where} is not an object`);
    const name=entry.name,slug=entry.slug;
    const spent=optionalNumber(entry,'hoursSpent',where),remaining=optionalNumber(entry,'hoursRemaining',where);
    if(typeof name!=='string'||!name||spent===null)throw new Error(`Effort recount ${where} needs name and hoursSpent`);
    if(slug!==undefined&&typeof slug!=='string')throw new Error(`Effort recount ${where}.slug is not a string`);
    return {slug:slug??null,name,spentHours:spent,remainingHours:remaining,approximate:remaining!==null&&remaining>0,
      effortPercent:percent(optionalNumber(entry,'effortPct',where)??percentOf(spent,remaining),where),line:0};
  });
  if(rows.length===0)throw new Error(`Effort recount ${path} lists no shards`);
  /** @param {string} prefix @param {string} label @returns {import('./types.mjs').EffortTotal|null} */
  const total=(prefix,label)=>{
    const where=`${path} overall`;
    const effort=optionalNumber(overall,`${prefix}EffortPct`,where);
    if(effort===null)return null;
    const range=overall[`${prefix}HoursRemainingRange`];
    const remainingRange=Array.isArray(range)&&range.length===2&&range.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)?range.map(Number):null;
    return {label,spentHours:optionalNumber(overall,`${prefix}HoursSpent`,where),remainingHours:optionalNumber(overall,`${prefix}HoursRemaining`,where),
      remainingRange,effortPercent:percent(effort,`${where}.${prefix}EffortPct`)};
  };
  const m3=total('m3','M3'),partA=total('partA','Part A');
  if(!m3)throw new Error(`Effort recount ${path} has no overall.m3EffortPct`);
  /** @type {import('./types.mjs').EffortFinish[]} */
  const finish=[];
  const ranges=overall.finishRange;
  if(isObject(ranges))for(const [label,range]of Object.entries(ranges)){
    if(!isObject(range))continue;
    const {central,from,to}=range;
    if(typeof central==='string'&&typeof from==='string'&&typeof to==='string')finish.push({label,central,from,to});
  }
  return {asOf:date,confidence:confidence.trim(),shards:rows,totals:partA?[m3,partA]:[m3],finish};
}
