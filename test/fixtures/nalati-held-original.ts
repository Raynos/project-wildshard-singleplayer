import * as v from 'valibot';
import { nalatiHeldSource, type NalatiHeldRows } from '../../src/shards/nalati-grasslands/generators/heldMetadata';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { originalSpeciesJson } from './nalati-original-species';
import pins from './nalati-held-files.json' with { type: 'json' };

const aliases = v.record(v.string(), v.string());
const program = v.looseObject({ script: v.looseObject({ fields: aliases, channels: aliases, signals: aliases }) });
const originalAliases = v.object({
  held: v.looseObject({ program, programs: v.object({ polearm: program, blade: program, power: program }) }),
  stealth: v.looseObject({ program }),
});
type OriginalHeldRows = NalatiHeldRows & v.InferOutput<typeof originalAliases>;

/** Each predecessor loan reconstructs both complete documents and checks their original immutable pins. */
export function originalHeldMetadata(): OriginalHeldRows {
  const rows = nalatiHeldSource(originalSpeciesJson('species.json'));
  if (pins.length !== 2) throw new Error('Missing complete original held inventory');
  for (const [index, value] of [rows.held, rows.stealth].entries()) {
    const pin = pins[index], bytes = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
    if (pin === undefined || bytes.length !== pin.bytes || hashImmutableBytes(bytes) !== pin.sha256)
      throw new Error('Original held metadata differs');
  }
  if (!v.is(originalAliases, rows)) throw new Error('Original held aliases differ');
  return rows;
}
