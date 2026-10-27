// oxlint-disable-next-line import/no-nodejs-modules -- Borrow the original admitted director payload from its immutable author file.
import {readFileSync} from 'node:fs';
import {DRIFTWOOD_GUEST_ROWS,driftwoodGuestFile} from './driftwood-guest-programs';
import {compileBehaviourModule} from '../../src/sdk/buildBehaviour';
import {generateDirectorAbi} from '../../src/sdk/directorAbi';
import pineDeclaration from '../../src/shards/pine-hollow/data/director.json' with {type:'json'};

// GR8: Pine's product compiles its clock director (output.ts clockDirector); the fixture compiles the same source.
async function pine(){
  const compiled=await compileBehaviourModule(readFileSync('src/shards/pine-hollow/behaviour/director.as','utf8'),1,{'wildshard-director.ts':generateDirectorAbi(pineDeclaration)});
  if(compiled.module!==pineDeclaration.module)throw new Error('Pine clock module differs from its declaration');
  return compiled;
}
export const pineDirector=await pine();
export const driftwoodDirector={module:DRIFTWOOD_GUEST_ROWS.director.module,bytes:driftwoodGuestFile(`assets/${DRIFTWOOD_GUEST_ROWS.director.module}`)};
