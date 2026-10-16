// oxlint-disable-next-line import/no-nodejs-modules -- The build scans its owned output root.
import { existsSync, lstatSync, readdirSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- All index paths are validated output-relative paths.
import { resolve } from 'node:path';
import * as v from 'valibot';
import { parseOutputIndex } from '@wildshard/format/outputIndex';
import { LevelSectionSchema } from '@wildshard/format/level';
import { AccentSchema } from '@wildshard/format/accent';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '@wildshard/format/admissionLimits';
import { ShardCatalogPlacementsSchema, type ShardCatalog, type ShardCatalogEntry } from '@wildshard/format/shardCatalog';
import { readBoundedFile } from './sourceReader';
import { hashImmutableBytes } from './immutable';
import { writeOutputCatalog, type OutputCatalogEntry } from './outputCatalog';

export interface CatalogPlacement { readonly slug: string; readonly placement: ShardCatalogEntry['placement']; readonly runtime?: 'source' }
/** Rebuild one complete catalog from published out directories. No source module,
 * old catalog, or build-time manifest is read. The writer's receipt must match
 * each exact index, and discovery sections/images are independently hash-checked. */
export function writeCatalogFromOutputs(destination: string, placements: readonly CatalogPlacement[]): ShardCatalog {
  const entries: OutputCatalogEntry[] = [];
  const declared = v.parse(ShardCatalogPlacementsSchema, placements), used = new Set<string>();
  if (new Set(declared.map(row => row.slug)).size !== declared.length) throw new Error('Duplicate catalog placement identity');
  const json = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  for (const directory of readdirSync(destination,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)) {
    if (directory.name.startsWith('.')) continue;
    if (directory.isSymbolicLink()) throw new Error('Catalog output cannot contain symlinks');
    if (!directory.isDirectory()) continue;
    const folder = directory.name, product = resolve(destination,folder), indexBytes = readBoundedFile(resolve(product,'shard.json'),limits.sourceBytes);
    const index = parseOutputIndex(json(indexBytes));
    const receipt = json(readBoundedFile(resolve(product,'validation.json'),limits.sourceBytes));
    if (typeof receipt !== 'object' || receipt === null || !('indexHash' in receipt) || receipt.indexHash !== hashImmutableBytes(indexBytes)) throw new Error(`Catalog requires a current validated index: ${folder}`);
    const section = (name:string):unknown => {
      const row=index.sections.find(item=>item.name===name); if(row===undefined)throw new Error(`Catalog requires ${name}: ${folder}`);
      const bytes=readBoundedFile(resolve(product,row.path),row.bytes);
      if(bytes.length!==row.bytes||hashImmutableBytes(bytes)!==row.hash)throw new Error(`Catalog section hash mismatch: ${name}`);
      return json(bytes);
    };
    const {manifest}=v.parse(LevelSectionSchema,section('ui/level'));
    const {accent}=v.parse(v.strictObject({accent:AccentSchema}),section('ui/card'));
    const matches=declared.filter(row=>[folder,index.identity.slug].includes(row.slug)),placement=matches[0];
    if(matches.length!==1||placement===undefined)throw new Error(`Catalog requires exactly one grid placement: ${folder}`);
    used.add(placement.slug);
    const image=(url:string):string=>{
      if(url.startsWith('data:image/'))return url;
      const prefix=`/shardfiles/${folder}/`,path=url.startsWith(prefix)?url.slice(prefix.length):url;
      const file=index.files.find(row=>row.kind==='image'&&row.path===path);
      if(file===undefined)throw new Error(`Catalog image must be an emitted image blob: ${url}`);
      const target=resolve(product,file.path);
      if(!existsSync(target)||!lstatSync(target).isFile()||lstatSync(target).isSymbolicLink())throw new Error('Catalog image file is missing or symbolic');
      const bytes=readBoundedFile(target,file.compressed);
      if(bytes.length!==file.compressed||hashImmutableBytes(bytes)!==file.hash)throw new Error('Catalog image hash mismatch');
      return `${folder}/${file.path}`;
    };
    if(placement.runtime==='source'&&(index.runtime===null||index.runtime.files.length>0))throw new Error(`Source runtime requires an unclosed native product: ${folder}`);
    if(placement.runtime!=='source'&&index.runtime!==null&&!index.runtime.files.some(file=>file.path==='runtime/index.ts'))throw new Error(`Catalog requires its copied page runtime: ${folder}`);
    entries.push({slug:folder,identity:{slug:index.identity.slug,revision:index.identity.revision},index:indexBytes,
      card:{name:manifest.name,label:manifest.label,biome:manifest.biome,blurb:manifest.blurb,order:manifest.order,status:manifest.status,thumb:image(manifest.card.thumb),portrait:image(manifest.card.portrait),landscape:image(manifest.card.landscape),accent},
      placement:placement.placement,runtime:placement.runtime==='source'?'source':index.runtime===null?null:{entry:'runtime/index.ts',files:index.runtime.files}});
  }
  for(const row of declared)if(!used.has(row.slug))throw new Error(`Catalog requires every declared output: ${row.slug}`);
  return writeOutputCatalog(destination,entries);
}
