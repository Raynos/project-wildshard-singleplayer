// oxlint-disable-next-line import/no-nodejs-modules -- Borrow the original admitted director payload from its immutable author file.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';

function module(slug:string){
  const row=v.parse(v.object({module:v.string(),bytes:v.string()}),JSON.parse(readFileSync(`src/shards/${slug}/behaviour/director.json`,'utf8')));
  return {...row,bytes:Uint8Array.from(readFileSync(`src/shards/${slug}/assets/${row.module}`))};
}
export const pineDirector=module('pine-hollow');
export const driftwoodDirector=module('driftwood-isle');
