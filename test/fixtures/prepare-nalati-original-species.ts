// oxlint-disable-next-line import/no-nodejs-modules -- Compile the frozen oracle in Node's native Response realm.
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, existsSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The caller supplies its repository-local immutable test cache.
import { resolve, dirname } from 'node:path';
import * as v from 'valibot';
import { CreatureGuestSchema } from '../../src/format/speciesBookRows';
import { compileReturnProjectionV2 } from '../../src/sdk/returnProjectionV2';
import { compileDecisionScripts } from '../../src/sdk/buildDecisionScripts';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { nalatiSpeciesProgram } from '../../src/shards/nalati-grasslands/generators/speciesProgram';
import pins from './nalati-species-files.json' with { type: 'json' };

const names = ['species.json', 'bodies.bin', 'boot.json', 'held-weapons.wasm', 'held-witness.bin'];
const directory = process.argv[2];
if (directory === undefined) throw new Error('Missing original species test cache');
const root = resolve(directory);
const inputSchema = v.object({
  body: v.object({ bytes: v.number(), bodies: v.array(v.object({ key: v.string(), bones: v.array(v.looseObject({ name: v.string() })),
    dims: v.unknown(), fur: v.array(v.array(v.number())), hard: v.array(v.array(v.number())), eye: v.array(v.array(v.number())) })) }),
  admission: v.looseObject({ script: v.record(v.string(), v.unknown()), bytes: v.string(), compiled: v.optional(v.unknown()), v2: v.optional(v.unknown()) }),
  strike: v.unknown(), kingPose: v.object({ programs: v.unknown(), group: v.string() }),
});
const files = await nalatiSpeciesProgram({ compileDecisionRows: compileDecisionScripts, compileReturnProjection: compileReturnProjectionV2, cached: (step, make) => {
  const inputs = new Map(step.inputs?.map(name => [name, Uint8Array.from(readFileSync(name.startsWith('/') ? `public${name}` : `src/shards/nalati-grasslands/${name}`))]));
  return Promise.resolve(make(inputs));
} }, input => {
  if (!v.is(inputSchema, input)) throw new Error('Invalid original species fixture inputs');
  return input;
}, input => v.parse(CreatureGuestSchema, input), hash => `/assets/nalati/baked/bodies-${hash}.bin`);
// No generated species output is read, even when every original is still on disk.
for (const [index, pin] of pins.entries()) {
  const name = names[index], bytes = name === undefined ? undefined : files.get(name);
  if (bytes === undefined || bytes.length !== pin.bytes || hashImmutableBytes(bytes) !== pin.sha256) throw new Error(`Original species source differs: ${pin.path}`);
}
mkdirSync(dirname(root), { recursive: true });
const stage = mkdtempSync(`${root}-preparing-`);
try {
  for (const [name, bytes] of files) writeFileSync(resolve(stage, name), bytes);
  // Concurrent cold readers may publish only the same fully checked inventory.
  if (!existsSync(root)) {
    try { renameSync(stage, root); } catch (error) { if (!existsSync(root)) throw error; }
  }
} finally { rmSync(stage, { recursive: true, force: true }); }
