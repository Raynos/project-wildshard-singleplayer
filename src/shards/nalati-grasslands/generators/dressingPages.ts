import { nameBlob, type NamedBlob } from '@wildshard/sharddev/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { authorFormatSchema, namedJsonSchema } from '@wildshard/sharddev/formatJsonSchema';
import { parseSectionValue } from '@wildshard/sharddev/sections';
import { DRESSING_SCHEMAS } from './dressingSchemas';

// First two pages contain the live layer lists in their existing first-use
// order. Unread support lists never ride a live page. No array is re-sorted.
const pageSchema=authorFormatSchema('sceneDressing.SceneScatterPageSchema');
const groups = [ ['boulder', 'slab', 'juniper'], ['rose', 'willow', 'lupin', 'reed'],
  ['logs', 'stumps', 'ovoos', 'poles'], ['fences', 'gates', 'drifts', 'colliders'], ['clutter'] ] as const;
const kinds: Readonly<Record<string, string>> = { boulder: 'poses', slab: 'poses', juniper: 'poses', rose: 'poses', willow: 'poses', lupin: 'poses', reed: 'poses',
  logs: 'logs', stumps: 'spots', ovoos: 'spots', poles: 'spots', fences: 'paths', gates: 'gates', drifts: 'drifts', colliders: 'bounds', clutter: 'clutter' };

/** Exact old logical-list identity now selects one bounded native member. */
export function nalatiDressingPageReference(name: string): { file: string; member: string } | undefined {
  for (const [page, members] of groups.entries()) for (const member of members)
    if (name === `world/dressing-${member}.json`) return { file: `world/dressing-pages/${page}.json`, member };
  return undefined;
}

/** Original sixteen complete schemas run before packing; both numeric tables
 * remain independent transports. No source bytes or caller arrays are lent. */
export function nalatiDressingPages(files: ReadonlyMap<string, Uint8Array>, binaries: readonly NamedBlob[]): readonly NamedBlob[] {
  const names=groups.flat().map(key=>`dressing-${key}.json`), allowed=new Set<string>([...names,'dressing-stone.json','dressing-daisy.json']);
  if(names.some(name=>(files.get(name)?.byteLength??0)===0)||[...files.keys()].some(name=>!allowed.has(name)))
    throw new Error('Missing original scatter list inventory');
  const binaryNames=['world/dressing-stone.bin','world/dressing-daisy.bin'];
  if(binaries.length!==2||binaryNames.some(name=>binaries.filter(blob=>blob.file.name===name&&blob.file.kind==='bin').length!==1))
    throw new Error('Both original numeric scatter tables are required');
  const pages = groups.map((members, page) => {
    const rows = members.map(id => {
      const schema = DRESSING_SCHEMAS[id], bytes = files.get(`dressing-${id}.json`), kind = kinds[id];
      if (schema === undefined || bytes === undefined || kind === undefined) throw new Error('Missing original scatter list');
      const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      return { id, kind, rows: schema.parse(input) };
    });
    const value = parseSectionValue(pageSchema,{ version: 1, members: rows });
    const bytes = new TextEncoder().encode(encodeCanonicalJson(value));
    if (bytes.byteLength > 4 * 1024 * 1024) throw new Error('Scatter page exceeds four MiB');
    return nameBlob(`world/dressing-pages/${page}.json`, 'json', bytes, { jsonSchema: namedJsonSchema(pageSchema, { provenance: true }) });
  });
  return [...pages, ...binaries];
}

/** Change only declared JSON layer references; all other raw wire fields,
 * defaults and ordering survive the original scene envelope unchanged. */
export function nalatiPagedDressingRows(input: unknown): unknown {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('Missing dressing book');
  const layers: unknown = Reflect.get(input, 'layers');
  if (!Array.isArray(layers)) throw new Error('Missing dressing layers');
  const bound: unknown[]=[];
  for(const item of layers){
    const row: unknown=item;
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error('Missing dressing layer');
    const file: unknown = Reflect.get(row, 'file'), binary: unknown = Reflect.get(row, 'binary');
    if (typeof file !== 'string' || typeof binary !== 'boolean' || Object.hasOwn(row, 'member')) throw new Error('Invalid original dressing layer');
    const reference = nalatiDressingPageReference(file);
    if(reference===undefined){bound.push(row);continue;}
    if (binary) throw new Error('Numeric dressing tables cannot select JSON members');
    bound.push({...row,...reference});
  }
  return { ...input, layers: bound };
}
