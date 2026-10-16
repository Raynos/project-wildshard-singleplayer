// G450: the product, not an authoring folder, is the only runtime census input.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import { outputFormat } from './shard-platform-format.mjs';
import { shardfileBoundaryViolations } from '../lint/shardfile-boundaries.mjs';

const {parseOutputIndex}=outputFormat;
const digest = value => createHash('sha256').update(value).digest('hex');
function files(folder) {
  return !existsSync(folder) ? [] : readdirSync(folder,{withFileTypes:true}).flatMap(entry => {
    const file=resolve(folder,entry.name);
    if(entry.isSymbolicLink())throw new Error(`Output runtime contains a symbolic link: ${file}`);
    return entry.isDirectory()?files(file):[file];
  });
}
/** Verify the manifest against the actual copied bytes, including an intentionally empty runtime.
 * Source is consulted only to verify P3's verbatim-copy contract, never as a missing-output fallback.
 * @param {string} root @param {string} slug @param {string} [products] */
export function outputRuntime(root,slug,products=resolve(root,'out')) {
  if(!/^[a-z0-9_-]+$/u.test(slug))throw new Error('Invalid output shard slug');
  const folder=resolve(products,slug), indexPath=resolve(folder,'shard.json');
  if(!existsSync(indexPath))throw new Error(`${slug}: built output missing; build out/<slug> before measuring`);
  const index=parseOutputIndex(JSON.parse(readFileSync(indexPath,'utf8')));
  if(index.identity.slug!==(slug==='_template'?'template':slug))throw new Error(`${slug}: output identity mismatch`);
  const listed=new Set(), runtime=[];
  for(const entry of index.runtime?.files??[]) {
    if(!entry.path.startsWith('runtime/')||!entry.path.endsWith('.ts')||listed.has(entry.path))throw new Error(`${slug}: invalid runtime inventory: ${entry.path}`);
    listed.add(entry.path);
    const file=resolve(folder,entry.path), content=readFileSync(file);
    if(content.length!==entry.bytes||digest(content)!==entry.hash)throw new Error(`${slug}: runtime hash/size mismatch: ${entry.path}`);
    const authored=resolve(root,'src/shards',slug,entry.path);
    if(!existsSync(authored)||!content.equals(readFileSync(authored)))throw new Error(`${slug}: runtime is not a verbatim source copy: ${entry.path}`);
    const issues=shardfileBoundaryViolations(root,`src/shards/${slug}/${entry.path}`,content.toString('utf8')).filter(issue=>issue.rule==='runtime-standalone');
    if(issues.length>0)throw new Error(`${slug}: output runtime is not standalone: ${entry.path}: ${issues[0].message}`);
    runtime.push(relative(root,file).replaceAll('\\','/'));
  }
  if(index.runtime!==null&&!listed.has(index.runtime.entry))throw new Error(`${slug}: missing output runtime entry`);
  const actual=files(resolve(folder,'runtime')).map(file=>relative(folder,file).replaceAll('\\','/'));
  if(actual.length!==listed.size||actual.some(file=>!listed.has(file)))throw new Error(`${slug}: unlisted output runtime file`);
  const authoredRuntime=files(resolve(root,'src/shards',slug,'runtime')).filter(file=>file.endsWith('.ts')).map(file=>relative(resolve(root,'src/shards',slug),file).replaceAll('\\','/'));
  if(authoredRuntime.some(file=>!listed.has(file)))throw new Error(`${slug}: output omits authored runtime files`);
  let customSectionBytes=0;const sections=[],customSections=[];
  for(const section of index.sections) {
    const content=readFileSync(resolve(folder,section.path));
    if(content.length!==section.bytes||digest(content)!==section.hash)throw new Error(`${slug}: section hash/size mismatch: ${section.name}`);
    if(section.name.startsWith('custom/')){customSectionBytes+=content.length;customSections.push({name:section.name,bytes:content.length});}
    sections.push({name:section.name,value:JSON.parse(content.toString('utf8'))});
  }
  return {runtime:runtime.sort((a,b)=>a.localeCompare(b)),customSectionBytes,customSections,sections,indexPath:relative(root,indexPath).replaceAll('\\','/')};
}

