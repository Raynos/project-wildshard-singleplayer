import { expect, test } from 'vitest';
import { publicBytes } from '../src/engine/boot/tables';
import { driftwoodBootInventory } from '../src/shards/driftwood-isle/generators/bootInventory';
import { DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES } from '../src/shards/driftwood-isle/generators/bootRecipes';
import { GPU_FILES } from '../src/shards/driftwood-isle/ktx2.generated';
import { bootFileList, bootLateReads, bootSourceFiles, resolveBootFiles, resolveBootSources } from '../src/engine/boot/filePolicy';
import ISLAND_PLAN_FILES from '../src/shards/driftwood-isle/data/islandPlanFiles.json' with { type: 'json' };
import original from './fixtures/driftwood-boot-original.json' with { type: 'json' };
import manifest from '../src/shards/driftwood-isle/manifest.json' with { type: 'json' };
import { driftwoodBootProgram } from '../src/shards/driftwood-isle/generators/bootProgram';

const { sources, files, lateReads } = original;

test('offline boot rows preserve ordered sources and filtered late reads for all four choices', () => {
  expect({ sources, files, lateReads }).toEqual(driftwoodBootInventory(publicBytes()));
  for (const tier of ['phone', 'desktop'] as const) for (const mode of ['img', 'ktx2'] as const) {
    const expected = resolveBootSources(DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES, tier, mode, GPU_FILES);
    const named = new Set(['reef', 'ground', 'palms', 'hibiscus', 'cover', 'island', 'records', 'lights'].flatMap(group => resolveBootFiles(DRIFTWOOD_BOOT_FILES, group, tier, mode, GPU_FILES)));
    const expectedLate = resolveBootFiles(DRIFTWOOD_BOOT_FILES, 'late', tier, mode, GPU_FILES).filter(url => !named.has(url));
    expect(bootSourceFiles(sources, tier, mode)).toEqual(expected);
    expect(bootLateReads(lateReads, tier, mode)).toEqual(expectedLate);
    if (mode === 'img') {
      expect(bootFileList(files, tier)).toEqual(Object.values(expected).flat());
      expect(bootLateReads(lateReads, tier)).toEqual(expectedLate);
    }
    expect(bootFileList({ sources, tier, tex: mode }, tier)).toEqual(Object.values(expected).flat());
  }
});

test('offline mode selectors retain duplicates and legacy lists and callbacks', () => {
  const rows = { modes: { phone: { img: ['a', 'a'], ktx2: ['k'] }, desktop: { img: ['d'], ktx2: [] } } };
  expect(bootFileList(rows, 'phone')).toEqual(['a', 'a']);
  expect(bootLateReads(rows, 'phone', 'ktx2')).toEqual(['k']);
  expect(bootLateReads(rows, 'desktop', 'ktx2')).toEqual([]);
  expect(bootFileList(['x', 'x'], 'phone')).toEqual(['x', 'x']);
  expect(bootFileList(tier => [tier], 'phone')).toEqual(['phone']);
  expect(bootLateReads(undefined, 'phone')).toEqual([]);
  expect(bootLateReads((tier, mode) => [tier, mode ?? 'unset'], 'desktop')).toEqual(['desktop', 'unset']);
});

test('offline recipes use supplied file facts without installing application services', () => {
  const recipes = { image: { source: { urls: ['/offline/a.png'] }, map: ['gpu'] as const, present: true } };
  const table = { phone: { '/offline/a.phone.webp': '/offline/a.ktx2' }, desktop: {} };
  const inputs = { inventory: { '/offline/a.png': 10, '/offline/a.phone.webp': 5, '/offline/a.ktx2': 3 } };
  expect(resolveBootFiles(recipes, 'image', 'phone', 'img', table, inputs)).toEqual(['/offline/a.phone.webp']);
  expect(resolveBootFiles(recipes, 'image', 'phone', 'ktx2', table, inputs)).toEqual(['/offline/a.ktx2']);
  expect(resolveBootFiles(recipes, 'image', 'phone', 'img', table, { inventory: {} })).toEqual([]);
});

test('published island plans are product files, never page late reads (iPhone downloads I8)', () => {
  const compiled = driftwoodBootInventory({ [ISLAND_PLAN_FILES.phone.url]: true, [ISLAND_PLAN_FILES.desktop.url]: true });
  for (const tier of ['phone', 'desktop'] as const) for (const mode of ['img', 'ktx2'] as const) {
    expect(bootLateReads(compiled.lateReads, tier, mode)).toEqual([]);
  }
});

test('boot discovery uses fresh supplied inventory and has no source-file bindings', () => {
  expect(manifest.bindings.boot).toEqual({ files: { program: true }, sources: { program: true }, lateReads: { program: true } });
  expect(manifest.bindings.poses).toEqual({ program: true });
  const urls = ['/assets/baked/driftwood-isle/tex/sample.webp'];
  const ctx = { inputFiles: () => urls };
  const first = driftwoodBootProgram(ctx);
  expect(first['boot.files']).toEqual(driftwoodBootInventory({ [urls[0] ?? '']: true }).files);
  urls.push('/assets/baked/driftwood-isle/tex/second.webp');
  expect(driftwoodBootProgram(ctx)['boot.files']).not.toEqual(first['boot.files']);
  expect(first.poses).toEqual(original.poses);
  expect(() => driftwoodBootProgram({})).toThrow('public inventory capability');
});


test('boot authoring requires the caller inventory before selecting any recipe', () => {
  expect(() => { Reflect.apply(driftwoodBootInventory, undefined, []); }).toThrow('Boot authoring requires an explicit inventory');
});
