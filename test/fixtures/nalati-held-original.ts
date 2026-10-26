import { nalatiHeldSource, type NalatiHeldRows } from '../../src/shards/nalati-grasslands/generators/heldMetadata';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { originalSpeciesJson } from './nalati-original-species';
import pins from './nalati-held-files.json' with { type: 'json' };

/** Each predecessor loan reconstructs both complete documents and checks their original immutable pins. */
export function originalHeldMetadata(): NalatiHeldRows {
  const rows = nalatiHeldSource(originalSpeciesJson('species.json'));
  if (pins.length !== 2) throw new Error('Missing complete original held inventory');
  for (const [index, value] of [rows.held, rows.stealth].entries()) {
    const pin = pins[index], bytes = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
    if (pin === undefined || bytes.length !== pin.bytes || hashImmutableBytes(bytes) !== pin.sha256)
      throw new Error('Original held metadata differs');
  }
  return rows;
}
