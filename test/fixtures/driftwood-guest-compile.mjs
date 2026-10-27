// Compile the same production guest files in Node's native compiler/Response realm.
// oxlint-disable-next-line import/no-nodejs-modules -- Hash the same declared owner source as the native product compiler.
import { readFileSync } from 'node:fs';
import { createProjectGeneration } from '../../src/sdk/projectGeneration.ts';
import { hashImmutableBytes } from '../../src/sdk/immutable.ts';
import { driftwoodGuestFiles } from '../../src/shards/driftwood-isle/generators/guestPrograms.ts';

const source = 'src/shards/driftwood-isle/generators/guestPrograms.ts';
const context = createProjectGeneration('src/shards/driftwood-isle', hashImmutableBytes(new Uint8Array(readFileSync(source))), new Map(), process.argv[2]);
const files = await driftwoodGuestFiles(context);
process.stdout.write(JSON.stringify([...files].map(([name, bytes]) => [name, Buffer.from(bytes).toString('base64')])));
