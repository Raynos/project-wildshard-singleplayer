import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the actual cold producer prerequisite order.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { driftwoodBootInventory } from '../src/shards/driftwood-isle/generators/bootInventory';
import { DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES } from '../src/shards/driftwood-isle/generators/bootRecipes';
import { GPU_FILES } from '../src/shards/driftwood-isle/ktx2.generated';
import { bootFileList, bootLateReads, bootSourceFiles, resolveBootFiles, resolveBootSources } from '../src/engine/boot/filePolicy';
import sources from '../src/shards/driftwood-isle/data/boot-sources.generated.json' with { type: 'json' };
import files from '../src/shards/driftwood-isle/data/boot-files.generated.json' with { type: 'json' };
import lateReads from '../src/shards/driftwood-isle/data/boot-lateReads.generated.json' with { type: 'json' };
import ISLAND_PLAN_FILES from '../src/shards/driftwood-isle/data/islandPlanFiles.json' with { type: 'json' };

test('offline boot rows preserve ordered sources and filtered late reads for all four choices', () => {
  expect({ sources, files, lateReads }).toEqual(driftwoodBootInventory());
  for (const tier of ['phone', 'desktop'] as const) for (const mode of ['img', 'ktx2'] as const) {
    const expected = resolveBootSources(DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES, tier, mode, GPU_FILES);
    const named = new Set(['reef', 'ground', 'palms', 'hibiscus', 'cover'].flatMap(group => resolveBootFiles(DRIFTWOOD_BOOT_FILES, group, tier, mode, GPU_FILES)));
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

test('declared published plans are selected before their geometry job materializes them', () => {
  const compiled = driftwoodBootInventory({ [ISLAND_PLAN_FILES.phone.url]: true, [ISLAND_PLAN_FILES.desktop.url]: true });
  for (const tier of ['phone', 'desktop'] as const) for (const mode of ['img', 'ktx2'] as const) {
    expect(bootLateReads(compiled.lateReads, tier, mode)).toEqual([ISLAND_PLAN_FILES[tier].url]);
  }
});

test('boot JSON is generated before every offline manifest consumer and copied into its input closure', () => {
  const { jobs } = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), command: v.array(v.string()), inputRoots: v.array(v.string()) })) }),
    JSON.parse(readFileSync(new URL('../scripts/generation-jobs.json', import.meta.url), 'utf8')));
  const bootstrap = jobs.findIndex(job => job.id === 'driftwood-boot-inventory');
  expect(bootstrap).toBeGreaterThanOrEqual(0);
  const consumers = jobs.filter(job => job.command.includes('./scripts/generation-level.mjs') && job.command.includes('--generation-shard=driftwood-isle'));
  expect(consumers.length).toBeGreaterThan(0);
  for (const job of consumers) {
    expect(jobs.indexOf(job)).toBeGreaterThan(bootstrap);
    for (const name of ['files', 'sources', 'lateReads', 'poses']) {
      const output = `src/shards/driftwood-isle/data/boot-${name}.generated.json`;
      expect(job.inputRoots.some(root => output === root || output.startsWith(`${root}/`))).toBe(true);
    }
  }
});
