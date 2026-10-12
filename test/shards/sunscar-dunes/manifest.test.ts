// oxlint-disable-next-line import/no-nodejs-modules -- Verify the manifest's static startup dependency graph.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate the private check export.
import { cwd } from 'node:process';
import { describe, expect, it, beforeAll } from 'vitest';
import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { installDeclaredBakedTerrain } from '@wildshard/engine/world/bakedTerrainField';
import manifest from '../../../src/shards/sunscar-dunes/manifest';
import { CUES } from '../../../src/shards/sunscar-dunes/data/cues';
import { manifestClosure } from '../../../scripts/gen-shards.mjs';

describe('node-safe Signal Dunes manifest', () => {
  beforeAll(() => {
    const terrain = manifest.ground.terrain;
    if (terrain === undefined) throw new Error('Missing declared Signal ground');
    const bytes = readFileSync(`${cwd()}/public/assets/baked/sunscar-dunes/terrain.bin`);
    const grid = parseBakedTerrain(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    if (grid === null) throw new Error('Malformed required Signal ground');
    installDeclaredBakedTerrain(terrain, grid);
  });
  it('declares the original weapon cue IDs as serializable data', () => {
    expect(manifest.audio?.cues).toEqual(CUES);
    expect(JSON.stringify(manifest.audio?.cues)).toBe(JSON.stringify(CUES));
  });
  it('declares its empty audio inventory as serializable data', () => {
    expect(manifest.boot?.audio).toEqual([]);
    expect(JSON.stringify(manifest.boot?.audio)).toBe('[]');
  });
  it('imports buildTerrain from its module only (no barrel) and keeps the plugin out of its startup closure', { timeout: 30_000 }, () => {
    const root = cwd();
    expect(readFileSync(`${root}/src/shards/sunscar-dunes/manifest.ts`, 'utf8')).toContain("import { buildTerrain } from '@wildshard/engine/world/terrainField'");
    const closure = manifestClosure(root)['sunscar-dunes'];
    expect(closure).toContain('src/engine/world/terrainField.ts');
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
