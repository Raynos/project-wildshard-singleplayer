import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Discovery compiles the isolated source tree under Node.
import { cwd } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind native model reads to the actual declared public root.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only this bounded native discovery cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';
import { parseDiscoveryValues } from '@wildshard/format/discoveryValues';
import { generated as signalProgram } from './fixtures/sunscar-source-program';
import { SIGNAL_DUNES_MAP as signalMap } from '../src/shards/sunscar-dunes/generators/minimap';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { fixedLayoutFiles as skyFiles, skyMapPalette } from '../src/shards/far-reach/generators/fixedLayouts';
import * as skySource from '../src/shards/far-reach/generators/layout';
import * as signalSource from '../src/shards/sunscar-dunes/generators/layout';
import * as crownSource from '../src/shards/far-reach/generators/crownLayout';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { skyCreatureRigOutput } from '../src/shards/far-reach/generators/creatureRigOutput';
import { skyRigAssetSources } from '../src/shards/far-reach/generators/rigAssetSources';
import { skyProductBoot } from '../src/shards/far-reach/generators/bootInventory';
import { skyViewDiscovery } from '../src/shards/far-reach/generators/viewData';
import { GPU_FILES } from '../src/shards/far-reach/ktx2.generated';
import { originalSkyNavigation } from './fixtures/sky-navigation';

// The old transport sorts top-level export names; Vite namespaces retain
// declaration order, so keep the original wire ordering in these byte oracles.
const ordered = (rows: Readonly<Record<string, unknown>>) => Object.fromEntries(
  Object.entries(rows).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
const signal = ordered(signalSource), sky = ordered(skySource), crown = ordered(crownSource);
const skyMap = skyMapPalette();

/** The same complete discovery composition as generate(), without constructing unrelated world/map output. */
async function skyDiscovery(): Promise<ReturnType<typeof parseDiscoveryValues>> {
  mkdirSync('tmp', { recursive: true });
  const cache = mkdtempSync(resolve('tmp', 'sky-layout-discovery-')), project = resolve('src/shards/far-reach');
  try {
    const context = createProjectGeneration(project, 'f'.repeat(64), new Map(), cache, [
      { prefix: '/src/shards/far-reach/', directory: project },
      { prefix: '/assets/', directory: resolve('public/assets') },
    ]);
    const rigs = await skyCreatureRigOutput(context);
    return parseDiscoveryValues({ ...skyProductBoot(skyRigAssetSources(rigs.files, GPU_FILES)),
      ...skyViewDiscovery(), mapPalette: skyMapPalette(), navigation: originalSkyNavigation() });
  } finally { rmSync(cache, { recursive: true, force: true }); }
}

test('the source palette retains its complete original wire after fixed-layout retirement', () => {
  const wire = (): Uint8Array => new TextEncoder().encode(`${JSON.stringify(skyMapPalette())}\n`);
  expect(wire().byteLength).toBe(5_040);
  expect(hashImmutableBytes(wire())).toBe('0645f591824cccc7e8060b87b84b7b5159a6c7edb0f10da7158a15241904ba0b');
  const changed = skyMapPalette(); Reflect.set(changed.ground.base, 0, 0);
  expect(hashImmutableBytes(wire())).toBe('0645f591824cccc7e8060b87b84b7b5159a6c7edb0f10da7158a15241904ba0b');
});

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
  test(`${slug} discovery lends fixed palette JSON without executable authoring`, async () => {
    const discovery = slug === 'sunscar-dunes' ? parseDiscoveryValues(signalProgram.discovery) : await skyDiscovery();
    if (discovery === undefined) throw new Error('Missing current source discovery');
    const source = authoredManifestSource(cwd(), slug, { discovery });
    expect(source).toContain(`mapPalette: ${JSON.stringify(palette)}`);
    expect(source).not.toMatch(/from ["'][^"']*generators\/(?:layout|minimap)/u);
    expect(() => authoredManifestSource(cwd(), slug)).toThrow('program discovery value budgets');
    if (slug === 'sunscar-dunes') {
      for (const key of ['budgets', 'navigation', 'mapPalette', 'poses', 'audioCues', 'boot.files', 'boot.sources', 'boot.lateReads'] as const) {
        const missing = { ...parseDiscoveryValues(signalProgram.discovery) }; delete missing[key];
        expect(() => authoredManifestSource(cwd(), slug, { discovery: missing })).toThrow(`program discovery value ${key}`);
      }
    } else {
      const noBoot = { ...discovery };
      delete noBoot['boot.files']; delete noBoot['boot.sources']; delete noBoot['boot.lateReads'];
      expect(() => authoredManifestSource(cwd(), slug, { discovery: noBoot })).toThrow('program discovery value boot.files');
      for (const key of ['budgets', 'navigation', 'mapPalette', 'poses', 'ktx2', 'boot.files', 'boot.sources', 'boot.lateReads'] as const) {
        const missing = { ...discovery }; delete missing[key];
        expect(() => authoredManifestSource(cwd(), slug, { discovery: missing })).toThrow(`program discovery value ${key}`);
      }
    }
  });
}
