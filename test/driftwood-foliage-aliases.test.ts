// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual native loader guard in a fresh Node realm.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { PALM_FILES, palmFilesFrom } from '../src/shards/driftwood-isle/generators/palmFiles';
import { HIBISCUS_FILES, hibiscusFilesFrom } from '../src/shards/driftwood-isle/generators/hibiscusFiles';
import { islandFoliageBatches } from '../src/shards/driftwood-isle/generators/islandDressing';
import { hashImmutableBytes } from '../src/sdk/immutable';
import palms from './fixtures/palmFiles-original.json' with { type: 'json' };
import hibiscus from './fixtures/hibiscusFiles-original.json' with { type: 'json' };

test('owned foliage aliases preserve every original tier, choice and exact payload identity', () => {
  expect(PALM_FILES).toEqual(palms); expect(HIBISCUS_FILES).toEqual(hibiscus);
  const bank = islandFoliageBatches();
  const families = [
    { prefix: 'palm', urls: [...Object.values(PALM_FILES.phone), ...Object.values(PALM_FILES.desktop)] },
    { prefix: 'hibiscus', urls: [...Object.values(HIBISCUS_FILES.phone), ...Object.values(HIBISCUS_FILES.desktop)] },
  ];
  for (const { prefix, urls } of families) for (const url of urls) {
    const name = bank.byUrl[url]; if (name === undefined) throw new Error('Missing owned foliage alias');
    const blob = bank.blobs.get(name); if (blob === undefined) throw new Error('Missing owned foliage bytes');
    expect(url.endsWith(`/${prefix}-${hashImmutableBytes(blob.bytes)}.${blob.kind}`)).toBe(true);
  }
});

test('foliage aliases refuse missing or ambiguous owned content', () => {
  for (const [url, read] of [[PALM_FILES.phone.world, palmFilesFrom], [HIBISCUS_FILES.desktop.small, hibiscusFilesFrom]] as const) {
    const aliases = { ...islandFoliageBatches().byUrl }, name = aliases[url];
    if (name === undefined) throw new Error('Missing original alias control');
    delete aliases[url]; expect(() => read(aliases)).toThrow('requires one owned alias');
    aliases[url] = name; aliases[`/duplicate${url}`] = name;
    expect(() => read(aliases)).toThrow('requires one owned alias');
  }
});

test('cold metadata aliases construct their real bank under the unchanged native renderer guard', () => {
  const code = `import { PALM_FILES } from './src/shards/driftwood-isle/generators/palmFiles.ts';
    import { HIBISCUS_FILES } from './src/shards/driftwood-isle/generators/hibiscusFiles.ts';
    console.log(JSON.stringify({ palms: PALM_FILES, hibiscus: HIBISCUS_FILES }));`;
  const output = execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', code], { encoding: 'utf8', timeout: 30_000 });
  expect(output.trim()).toBe(JSON.stringify({ palms, hibiscus }));
});
