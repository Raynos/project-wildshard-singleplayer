// oxlint-disable-next-line import/no-nodejs-modules -- Verify the sunscar-dunes manifest's static startup dependency graph.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate the private check export.
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import manifest from '#shards/sunscar-dunes/manifest';
import { manifestClosure } from '../../../scripts/gen-shards.mjs';

describe('node-safe sunscar-dunes manifest', () => {
  it('imports the documented data entry and has no browser runtime in its startup closure', () => {
    const root = cwd();
    expect(readFileSync(`${root}/src/shards/sunscar-dunes/manifest.ts`, 'utf8')).toContain("import { buildTerrain } from '#engine/data'");
    const closure = manifestClosure(root)['sunscar-dunes'];
    expect(closure).toContain('src/engine/data.ts');
    expect(closure).not.toContain('src/engine/index.ts');
    expect(closure).not.toContain('src/engine/core/tier.ts');
    expect(closure).not.toContain('src/shards/sunscar-dunes/plugin.ts');
    expect(manifest.ground.terrain?.heightAt(0, 0)).toBeTypeOf('number');
  });
});
