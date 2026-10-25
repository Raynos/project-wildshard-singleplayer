import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Discovery compiles the isolated source tree under Node.
import { cwd } from 'node:process';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';
import { parseDiscoveryValues } from '@wildshard/format/discoveryValues';
import { generated as signalProgram } from './fixtures/sunscar-source-program';
import skyMap from '../src/shards/far-reach/data/mapPalette.generated.json' with { type: 'json' };
import signalMap from '../src/shards/sunscar-dunes/data/mapPalette.generated.json' with { type: 'json' };
import { hashImmutableBytes } from '../src/sdk/immutable';
import { fixedLayoutFiles as skyFiles } from '../src/shards/far-reach/generators/fixedLayouts';
import { fixedLayoutFiles as signalFiles } from '../src/shards/sunscar-dunes/generators/fixedLayouts';
import sky from '../src/shards/far-reach/data/layout.generated.json' with { type: 'json' };
import * as signalSource from '../src/shards/sunscar-dunes/generators/layout';
import crown from '../src/shards/far-reach/data/crownLayout.generated.json' with { type: 'json' };
import * as duneSource from '../src/shards/sunscar-dunes/generators/duneRows';

// The old transport sorts top-level export names; Vite namespaces retain
// declaration order, so keep the original wire ordering in these byte oracles.
const ordered = (rows: Readonly<Record<string, unknown>>) => Object.fromEntries(
  Object.entries(rows).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
const signal = ordered(signalSource), dunes = ordered(duneSource);

// Captured from 68807c271 before moving the coordinate recipes: every derived
// bridge endpoint, pad, trail, island, map mark and crown stone is included.
for (const [label, rows, hash] of [
  ['Sky', sky, '145be163d6df9a834b36ce39959c16e03904bb348b893ed9635a4bd928f9e37b'],
  ['Signal', signal, '2fbdedce0e1fab764c74b33cb33704b00ce38c128632374c23b6be85cad6d9c7'],
  ['crown', crown, 'b7dcae1430918123ef0f16c65bf8aaeb80d1c3a6aad9b916e979dd5f2727f809'],
] as const) {
  test(`${label} fixed coordinates retain the original evaluated rows`, () => {
    expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(rows)))).toBe(hash);
  });
}

for (const [label, compile, rows] of [
  ['Sky', skyFiles, new Map<string, unknown>([['data/layout.generated.json', sky], ['data/crownLayout.generated.json', crown], ['data/mapPalette.generated.json', skyMap]])],
  ['Signal', signalFiles, new Map<string, unknown>([['data/layout.generated.json', signal], ['data/duneRows.generated.json', dunes], ['data/mapPalette.generated.json', signalMap]])],
] as const) {
  test(`${label} compiles the complete layout without runtime mirrors`, () => {
    const files = compile();
    expect([...files.keys()]).toEqual([...rows.keys()]);
    for (const [file, value] of rows) {
      expect(files.get(file)).toEqual(new TextEncoder().encode(`${JSON.stringify(value)}\n`));
    }
  });
}

for (const [slug, palette] of [['far-reach', skyMap], ['sunscar-dunes', signalMap]] as const) {
  test(`${slug} discovery lends fixed palette JSON without executable authoring`, () => {
    const source = authoredManifestSource(cwd(), slug, slug === 'sunscar-dunes'
      ? { discovery: parseDiscoveryValues(signalProgram.discovery) } : undefined);
    expect(source).toContain(`mapPalette: ${JSON.stringify(palette)}`);
    expect(source).not.toMatch(/from ["'][^"']*generators\/(?:layout|minimap)/u);
    if (slug === 'sunscar-dunes') expect(() => authoredManifestSource(cwd(), slug)).toThrow('program discovery value boot.files');
  });
}
