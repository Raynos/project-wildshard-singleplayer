// Inline envelopes only for the pre-existing stateless numeric unit oracles.
// Production uses the file descriptor and original scoped module loan; the raw
// intake, exact hash and owner refusals are covered by nalati-titan-binary.
// oxlint-disable-next-line import/no-nodejs-modules -- Reconstruct the original unit-only envelope from the exact generated artifact.
import {readFileSync} from 'node:fs';
import stored from '../../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};

export const titanRawPrograms=stored;
export const titanModuleBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/titan.generated.wasm'));
export const titanWitnessBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/titan-witness.generated.bin'));
export const pastureWitnessBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/pasture-witness.generated.bin'));
const attack=Buffer.from(titanWitnessBytes).toString('base64'),wind=Buffer.from(pastureWitnessBytes).toString('base64');
const bytes=Buffer.from(titanModuleBytes).toString('base64');
export const titanPrograms={...stored,
  attack:{...stored.attack,bytes:attack,v2:{...stored.attack.v2,bytes}},
  rules:{...stored.rules,bytes:attack,v2:{...stored.rules.v2,bytes}},
  wind:{...stored.wind,bytes:wind},fire:{...stored.fire,bytes:wind},
};
export const pastureWitness=titanPrograms.wind;
