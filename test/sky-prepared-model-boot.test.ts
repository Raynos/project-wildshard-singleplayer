// oxlint-disable-next-line import/no-nodejs-modules -- Verify the authored source entry and frozen legacy URL.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Supply the actual author project and declared native root.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { bootFileList, bootSourceFiles, bootLateReads } from '../src/engine/boot/filePolicy';
import { parseDiscoveryValues } from '../src/format/discoveryValues';
import { readProjectAssets } from '../src/sdk/project';
import { BOOT_FILES, BOOT_SOURCES, LATE_READS, skyProductBoot } from '../src/shards/far-reach/generators/bootInventory';
import { PREPARED_MODELS_URL } from '../src/shards/far-reach/generators/modelFrames';
import { output } from '../src/shards/far-reach/generators/sourceOutput';

const hash = 'bd1a0a75879e2f3e72e2ab2b8d0c18a79d7e7746478b3fedc6961199a714c580';
const owned = `/shardfiles/far-reach/blobs/glb/${hash}.glb`;
const publicFiles = (urls: readonly string[]): string[] => urls.filter(url => url !== PREPARED_MODELS_URL);

test('public boot pack inputs exist before owned products are published', () => {
  const boot = skyProductBoot();
  for (const tier of ['phone', 'desktop'] as const) {
    for (const url of bootFileList(boot['boot.files'], tier)) {
      expect(existsSync(resolve('public', `.${url}`)), url).toBe(true);
    }
  }
});

test('moving the output entry preserves the complete original physics declaration', () => {
  const bytes = output.platform.files.get('sections/sim/runtime-plan.json');
  if (bytes === undefined) throw new Error('Missing physics declaration');
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  const baked: unknown = JSON.parse(readFileSync('src/shards/far-reach/data/physics.generated.json', 'utf8'));
  expect(value).toMatchObject({ baked });
});

test('public boot omits only the product-owned geometry across both tiers and texture policies', () => {
  const boot = skyProductBoot();
  expect(parseDiscoveryValues(boot)).toEqual(boot);
  for (const tier of ['phone', 'desktop'] as const) {
    expect(bootFileList(boot['boot.files'], tier)).toEqual(publicFiles(bootFileList(BOOT_FILES, tier)));
    expect(bootFileList(BOOT_FILES, tier).filter(url => url === PREPARED_MODELS_URL)).toHaveLength(1);
    for (const mode of ['img', 'ktx2'] as const) {
      const before = bootSourceFiles(BOOT_SOURCES, tier, mode), after = bootSourceFiles(boot['boot.sources'], tier, mode);
      expect(after).toEqual({ ...before, props: publicFiles(before.props) });
      expect(after.props).not.toContain(owned);
      expect(after.props).not.toContain(PREPARED_MODELS_URL);
      expect(bootLateReads(boot['boot.lateReads'], tier, mode)).toEqual(LATE_READS);
    }
  }
});

test('actual SDK source entry binds boot discovery to the admitted complete geometry', async () => {
  const built = await readProjectAssets(resolve('src/shards/far-reach'), undefined, {
    folder: 'far-reach', imageRoots: [{ prefix: '/assets/', directory: resolve('public/assets') }],
  });
  const file = built.output.namedFiles?.find(row => row.name === 'world/geometry/prepared-models.glb');
  if (file === undefined) throw new Error('Missing owned prepared geometry');
  expect(file.hash).toBe(hash);
  expect(`/shardfiles/far-reach/${file.path}`).toBe(owned);
  expect(built.output.discovery).toEqual(skyProductBoot());
  expect(built.assets.get(hash)).toEqual(new Uint8Array(readFileSync('public/assets/far-reach/baked/prepared-models.glb')));
  expect(built.shard.files.find(row => row.hash === hash)).toMatchObject({
    compressed: 10_134_100, decoded: 10_134_072, gpu: 10_096_780, triangles: 203_025, draws: 48,
  });
});
