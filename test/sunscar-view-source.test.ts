import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import * as models from '../src/shards/sunscar-dunes/generators/rows/files';
import * as surfaces from '../src/shards/sunscar-dunes/generators/rows/surfaces';
import { BOOT_FILES, BOOT_SOURCES } from '../src/shards/sunscar-dunes/generators/rows/boot';
import { SIGNAL_PIECES } from '../src/shards/sunscar-dunes/generators/rows/pieces';
import { generated, rigLibrary } from './fixtures/sunscar-source-program';
import original from './fixtures/sunscar-view-files.json' with { type: 'json' };

// The retired writer's formatting pins both original values and literal/tuple
// declaration shapes. This oracle never publishes or seeds an author input.
function shape(value: unknown): string {
  if (Array.isArray(value)) return `readonly [${value.map(shape).join(',')}]`;
  if (typeof value === 'object' && value !== null) return `{${Object.entries(value).map(([key, item]) => `readonly ${JSON.stringify(key)}: ${shape(item)}`).join(';')}}`;
  if (typeof value === 'number') return 'number';
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('Invalid original view row');
  return encoded;
}

test('source discovery and actual cached skeleton retain all twenty original view handoff identities', () => {
  const namespaceRows = (rows: Readonly<Record<string, unknown>>) => Object.fromEntries(Object.keys(rows).sort().map(key => [key, rows[key]]));
  const values = { models: namespaceRows(models), surfaces: namespaceRows(surfaces), boot: BOOT_FILES, bootSources: BOOT_SOURCES,
    lateReads: generated.discovery?.['boot.lateReads'], budgets: generated.discovery?.budgets,
    devPoses: generated.discovery?.poses, pieces: SIGNAL_PIECES,
    striderRig: rigLibrary.bodies.standIns.strider, cues: generated.discovery?.audioCues };
  const hashes: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) throw new Error('Missing source discovery value');
    const root = `src/shards/sunscar-dunes/assets/${name}.generated`;
    hashes[`${root}.json`] = hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`));
    hashes[`${root}.d.json.ts`] = hashImmutableBytes(new TextEncoder().encode(`// Generated row types; no runtime declarations.\ndeclare const rows: ${shape(value)};\nexport default rows;\n`));
  }
  expect(hashes).toEqual(original);
});
