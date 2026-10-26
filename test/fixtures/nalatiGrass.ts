// oxlint-disable-next-line import/no-nodejs-modules -- Read the product's actual compressed grass blocks.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {GrassPresentationSchema,type GrassPayload,type GrassPresentationRows} from '../../src/format/fieldPresentation';
import {zlibSync} from 'fflate';
import {grassRows,grassChannelBytes} from '../../src/shards/nalati-grasslands/generators/grassRows';

const sources=v.parse(v.object({sources:v.array(v.object({name:v.string(),source:v.string()}))}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/grass.generated.json','utf8'))).sources;
/** The same raw named blocks read by the product, with no substitute geometry or texture. */
export const GRASS_FILES=new Map<string,Uint8Array>([
  ...sources.map((row):readonly [string,Uint8Array]=>{
    const bytes=new Uint8Array(readFileSync(`src/shards/nalati-grasslands/${row.source}`));
    return [row.name,bytes];
  }),
  ...grassChannelBytes().map((blob):readonly [string,Uint8Array]=>{
    return [blob.name,blob.bytes];
  }),
]);
export function grassBlock(payload:GrassPayload):Uint8Array {
  if(typeof payload==='string')throw new Error('Expected a named grass block');
  const bytes=GRASS_FILES.get(payload.file);
  if(bytes===undefined)throw new Error(`Missing grass block ${payload.file}`);
  return bytes;
}

/** Restore only predecessor transport; complete independent hashes pin geometry and metadata in callers. */
export function originalGrassRows(phone:boolean):ReturnType<typeof grassRows>{
  const tier=phone?'phone':'desktop',raw=new Map<string,Uint8Array>();
  const rows=grassRows(phone,(id,bytes)=>{raw.set(id,bytes);return {file:'grass/channels.bin',byteOffset:0};});
  for(const [name,scene]of Object.entries(rows.scenes))scene.buffers=scene.buffers.map(buffer=>{
    const bytes=raw.get(`${tier}-${name}-${buffer.id}`);if(bytes===undefined)throw new Error('Missing original grass channel');
    return {id:buffer.id,storage:buffer.storage,bytes:btoa(Array.from(bytes,byte=>String.fromCodePoint(byte)).join('')),instanced:buffer.instanced};
  });
  return rows;
}
/** The original ten-block profile, reconstructed without retaining duplicate binary fixtures. */
export function originalGrassProfile():{rows:GrassPresentationRows;files:Map<string,Uint8Array>}{
  const rows=v.parse(GrassPresentationSchema,JSON.parse(readFileSync('src/shards/nalati-grasslands/data/grass.generated.json','utf8')));
  const files=new Map<string,Uint8Array>(GRASS_FILES);
  for(const tier of ['phone','desktop']as const){
    delete rows[tier].channels;
    const original=originalGrassRows(tier==='phone');
    for(const [key,scene]of Object.entries(original.scenes))files.set(`look/grass/${tier}-${key}.bin`,zlibSync(new TextEncoder().encode(JSON.stringify(scene))));
  }
  return {rows,files};
}
