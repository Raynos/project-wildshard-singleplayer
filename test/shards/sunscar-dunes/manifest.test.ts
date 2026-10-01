// oxlint-disable-next-line import/no-nodejs-modules -- Verify the manifest's static startup dependency graph.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate the private check export.
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import manifest from '#shards/sunscar-dunes/manifest';
import { manifestClosure } from '../../../scripts/gen-shards.mjs';

describe('node-safe Signal Dunes manifest', () => {
  it('imports only the data entry and keeps the plugin and look out of its startup closure', () => {
    const root = cwd();
    expect(readFileSync(`${root}/src/shards/sunscar-dunes/manifest.ts`, 'utf8')).toContain("import { buildTerrain } from '#engine/data'");
    const closure = manifestClosure(root)['sunscar-dunes'];
    expect(closure).toContain('src/engine/data.ts');
    expect(closure).not.toContain('src/engine/index.ts');
    expect(closure).not.toContain('src/shards/sunscar-dunes/plugin.ts');
    expect(closure).not.toContain('src/shards/sunscar-dunes/look/render.ts');
  });

  it('keeps the dunes walkable: no sampled slope over 35° across the playable area', () => {
    const terrain = manifest.ground.terrain; if (!terrain) throw new Error('No terrain');
    let steepest = 0;
    for (let x = -230; x <= 230; x += 2) for (let z = -230; z <= 230; z += 2) {
      const h = terrain.heightAt(x, z), dx = terrain.heightAt(x + 1, z) - h, dz = terrain.heightAt(x, z + 1) - h;
      steepest = Math.max(steepest, Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI);
    }
    expect(steepest).toBeLessThan(35);
  });

  it('declares its four board poses in degrees', async () => {
    const poses = await manifest.dev?.poses();
    expect(Object.keys(poses ?? {})).toEqual(['spawn', 'weapon', 'creature', 'quest']);
  });
});
