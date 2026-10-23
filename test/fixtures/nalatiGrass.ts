// oxlint-disable-next-line import/no-nodejs-modules -- Read the product's actual compressed grass blocks.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import type {GrassPayload} from '../../src/format/fieldPresentation';

const sources=v.parse(v.object({sources:v.array(v.object({name:v.string(),source:v.string()}))}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/grass.generated.json','utf8'))).sources;
/** The same raw named blocks read by the product, with no substitute geometry or texture. */
export const GRASS_FILES=new Map(sources.map(row=>[row.name,new Uint8Array(readFileSync(`src/shards/nalati-grasslands/${row.source}`))]));
export function grassBlock(payload:GrassPayload):Uint8Array {
  if(typeof payload==='string')throw new Error('Expected a named grass block');
  const bytes=GRASS_FILES.get(payload.file);
  if(bytes===undefined)throw new Error(`Missing grass block ${payload.file}`);
  return bytes;
}
