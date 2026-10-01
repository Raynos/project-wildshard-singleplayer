// oxlint-disable-next-line import/no-nodejs-modules -- Verify the manifest's static startup dependency graph.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate the private check export.
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import manifest from '#shards/sunscar-dunes/manifest';
import { manifestClosure } from '../../../scripts/gen-shards.mjs';
import { SPAWN, TOWER } from '#shards/sunscar-dunes/layout';

describe('node-safe Signal Dunes manifest', () => {
  it('imports the data entry only and keeps the plugin out of its startup closure', () => {
    const root = cwd();
    expect(readFileSync(`${root}/src/shards/sunscar-dunes/manifest.ts`, 'utf8')).toContain("import { buildTerrain } from '#engine/data'");
    const closure = manifestClosure(root)['sunscar-dunes'];
    expect(closure).toContain('src/engine/data.ts');
    expect(closure).not.toContain('src/engine/index.ts');
    expect(closure).not.toContain('src/shards/sunscar-dunes/plugin.ts');
  });
  it('keeps every dune face walkable between the spawn and the tower (max climb 40°)', () => {
    const terrain = manifest.ground.terrain; if (!terrain) throw new Error('no terrain');
    let steepest = 0;
    for (let x = -140; x <= 140; x += 2) for (let z = -140; z <= 140; z += 2) {
      const dx = (terrain.heightAt(x + 0.5, z) - terrain.heightAt(x - 0.5, z)), dz = (terrain.heightAt(x, z + 0.5) - terrain.heightAt(x, z - 0.5));
      steepest = Math.max(steepest, Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI);
    }
    expect(steepest).toBeLessThan(36);
    expect(Math.hypot(TOWER.x - SPAWN.x, TOWER.z - SPAWN.z)).toBeGreaterThan(120);
  });
  it('declares standing capture poses in degrees', async () => {
    const poses = await manifest.dev?.poses();
    expect(Object.keys(poses ?? {})).toEqual(['spawn', 'whip', 'ray', 'quest', 'tower']);
    expect(poses?.['spawn']?.feet).toBeDefined(); expect(poses?.['tower']?.feet).toBeUndefined();
  });
});
