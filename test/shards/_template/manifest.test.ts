// oxlint-disable-next-line import/no-nodejs-modules -- Verify the template manifest's static startup dependency graph.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate the private check export.
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import manifest from '../../../src/shards/_template/manifest';
import { manifestClosure } from '../../../scripts/gen-shards.mjs';

describe('node-safe template manifest', () => {
  it('discovers a data descriptor without a legacy runtime startup closure', { timeout: 30_000 }, () => {
    const root = cwd(), text = readFileSync(`${root}/src/shards/_template/manifest.ts`, 'utf8');
    expect(manifest.shardfile).toBe('/shardfiles/_template/shard.json');
    expect(text).not.toContain('buildTerrain');
    const closure = manifestClosure(root)['_template'];
    expect(closure).not.toContain('src/engine/core/tier.ts');
    expect(closure).not.toContain('src/shards/_template/plugin.ts');
    expect(closure).not.toContain('src/shards/_template/world/build.ts');
    expect(manifest.load).toBeUndefined();
  });
});
