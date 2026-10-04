import { describe, expect, it } from 'vitest';
import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '../../../src/engine/core/config';
import { contentHash } from '../../../src/sdk/project';
import { validateShardfileAssets } from '../../../src/game/shardfile/validate';
import { validateSocketLandings } from '../../../src/game/shardfile/entryLanding';
import { validateEntrywayClearance } from '../../../src/game/shardfile/entryClearance';
import { ENTRY_RAMPS, SWITCHBACK } from '../../../src/shards/far-reach/world/ramps';
import { entryColliders } from '../../../src/shards/far-reach/world/entries';
import { rimAlong } from '../../../src/shards/far-reach/layout';
import source from '../../../src/shards/far-reach/shard.config';

// SHARD-PLATFORM SF49-g (Jake's G99 / G102): Sky Reach's four switchback entries, from a road-level landing at each edge
// midpoint up to the nearest island.
const MAX_CLIMB = 40, deg = (rise: number, run: number): number => (Math.atan2(Math.abs(rise), run) * 180) / Math.PI;

describe('Sky Reach switchback entries', () => {
  it('declares four sockets over the void, each proven by a full-width road landing at y = 0', () => {
    expect(source.entryways.map((row) => [row.edge, row.kind, row.width])).toEqual(['north', 'east', 'south', 'west'].map((edge) => [edge, 'socketOverWater', ENTRY_WIDTH]));
    expect(source.accent).toBe('pink'); // G104: 18 PINK
    expect(() => validateShardfileAssets(source, new Map(), contentHash)).not.toThrow();
    // no landing, one 0.5 m short of the full 8 m, or one 1 cm proud of the road: refused
    expect(() => validateShardfileAssets({ ...source, props: null }, new Map(), contentHash)).toThrow('full-width collision landing');
    const props = source.props; if (props === null) throw new Error('Sky Reach declares its landings');
    const shifted = (dy: number, dt: number) => ENTRY_RAMPS.map(({ edge, landing: l }) => {
      const k = edge === 'north' ? 1 : 0;
      return { id: `landing.${edge}`, panel: null, initialActive: true, shapes: [{ kind: 'box' as const, x: l.x + k * dt, y: l.y + k * dy, z: l.z, hx: l.hx, hy: l.hy, hz: l.hz, surface: l.surface }] };
    });
    expect(() => validateSocketLandings({ ...source, props: { ...props, colliders: shifted(0, 9.5) } }, new Map())).toThrow('full-width collision landing');
    expect(() => validateSocketLandings({ ...source, props: { ...props, colliders: shifted(0.01, 0) } }, new Map())).toThrow('full-width collision landing');
  });

  it('keeps every deck, rail and the landing inside the cell and out of the 8 × 15 m socket above road height', () => {
    const shapes: { kind: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; rot?: { x: number; y: number; z: number; w: number }; surface: 'wood' }[] = [];
    for (const c of ENTRY_RAMPS.flatMap(entryColliders)) {
      if (c.kind !== 'box') throw new Error('entries are boxes');
      const shape: (typeof shapes)[number] = { kind: 'box', x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, surface: 'wood' };
      if (c.rot !== undefined) shape.rot = c.rot;
      shapes.push(shape);
    }
    for (const s of shapes) expect(Math.max(Math.abs(s.x), Math.abs(s.z)) + Math.hypot(s.hx, s.hy, s.hz)).toBeLessThan(CHUNK_HALF);
    const props = source.props; if (props === null) throw new Error('Sky Reach declares its landings');
    const all = { ...props, colliders: [{ id: 'entries', panel: null, initialActive: true, shapes }] };
    expect(() => validateEntrywayClearance({ entryways: source.entryways, props: all, water: [] }, new Map())).not.toThrow();
  });

  it('is walkable: gentle flights, level turn landings, a causeway onto each island top', () => {
    for (const entry of ENTRY_RAMPS) {
      expect(entry.flights % 2).toBe(0); expect(entry.flights).toBeGreaterThanOrEqual(2);
      for (const slab of entry.slabs) {
        const run = Math.hypot(slab.b.x - slab.a.x, slab.b.z - slab.a.z);
        expect(deg(slab.b.y - slab.a.y, run)).toBeLessThanOrEqual(12); // a flight 11.3°, the causeway ≤ 8°
      }
      // the walk climbs from the landing's road height to the island's deck without a step taller than the controller's
      const path = entry.path, first = path[0], last = path[path.length - 1];
      expect(first?.y).toBe(0); expect(last?.y).toBe(entry.isle.y);
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i]; if (a === undefined || b === undefined) throw new Error('path');
        expect(deg(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z))).toBeLessThan(MAX_CLIMB / 3);
      }
      // the walk ends on the island's top (inside its rim), and starts on the socket's far edge at the midpoint
      if (last === undefined || first === undefined) throw new Error('path');
      expect(Math.hypot(last.x - entry.isle.x, last.z - entry.isle.z)).toBeLessThan(rimAlong(entry.isle, Math.atan2(last.z - entry.isle.z, last.x - entry.isle.x)));
      expect(Math.max(Math.abs(first.x), Math.abs(first.z))).toBeCloseTo(CHUNK_HALF - ENTRY_ASPHALT - 0.5, 9);
      expect(Math.min(Math.abs(first.x), Math.abs(first.z))).toBe(0);
      // stacked flights of a lane leave head room
      expect(2 * SWITCHBACK.rise - SWITCHBACK.deck).toBeGreaterThan(2.5);
    }
    expect(ENTRY_RAMPS.map((e) => [e.edge, e.isle.id, e.flights])).toEqual([['north', 'sunrest', 4], ['east', 'roost', 6], ['south', 'crown', 14], ['west', 'grove', 4]]);
  });
});
