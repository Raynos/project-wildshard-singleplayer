// oxlint-disable-next-line import/no-nodejs-modules -- Verify public inputs and the original physics declaration.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the public pack inputs before product publication.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { bootFileList, bootSourceFiles, bootLateReads } from '../src/engine/boot/filePolicy';
import { parseDiscoveryValues } from '../src/format/discoveryValues';
import { BOOT_FILES, BOOT_SOURCES, LATE_READS, skyProductBoot } from '../src/shards/far-reach/generators/bootInventory';
import { BAKED_PIECES, BAKED_URLS, FAN_URL } from '../src/shards/far-reach/generators/fileInventory';
import { PREPARED_MODELS_URL } from '../src/shards/far-reach/generators/modelFrames';
import { BRIDGE_REST_URL, MILL_REST_URL } from '../src/shards/far-reach/generators/restFiles';
import { output } from '../src/shards/far-reach/generators/sourceOutput';
import { GPU_FILES } from '../src/shards/far-reach/ktx2.generated';
import { MANIFEST } from '../src/shards/far-reach/discovery.generated';
import { prepareShardAssets } from '../src/game/shard/load';
import { nameBlob } from '../src/sdk/blobs';
import { originalSkyRigs } from './fixtures/sky-original-rigs';
import { skyRigAssetSources } from '../src/shards/far-reach/generators/rigAssetSources';

const hash = 'bd1a0a75879e2f3e72e2ab2b8d0c18a79d7e7746478b3fedc6961199a714c580';
const owned = `/shardfiles/far-reach/blobs/glb/${hash}.glb`;
const ownedPublic = [PREPARED_MODELS_URL, ...BAKED_PIECES.map(piece => BAKED_URLS[piece]), BRIDGE_REST_URL, MILL_REST_URL, FAN_URL];
const publicFiles = (urls: readonly string[]): string[] => urls.filter(url => !ownedPublic.includes(url));

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

test('public boot omits all fourteen owned geometry files across both tiers and texture policies', () => {
  const boot = skyProductBoot();
  expect(parseDiscoveryValues(boot)).toEqual(boot);
  for (const tier of ['phone', 'desktop'] as const) {
    expect(bootFileList(boot['boot.files'], tier)).toEqual(publicFiles(bootFileList(BOOT_FILES, tier)));
    for (const url of ownedPublic) expect(bootFileList(BOOT_FILES, tier).filter(file => file === url)).toHaveLength(1);
    for (const mode of ['img', 'ktx2'] as const) {
      const before = bootSourceFiles(BOOT_SOURCES, tier, mode), after = bootSourceFiles(boot['boot.sources'], tier, mode);
      expect(after).toEqual({ ...before, props: publicFiles(before.props) });
      expect(after.props).not.toContain(owned);
      for (const url of ownedPublic) expect(after.props).not.toContain(url);
      expect(bootLateReads(boot['boot.lateReads'], tier, mode)).toEqual(LATE_READS);
    }
  }
});


test('receipt-owned GPU discovery registers the admitted rig table for both tiers', async () => {
  const blobs = [...originalSkyRigs()].map(([name, bytes]) => nameBlob(`world/rigs/${name}`, 'glb', bytes));
  const expected = skyRigAssetSources(blobs.map(blob => blob.file), GPU_FILES), boot = skyProductBoot(expected);
  expect(boot.ktx2).toEqual(expected.gpuFiles);
  expect(parseDiscoveryValues(boot).ktx2).toEqual(expected.gpuFiles);
  if (MANIFEST.ktx2 === undefined) throw new Error('Missing native GPU callback');
  expect((await MANIFEST.ktx2()).GPU_FILES).toEqual(expected.gpuFiles);
  expect(MANIFEST.boot?.sources).toEqual(boot['boot.sources']);
  const registered: unknown[] = [];
  await prepareShardAssets(MANIFEST, table => { registered.push(table); });
  await prepareShardAssets(MANIFEST, table => { registered.push(table); });
  expect(registered).toEqual([expected.gpuFiles]);
  for (const tier of ['phone', 'desktop'] as const) {
    for (const [source, target] of Object.entries(boot.ktx2[tier])) {
      for (const url of [source, target]) {
        if (url.startsWith('/shardfiles/far-reach/')) expect(blobs.some(blob => `/shardfiles/far-reach/${blob.file.path}` === url), url).toBe(true);
        else expect(existsSync(resolve('public', `.${url}`)), url).toBe(true);
      }
    }
  }
});
