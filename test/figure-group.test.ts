import { expect, test } from 'vitest';
import * as v from 'valibot';
import { FigureAtlasSchema, FigureGroupSchema, FigureRowSchema } from '../src/format/figures';

/** An unrelated harbour's net-menders: one still mender and a gull-chasing boy on an orbit, as a merged figure group. */
const atlas = (ids: readonly string[]) => ({ url: '/assets/harbour/menders.glb', name: 'harbour-menders', skeleton: 'npc.figures.v1',
  columns: 2, rows: 1, cell: 256, rim: 0.3, bands: 0.7,
  sources: ids.map(id => `/assets/harbour/${id}.glb`), joints: ids.flatMap(id => ['root', 'head', 'arm'].map(part => `${id}-${part}`)) });
const row = (id: string, x: number) => ({ id, name: id, feet: [x, 0, 4], yaw: 1.2, talkHeight: 1.6,
  collider: { kind: 'capsule', y: 0.9, halfHeight: 0.6, radius: 0.3 }, rig: { skeleton: 'npc.figures.v1', clips: [], sockets: [] },
  joints: ['root', 'head', 'arm'].map(part => ({ id: `${id}.joint.${part}`, source: { part: `${id}-${part}` } })),
  sockets: [], visible: [], drawDistance: 60, pointAt: [0, 0, 0], points: false });
const harbour = {
  name: 'harbour-menders', sleep: { figure: 'mender', distance: 60 },
  atlas: { phone: atlas(['mender', 'boy']), desktop: atlas(['mender', 'boy']) },
  figures: {
    mender: { frame: { height: 1.8, neck: [0, 1.45, 0], shoulder: [-0.2, 1.35, 0] }, motion: {}, phase: 0, glanceAfter: 2, row: row('mender', 3), moving: false,
      atlas: { phone: atlas(['mender']), desktop: atlas(['mender']) } },
    boy: { frame: { height: 1.2, neck: [0, 0.9, 0], shoulder: [-0.13, 0.85, 0] }, phase: 1.7, glanceAfter: 3, row: row('boy', 5), moving: true,
      motion: { orbit: { x: 5, z: 4, radius: 2, speed: 0.5, stopDistance: 4, lift: 0.1, frequency: 6 }, idleHead: { distance: 4, yaw: 0, pitch: 0 } },
      atlas: { phone: atlas(['boy']), desktop: atlas(['boy']) } },
  },
  pieces: { still: { id: 'harbour-menders', name: 'Net-menders', category: 'people', file: 'src/shards/harbour/people.ts', surface: 'flesh' },
    moving: { id: 'harbour-boy', name: 'Harbour boy', category: 'people', file: 'src/shards/harbour/people.ts', surface: 'flesh' } },
};

test('a merged figure group admits an unrelated harbour group and its rows', () => {
  const rows = v.parse(FigureGroupSchema, harbour);
  expect(Object.keys(rows.figures)).toEqual(['mender', 'boy']);
  expect(rows.figures['boy']?.motion.orbit?.radius).toBe(2);
  for (const figure of Object.values(rows.figures)) expect(v.safeParse(FigureRowSchema, figure.row).success).toBe(true);
  expect(rows.atlas.phone.joints).toHaveLength(6);
});

test('a figure group refuses an unbounded atlas cell and a piece outside the people', () => {
  expect(v.safeParse(FigureAtlasSchema, { ...atlas(['mender']), cell: 4096 }).success).toBe(false);
  expect(v.safeParse(FigureGroupSchema, { ...harbour, pieces: { ...harbour.pieces, still: { ...harbour.pieces.still, category: 'props' } } }).success).toBe(false);
});
