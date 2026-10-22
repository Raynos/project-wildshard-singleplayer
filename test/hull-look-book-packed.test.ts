import { zlibSync } from 'fflate';
import { afterAll, expect, test, vi } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { HullLookBook } from '../src/game/looks/speciesBook';

// G600 L8 / G602: the hull book's packed looks (Nalati's species book folds into it): compact bodies, coat rows, a
// painterly material and post-pose programmes, from rows only
afterAll(() => { vi.unstubAllGlobals(); });
const file = `/assets/test/compact-${'b'.repeat(64)}.bin`;
const compactBody = { file, bytes: 36, attrs: [['position', 'f32', 3, false]],
  skeletons: [{ bones: [{ name: 'body', parent: null, pos: [0, 0, 0] }], dims: { bodyY: .5, bodyHalfLen: .5, bodyRadius: .2, headRadius: .1, legLen: .3, halfWidth: .2, feet: [[0, 0]], capsuleAxis: 'y' } }],
  rows: [{ kind: 'stone', variant: 'plain', skeleton: 0, fur: [], hard: [[3, 0, 0, [], 'u16']], eye: [] }] };
const book = () => new HullLookBook({ slug: 'fixture', compactBody, definitions: {}, rows: [] });
const look = { id: 'look.stone', species: 'species.stone', kind: 'stone', skeleton: 'stone.v1', sockets: ['body'], clips: [] };

test('compact bodies expand and a packed look carries its coat rows, material and stance', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(zlibSync(new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer))))));
  const hull = book();
  const looks = hull.packedLooks({ poses: {}, rows: [{ ...look, family: 'stone', variants: { mossy: { body: 'plain', tint: { base: [0.2, 0.4, 0.2] }, traits: { cracks: 2 } } },
    material: { family: 'painterly', rim: 0.3, bands: 4 }, stance: { grazeNeck: 0.1, gallopTail: 0.2 }, gait: { trot: 3, gallop: 7 } }] });
  const stone = looks.get('stone');
  expect(stone.variants).toEqual({ mossy: { tint: { base: [0.2, 0.4, 0.2] }, traits: { cracks: 2 } } });
  expect(stone.pose).toEqual({ grazeNeck: 0.1, gallopTail: 0.2 }); expect(stone.gait).toEqual({ trot: 3, gallop: 7 });
  expect(typeof stone.material).toBe('function'); expect(stone.skin).toBeUndefined();
  await hull.packed.preload();
  const built = stone.build({ id: 'mossy', label: 'Mossy', weight: 1, rarity: 'common', scale: [1, 1] }, new Rng(1));
  expect(built.hardParts[0]?.getAttribute('position').getX(1)).toBe(1);
});

test('a post-pose naming no programme, or an unknown programme, refuses', () => {
  const hull = book();
  expect(() => hull.packedLooks({ poses: {}, rows: [{ ...look, family: 'stone', variants: { plain: 'plain' }, postPose: { alive: 'absent' } }] })).toThrow('Missing species pose programme');
  const looks = hull.packedLooks({ poses: {}, rows: [{ ...look, family: 'stone', variants: { plain: 'plain' } }] });
  expect(() => { looks.pose('absent', {} as Parameters<typeof looks.pose>[1]); }).toThrow('Missing species pose programme');
  expect(() => hull.packedLooks({ poses: {}, rows: [{ ...look, family: 'stone', material: { family: 'lowpoly', rim: 0, bands: 0 } }] })).toThrow();
});
