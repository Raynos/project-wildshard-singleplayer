// oxlint-disable-next-line import/no-nodejs-modules -- Isolated author file emission fixture, cleaned in finally.
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- CI gets an isolated fixture directory; local lanes can supply their own scratch root.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the explicit fixture directory.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Author APIs consume file URLs.
import { pathToFileURL } from 'node:url';
// oxlint-disable-next-line import/no-nodejs-modules -- The local proof can select its lane-owned scratch root.
import process from 'node:process';
import { expect, it } from 'vitest';
import { bakeScriptModule } from '../src/sdk/compileScript';
import { FAN_GUST_MODULE } from '../src/shards/far-reach/data/fanGustModule';

it('writes only exact admitted script bytes and refuses crossed pins before emitting files', async () => {
  const root = mkdtempSync(join(process.env['WS_TEST_SCRATCH'] ?? tmpdir(), 'sdk-script-bake-'));
  try {
    const source = pathToFileURL(join(root, 'action.as')), assets = pathToFileURL(`${join(root, 'assets')}/`);
    writeFileSync(source, readFileSync(new URL('../src/shards/far-reach/behaviour/fanGust.as', import.meta.url)));
    const wrong = { ...FAN_GUST_MODULE, hash: '0'.repeat(64) };
    await expect(bakeScriptModule(source, assets, wrong, { maximumPages: 1 })).rejects.toThrow('authored module address');
    expect(existsSync(assets)).toBe(false);
    const bytes = await bakeScriptModule(source, assets, FAN_GUST_MODULE, { maximumPages: 1 });
    expect([...readFileSync(new URL(FAN_GUST_MODULE.hash, assets))]).toEqual([...bytes]);
    await expect(bakeScriptModule(source, assets, { ...FAN_GUST_MODULE, bytes: 628 }, { maximumPages: 1 })).rejects.toThrow('authored module address');
    expect([...readFileSync(new URL(FAN_GUST_MODULE.hash, assets))]).toEqual([...bytes]);
    await expect(bakeScriptModule(source, new URL('https://invalid.example/'), FAN_GUST_MODULE)).rejects.toThrow('destination or pin');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
