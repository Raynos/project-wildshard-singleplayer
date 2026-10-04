// oxlint-disable-next-line import/no-nodejs-modules -- Reads the committed exemption list.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CELL_ABOVE, CELL_BELOW, CELL_HEIGHT, CHUNK_HALF, ROAD_LENGTH, ROAD_WIDTH } from '#engine/data';
import { SHARDS } from '../../src/shards.generated';

// SHARD-PLATFORM SP4: the world contract (MMO-REQUIREMENTS W1, W4). Every level fits the 500 × 500 × 500 m cell, and
// its height field is level with the highway (y = 0) across the 15 m road at each edge midpoint, at least 50 m in.
// The walk itself (colliders, water, structures) is SP10's validator; this is the ground's half.
const exemptions = (JSON.parse(readFileSync('lint/edge-exemptions.json', 'utf8')) as { levels: Record<string, string> }).levels;
interface Field { heightAt: (x: number, z: number) => number }
const fieldOf = (ground: unknown): Field | null => {
  const terrain: unknown = typeof ground === 'object' && ground !== null && 'terrain' in ground ? ground.terrain : null;
  return typeof terrain === 'object' && terrain !== null && 'heightAt' in terrain && typeof terrain.heightAt === 'function' ? (terrain as Field) : null;
};
const EDGES = [['north', 0, -1], ['south', 0, 1], ['east', 1, 0], ['west', -1, 0]] as const;

describe('SP4 the world contract', () => {
  it('splits the 500 m cell evenly around the highway level (Jake, O1)', () => {
    expect([CELL_HEIGHT, CELL_BELOW, CELL_ABOVE]).toEqual([500, 250, 250]);
  });
  it('exempts only levels that exist', () => {
    expect(Object.keys(exemptions).filter((slug) => !SHARDS.some((m) => m.slug === slug))).toEqual([]);
  });
  it.each(SHARDS.map((m) => [m.slug, m] as const))('%s: ground inside the cell, edge entries level with the highway', (slug, manifest) => {
    const field = fieldOf(manifest.ground);
    if (!field) return; // a structures-only level has no height field; its edges are the validator's walk (SP10)
    const outside: string[] = [];
    for (let x = -CHUNK_HALF; x <= CHUNK_HALF; x += 25) for (let z = -CHUNK_HALF; z <= CHUNK_HALF; z += 25) {
      const h = field.heightAt(x, z);
      if (h < -CELL_BELOW || h > CELL_ABOVE) outside.push(`(${x}, ${z}) ${h.toFixed(1)} m`);
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
