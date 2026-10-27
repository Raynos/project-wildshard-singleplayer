// oxlint-disable-next-line import/no-nodejs-modules -- Borrow the original admitted director payload from its immutable author file.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {compileBehaviourModule} from '../../src/sdk/buildBehaviour';
import {generateDirectorAbi} from '../../src/sdk/directorAbi';
import pineDeclaration from '../../src/shards/pine-hollow/data/director.json' with {type:'json'};

function module(slug:string){
  const row=v.parse(v.object({module:v.string(),bytes:v.string()}),JSON.parse(readFileSync(`src/shards/${slug}/behaviour/director.json`,'utf8')));
  return {...row,bytes:Uint8Array.from(readFileSync(`src/shards/${slug}/assets/${row.module}`))};
}
// GR8: Pine's product compiles its clock director (output.ts clockDirector); the fixture compiles the same source.
async function pine(){
  const compiled=await compileBehaviourModule(readFileSync('src/shards/pine-hollow/behaviour/director.as','utf8'),1,{'wildshard-director.ts':generateDirectorAbi(pineDeclaration)});
  if(compiled.module!==pineDeclaration.module)throw new Error('Pine clock module differs from its declaration');
  return compiled;
}
export const pineDirector=await pine();
export const driftwoodDirector=module('driftwood-isle');
