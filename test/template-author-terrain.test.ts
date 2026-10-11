// oxlint-disable-next-line import/no-nodejs-modules -- Compare the authored output with every shipped immutable byte.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Native immutable-byte comparison uses Node buffers.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- The audit inspects this exact producer source root.
import process from 'node:process';
import { expect, it } from 'vitest';
import { buildTerrain } from '../src/engine/world/terrainField';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { templateHeightAt } from '../src/shards/_template/generators/landscape';
import { cellGround } from '../src/shards/_template/generators/ground';
import { templateTerrain } from '../src/shards/_template/generators/terrain';
import { TRAIL } from '../src/shards/_template/data/layout';

it('preserves the native height law at every baked vertex and off-grid pool, trail and road points', () => {
  const heightAt = templateHeightAt();
  const native = buildTerrain(357, { landscape: (x, z, { n }) => Math.hypot(x - 25, z - 20) < 5 ? -3 : n.get(x * 0.015, z * 0.015) * 0.5, trails: TRAIL, cabinSites: [], finish: cellGround });
  for (let z = 0; z < 257; z++) for (let x = 0; x < 257; x++) {
    const px = -250 + x * 500 / 256, pz = -250 + z * 500 / 256;
    expect(heightAt(px, pz)).toBe(native.heightAt(px, pz));
  }
  for (let i = 0; i < 1000; i++) {
    const x = -250 + (i * 73.713) % 500, z = -250 + (i * 19.413) % 500;
    expect(heightAt(x, z)).toBe(native.heightAt(x, z));
  }
});

it('regenerates the complete shipped terrain declaration and every immutable terrain byte exactly', () => {
  const { assets, ...rows } = templateTerrain();
  expect(`${JSON.stringify(rows, null, 2)}\n`).toBe(readFileSync('src/shards/_template/data/terrain.json', 'utf8'));
  for (const [hash, bytes] of assets) expect(Buffer.from(bytes), hash).toEqual(readFileSync(`src/shards/_template/assets/${hash}`));
});

it('has no engine, game, trusted runtime or root shard helper in the producer closure', () => {
  const audit = auditAuthoringInputs(process.cwd(), '_template', 'src/shards/_template/generators/bake-template-terrain.mjs');
  expect(audit.issues).toEqual([]);
  expect(audit.files).toContain('src/shards/_template/generators/landscape.ts');
  expect(audit.files.some(file => file.startsWith('src/engine/') || file.startsWith('src/game/') || file.includes('/runtime/'))).toBe(false);
});
