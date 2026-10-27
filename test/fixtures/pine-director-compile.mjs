// Compile Pine's clock director in Node's native compiler/Response realm, as its product does (output.ts clockDirector).
// oxlint-disable-next-line import/no-nodejs-modules -- Read the same author source and declaration the product compiles.
import { readFileSync } from 'node:fs';
import { compileBehaviourModule } from '../../src/sdk/buildBehaviour.ts';
import { generateDirectorAbi } from '../../src/sdk/directorAbi.ts';

const declaration = JSON.parse(readFileSync('src/shards/pine-hollow/data/director.json', 'utf8'));
const compiled = await compileBehaviourModule(readFileSync('src/shards/pine-hollow/behaviour/director.as', 'utf8'), 1, { 'wildshard-director.ts': generateDirectorAbi(declaration) });
process.stdout.write(JSON.stringify({ module: compiled.module, bytes: Buffer.from(compiled.bytes).toString('base64') }));
