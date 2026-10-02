// oxlint-disable-next-line import/no-nodejs-modules -- Verify the manifest's static startup dependency graph.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate the private check export.
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import manifest from '#shards/sunscar-dunes/manifest';
import { manifestClosure } from '../../../scripts/gen-shards.mjs';

describe('node-safe Signal Dunes manifest', () => {
  it('imports the data entry only and keeps the plugin out of its startup closure', { timeout: 30_000 }, () => {
    const root = cwd();
    expect(readFileSync(`${root}/src/shards/sunscar-dunes/manifest.ts`, 'utf8')).toContain("import { buildTerrain } from '#engine/data'");
    const closure = manifestClosure(root)['sunscar-dunes'];
    expect(closure).toContain('src/engine/data.ts');
    expect(closure).not.toContain('src/engine/index.ts');
    expect(closure).not.toContain('src/shards/sunscar-dunes/plugin.ts');
  });
  it('keeps every dune face walkable across the play square (the player max climb)', () => {
    // The bound is the engine's own climb limit (Player.ts MAX_CLIMB_DEG, Jake's pick), read from its source so it never drifts.
    const climb = /const MAX_CLIMB_DEG = (\d+(?:\.\d+)?);/.exec(readFileSync(`${cwd()}/src/engine/player/Player.ts`, 'utf8'));
    if (!climb?.[1]) throw new Error('MAX_CLIMB_DEG not found in Player.ts');
    const terrain = manifest.ground.terrain; if (!terrain) throw new Error('no terrain');
    let steepest = 0;
    for (let x = -196; x <= 196; x += 2) for (let z = -196; z <= 196; z += 2) {
      const dx = (terrain.heightAt(x + 0.5, z) - terrain.heightAt(x - 0.5, z)), dz = (terrain.heightAt(x, z + 0.5) - terrain.heightAt(x, z - 0.5));
      steepest = Math.max(steepest, Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI);
    }
    expect(steepest).toBeLessThan(Number(climb[1]));
  });
  it('declares standing capture poses in degrees', async () => {
    const poses = await manifest.dev?.poses();
    expect(Object.keys(poses ?? {})).toEqual(['spawn', 'whip', 'ray', 'quest', 'tower']);
    expect(poses?.['spawn']?.feet).toBeDefined(); expect(poses?.['tower']?.feet).toBeUndefined();
  });
});
