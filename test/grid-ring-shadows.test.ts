import { expect, it } from 'vitest';
import { CONTENT_CAPS as C } from '../src/engine/core/config';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { RenderRings, type RingCell, type RingTile, type RingView } from '../src/game/grid/rings';
import { terrainResidency } from '../src/game/shardfile/residency';

/**
 * G111 (SHARD-PLATFORM §10): the ~80 m shadow limit applies to NEIGHBOUR shards; the shard you stand in keeps today's
 * shadows. The home cell boots through the normal shard flow (its own casters, its own residency disc), so it is never a
 * ring cell; the rings carry only the eight neighbours, and among their tiles only an L0 tile within `shadowRadius` of the
 * player casts (L1 tiles and far proxies never do). A neighbour you have crossed into (a shardfile cell, G108 C3) casts
 * by the same 80 m disc its standalone client uses (`terrainResidency`), so it keeps today's shadows too.
 */
const cells: RingCell[] = [];
for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) cells.push({ instance: `cell${x + 1}${z + 1}`, origin: { x: x * C.pitch, z: z * C.pitch } });
const HOME = 'cell11';

function rings(): { step: (x: number, z: number) => void; casting: () => Map<string, boolean> } {
  const casting = new Map<string, boolean>();
  const neighbours = cells.filter((cell) => cell.instance !== HOME);
  const ring = new RenderRings<RingTile>(neighbours, new ResidencyAllocator(), () => 1_000, {
    fetch: (tile, done) => { done(tile); },
    upload: (tile): RingView => {
      casting.set(tile.key, false); // every view is installed not casting (clientRings: views.terrain(…, false))
      return { mask: () => undefined, shadow: (enabled) => { casting.set(tile.key, enabled); }, dispose: () => { casting.delete(tile.key); } };
    },
  }, { uploadsPerFrame: 64, uploadBytesPerFrame: Infinity, maxInFlight: 256 });
  return { step: (x, z) => { for (let i = 0; i < 40; i++) ring.step({ x, z, vx: 0, vz: 0 }); }, casting: () => casting };
}

it('G111: the home cell is never a ring cell; neighbours cast only from L0 tiles inside the 80 m disc', () => {
  const r = rings();
  // stand inside the home cell, 20 m from its east edge: the east neighbour's near tiles are inside 150 m
  const half = 250, x = half - 20, z = 0;
  r.step(x, z);
  const casting = r.casting();
  expect([...casting.keys()].some((key) => key.startsWith(`${HOME}:`))).toBe(false);
  let near = 0;
  for (const [key, cast] of casting) {
    const [instance = '', rest = ''] = key.split(':'), cell = cells.find((c) => c.instance === instance);
    if (cell === undefined) throw new Error(`unknown cell ${instance}`);
    if (rest === 'far' || rest.startsWith('l1/')) { expect(cast, key).toBe(false); continue; }
    const [, tx = 0, tz = 0] = rest.split('/').map(Number);
    const lx = x - cell.origin.x, lz = z - cell.origin.z, size = C.l0.size, minX = -half + tx * size, minZ = -half + tz * size;
    const d = Math.hypot(Math.max(minX - lx, 0, lx - minX - size), Math.max(minZ - lz, 0, lz - minZ - size));
    expect(cast, `${key} at ${d.toFixed(1)} m`).toBe(d <= C.shadowRadius);
    if (cast) near++;
  }
  expect(near).toBeGreaterThan(0); // the east neighbour's edge tiles within 80 m do cast
  expect(C.shadowRadius).toBe(80);
});

it('G111: a neighbour you crossed into casts by its standalone 80 m disc (today\'s shadows for a shardfile shard)', () => {
  const r = rings();
  const east = cells.find((c) => c.instance === 'cell21');
  if (east === undefined) throw new Error('no east cell');
  for (const [lx, lz] of [[0, 0], [-180, 60], [120, -200]] as const) {
    r.step(east.origin.x + lx, east.origin.z + lz);
    const ringCasting = new Set([...r.casting()].filter(([key, cast]) => cast && key.startsWith('cell21:l0/')).map(([key]) => key.replace('cell21:l0/', '0/')));
    expect([...ringCasting].sort()).toEqual([...terrainResidency(lx, lz).shadows].sort());
  }
});
