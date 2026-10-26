import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { CreatureGuestSchema } from '@wildshard/format/speciesBookRows';
import { compileReturnProjectionV2 } from '@wildshard/sdk/returnProjectionV2';
import { nalatiSpeciesProgram } from './speciesProgram.ts';

const inputSchema = v.object({
  body: v.object({ bytes: v.number(), bodies: v.array(v.object({ key: v.string(), bones: v.array(v.looseObject({ name: v.string() })),
    dims: v.unknown(), fur: v.array(v.array(v.number())), hard: v.array(v.array(v.number())), eye: v.array(v.array(v.number())) })) }),
  admission: v.looseObject({ script: v.record(v.string(), v.unknown()), bytes: v.string(), compiled: v.optional(v.unknown()), v2: v.optional(v.unknown()) }),
  strike: v.unknown(), kingPose: v.object({ programs: v.unknown(), group: v.string() }),
});

/** Construct from explicitly declared source loans; importing this CLI never publishes its outputs. */
export async function nalatiSpeciesSource() {
  const files = await nalatiSpeciesProgram({ compileReturnProjection: compileReturnProjectionV2, cached: (step, make) => {
    const inputs = new Map(step.inputs?.map(name => [name, Uint8Array.from(readFileSync(fileURLToPath(
      new URL(name.startsWith('/') ? `../../../../public${name}` : `../${name}`, import.meta.url))))]));
    return Promise.resolve(make(inputs));
  } }, input => {
    if (!v.is(inputSchema, input)) throw new Error('Invalid species CLI source metadata');
    return input;
  }, input => v.parse(CreatureGuestSchema, input), hash => `/assets/nalati/baked/bodies-${hash}.bin`);
  const metadata = files.get('species.json');
  if (metadata === undefined) throw new Error('Missing source species metadata');
  const species = JSON.parse(new TextDecoder().decode(metadata));
  if (!v.is(v.looseObject({ program: v.looseObject({ script: v.unknown(), bytes: v.string() }),
    compiled: v.object({ source: v.string(), bytes: v.number(), hash: v.string() }),
  }), species)) throw new Error('Missing source-owned held program');
  return { files, program: species.program, compiled: species.compiled };
}

if (resolve(process.argv[1] ?? '') === import.meta.filename) {
  const { files } = await nalatiSpeciesSource();
  const required = name => {
    const bytes = files.get(name); if (bytes === undefined) throw new Error(`Missing source species file ${name}`);
    return bytes;
  };
  const writer = byteWriter(process.argv.includes('--check'), 'nalati-species');
  writer.put(fileURLToPath(new URL('../behaviour/held-weapons.generated.wasm', import.meta.url)), required('held-weapons.wasm'));
  writer.put(fileURLToPath(new URL('../behaviour/held-witness.generated.bin', import.meta.url)), required('held-witness.bin'));
  writer.put(fileURLToPath(new URL(`../../../../public/assets/nalati/baked/bodies-${hashImmutableBytes(required('bodies.bin'))}.bin`, import.meta.url)), required('bodies.bin'));
  writer.put(fileURLToPath(new URL('../data/species.generated.json', import.meta.url)), required('species.json'));
  writer.put(resolve(import.meta.dirname, '../boot/speciesRows.generated.json'), required('boot.json'));
  writer.finish();
}
