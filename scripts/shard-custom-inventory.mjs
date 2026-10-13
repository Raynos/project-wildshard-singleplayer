// G396: a source inventory of the canonical G294 measure, never another classifier.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { shardLines } from './shard-platform.mjs';

/** The same source spans that produced the ratio must add up exactly.
 * @param {string} root @param {string} slug @param {import('./shard-platform.mjs').ShardLines} measure
 * @returns {import('./shard-custom-inventory.mjs').CustomInventory} */
export function customInventory(root, slug, measure) {
  if (!/^[a-z0-9_-]+$/u.test(slug) || measure.customSources === undefined) throw new Error('Missing canonical source inventory');
  const rows = measure.customSources.map(row => {
    const source = readFileSync(resolve(root, row.path), 'utf8');
    const local = row.path.replace(`src/shards/${slug}/`, '');
    const group = row.kind.startsWith('sole-') ? 'Sole-user platform (G294)' : row.kind === 'additional-glsl' ? 'Additional raw GLSL'
      : /^runtime\/(?:index|headless)\.ts$/u.test(local) ? 'Installers' : local.includes('/') ? local.split('/')[0] : 'Shard declarations';
    return {...row, group, bytes:Buffer.byteLength(source), longestLine:Math.max(...source.split('\n').map(line=>line.length))};
  }).sort((a,b)=>a.group.localeCompare(b.group)||a.path.localeCompare(b.path)||(a.name??'').localeCompare(b.name??''));
  const parts = [...new Set(rows.map(row=>row.group))].map(name=>({name,lines:rows.filter(row=>row.group===name).reduce((sum,row)=>sum+row.lines,0)}));
  const sum = parts.reduce((total,part)=>total+part.lines,0);
  if (sum !== measure.conversion.customRuntimeLines) throw new Error('Canonical custom inventory does not reconcile');
  return {shard:slug,measured:measure.conversion,parts,files:rows};
}

/** Explicit revision/date labels bind a reproducible inventory; it never runs as a commit producer.
 * @param {string} root @param {readonly string[]} slugs @param {string} date @param {string} revision */
export function writeCustomInventories(root,slugs,date,revision) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)||!/^[a-f0-9]{40}$/u.test(revision)) throw new Error('Explicit date and full source revision required');
  const measures=shardLines(root,true),reports=[];
  for(const slug of slugs){
    if(!Object.hasOwn(measures,slug))throw new Error(`Unknown shard ${slug}`);const measure=measures[slug];
    const report={date,revision,...customInventory(root,slug,measure)};
    const folder=resolve(root,'progress/shard-platform',`${slug}-custom-${date}`);mkdirSync(folder,{recursive:true});
    writeFileSync(resolve(folder,'data.json'),`${JSON.stringify(report,null,2)}\n`);
    const m=report.measured,pct=m.runtimeShare===null?'unavailable':`${(100*m.runtimeShare).toFixed(1)} %`;
    const clean=value=>String(value).replaceAll('|',String.raw`\|`);
    const lines=[`# ${slug}: remaining custom code`,'',`Measured from source revision \`${revision}\` on ${date}.`,
      'Produced by `scripts/shard-custom-inventory.mjs`, using the exact source spans','from G294/G390. No builder, renderer or gameplay owner executes to make this report.','',
      '| Measure | Lines |','|---|---:|',`| Shard runtime TS | ${m.shardRuntimeLines} |`,`| Additional raw GLSL | ${m.additionalGlslLines} |`,
      `| Sole-user platform | ${m.gameSystemAttribution.lines} |`,`| **Custom total** | **${m.customRuntimeLines}** |`,`| Frozen legacy | ${m.legacyLines??'unavailable'} |`,
      `| Custom / legacy | ${pct} |`,`| 20 % bar | ${m.legacyLines===null?'unavailable':Math.floor(m.legacyLines*.2)} |`,'',
      '## Parts','','| Part | Lines |','|---|---:|',...report.parts.map(part=>`| ${clean(part.name)} | ${part.lines} |`),'',
      '## Source checklist','','| Source | Contribution | Lines | File bytes | Longest line |','|---|---|---:|---:|---:|',
      ...report.files.map(row=>`| ${clean(row.path)}${row.name?`#${clean(row.name)}`:''} | ${row.kind} | ${row.lines} | ${row.bytes} | ${row.longestLine} |`),'',
      'Runtime TS includes its embedded shaders once; only excluded data/generator GLSL','is added separately. A sole-user platform export counts only its measured span,','while bytes and longest line describe the containing source. Pure config entries,','declared generated outputs, comments and frozen copies follow the canonical rules.','',
      'Rows and shared owners can retire glue, quest wiring and creature scheduling.','Raw shader looks and geometry adoption belong to Opus; a moved function is not a cut.','Gameplay traces and refusal contracts remain exact unless a re-record is approved.',''];
    writeFileSync(resolve(folder,'README.md'),lines.join('\n'));reports.push(report);
  }
  return reports;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const options=new Map(process.argv.slice(2).map(arg=>{const at=arg.indexOf('=');if(at===-1)throw new Error('Use --shards= --date= --revision=');return [arg.slice(0,at),arg.slice(at+1)];}));
  const start=performance.now();const reports=writeCustomInventories(resolve(import.meta.dirname,'..'),(options.get('--shards')??'').split(','),options.get('--date')??'',options.get('--revision')??'');
  console.log(JSON.stringify({elapsedMs:performance.now()-start,shards:reports.map(row=>({shard:row.shard,custom:row.measured.customRuntimeLines,parts:row.parts}))}));
}
