// Inline envelopes only for the pre-existing stateless numeric unit oracles.
// Production uses the file descriptor and original scoped module loan; the raw
// intake, exact hash and owner refusals are covered by nalati-titan-binary.
// oxlint-disable-next-line import/no-nodejs-modules -- Reconstruct the original unit-only envelope from the exact generated artifact.
import {readFileSync} from 'node:fs';
import stored from '../../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};

export const titanRawPrograms=stored;
export const titanModuleBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/titan.generated.wasm'));
const bytes=Buffer.from(titanModuleBytes).toString('base64');
export const titanPrograms={...stored,
  attack:{...stored.attack,v2:{...stored.attack.v2,bytes}},
  rules:{...stored.rules,v2:{...stored.rules.v2,bytes}},
};
