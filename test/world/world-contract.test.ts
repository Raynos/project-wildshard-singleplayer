// oxlint-disable-next-line import/no-nodejs-modules -- Reads the committed exemption list.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CELL_ABOVE, CELL_BELOW, CELL_HEIGHT, CHUNK_HALF, ROAD_LENGTH, ROAD_WIDTH } from '../../src/engine/core/config';
import { toLevelSpec } from '../../src/game/shard/spec';
import type { ShardManifest } from '../../src/game/shard/manifest';
import { TEMPLATE } from '../../src/shards/_template/manifest';
import { SHARDS } from '../../src/shards.generated';

// SHARD-PLATFORM SP4: the world contract (MMO-REQUIREMENTS W1, W4). Every level fits the 500 × 500 × 500 m cell, and
// its height field is level with the highway (y = 0) across the 15 m road at each edge midpoint, at least 50 m in.
// The walk itself (colliders, water, structures) is SF8c's validator; this is the ground's half.
const exemptions = (JSON.parse(readFileSync('lint/edge-exemptions.json', 'utf8')) as { levels: Record<string, string> }).levels;
interface Field { heightAt: (x: number, z: number) => number }
const fieldOf = (ground: unknown): Field | null => {
  const terrain: unknown = typeof ground === 'object' && ground !== null && 'terrain' in ground ? ground.terrain : null;
  return typeof terrain === 'object' && terrain !== null && 'heightAt' in terrain && typeof terrain.heightAt === 'function' ? (terrain as Field) : null;
};
// These worlds draw authored structures; a flat placement datum proves no walkable ground.
const STRUCTURE_LEVELS = new Set(['nine-dragon-stack', 'far-reach']);
function structureFailures(manifest: Pick<ShardManifest, 'ground' | 'bounds' | 'spawn'> & { slug: string }): string[] {
  if (manifest.ground.structures === undefined) return [];
  const failures: string[] = [];
  if (!STRUCTURE_LEVELS.has(manifest.slug)) failures.push('undrawn ground needs a named structure-level exception');
  const b = manifest.bounds;
  if (b === undefined) return [...failures, 'structure world needs declared bounds'];
  if (![b.x0, b.x1, b.z0, b.z1, b.floor, manifest.spawn.y ?? 0].every(Number.isFinite) ||
      b.x0 < -CHUNK_HALF || b.x1 > CHUNK_HALF || b.z0 < -CHUNK_HALF || b.z1 > CHUNK_HALF ||
      b.x0 >= b.x1 || b.z0 >= b.z1 || b.floor < -CELL_BELOW || b.floor > CELL_ABOVE ||
      (manifest.spawn.y ?? 0) > CELL_ABOVE || (manifest.spawn.y ?? 0) < b.floor) failures.push('structure bounds outside the cell');
  return failures;
}
const EDGES = [['north', 0, -1], ['south', 0, 1], ['east', 1, 0], ['west', -1, 0]] as const;

describe('SP4 the world contract', () => {
  it('splits the 500 m cell evenly around the highway level (Jake, O1)', () => {
    expect([CELL_HEIGHT, CELL_BELOW, CELL_ABOVE]).toEqual([500, 250, 250]);
  });
  it('rejects an undrawn flat datum in an unlisted level', () => {
    expect(structureFailures({ ...TEMPLATE, slug: 'new-flat-datum', ground: { ...TEMPLATE.ground, structures: true } })).toContain('undrawn ground needs a named structure-level exception');
  });
  it('checks named structures against the cell rather than accepting their analytic datum', () => {
    const fixture = { ...TEMPLATE, slug: 'nine-dragon-stack', ground: { ...TEMPLATE.ground, structures: true as const } };
    expect(structureFailures(fixture)).toEqual([]);
    for (const bounds of [
      { x0: -251, x1: 100, z0: -100, z1: 100, floor: -10 },
      { x0: -100, x1: 100, z0: -100, z1: 251, floor: -10 },
      { x0: -100, x1: 100, z0: -100, z1: 100, floor: -251 },
    ]) expect(structureFailures({ ...fixture, bounds })).toContain('structure bounds outside the cell');
    expect(structureFailures({ slug: fixture.slug, ground: fixture.ground, spawn: fixture.spawn })).toContain('structure world needs declared bounds');
  });
  it('declares the template 500³ without changing the runtime world', () => {
    expect(TEMPLATE.placement.size).toEqual([500, 500, 500]);
    const oldSize: ShardManifest = { ...TEMPLATE, placement: { grid: [0, 0], size: [200, 200, 200] } };
    expect(toLevelSpec(TEMPLATE)).toEqual(toLevelSpec(oldSize));
  });
  it('exempts only levels that exist', () => {
    expect([...Object.keys(exemptions), ...STRUCTURE_LEVELS].filter((slug) => !SHARDS.some((m) => m.slug === slug))).toEqual([]);
  });
  it.each(SHARDS.map((m) => [m.slug, m] as const))('%s: ground inside the cell, edge entries level with the highway', (slug, manifest) => {
    expect(structureFailures(manifest)).toEqual([]);
    if (manifest.ground.structures !== undefined) return; // explicitly named, checked against structural bounds above
    const field = fieldOf(manifest.ground);
    if (!field) return; // a structures-only level has no height field; its edges are the validator's walk (SF8c)
    const outside: string[] = [];
    for (let x = -CHUNK_HALF; x <= CHUNK_HALF; x += 25) for (let z = -CHUNK_HALF; z <= CHUNK_HALF; z += 25) {
      const h = field.heightAt(x, z);
      if (!Number.isFinite(h) || h < -CELL_BELOW || h > CELL_ABOVE) outside.push(`(${x}, ${z}) ${h.toFixed(1)} m`);
    }
    expect(outside).toEqual([]);
    if (slug in exemptions) return;
    const uneven: string[] = [];
    for (const [edge, fx, fz] of EDGES) for (let d = 0; d <= Math.min(ROAD_LENGTH, 50); d += 5) for (let a = -ROAD_WIDTH / 2; a <= ROAD_WIDTH / 2; a += 2.5) {
      const along = CHUNK_HALF - d, x = fx === 0 ? a : fx * along, z = fz === 0 ? a : fz * along;
      const h = field.heightAt(x, z);
      if (Math.abs(h) > 1) uneven.push(`${edge} ${d} m in, ${a} m across: ${h.toFixed(2)} m`);
    }
    expect(uneven).toEqual([]);
  });
});
