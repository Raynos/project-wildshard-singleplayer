import { expect, test } from 'vitest';
import { parseWorldScenes, worldScenesForTier } from '@wildshard/format/worldScenes';

function fixture() {
  return parseWorldScenes({ version: 1, catalogue: 'models/catalogue.json', materials: [],
    libraries: [{ id: 'shapes', kind: 'owned', models: [
      { id: 'shared', file: 'shared.glb' }, { id: 'small', file: 'small.glb', tier: 'phone' },
      { id: 'large', file: 'large.glb', tier: 'desktop' },
    ] }],
    batches: ['phone', 'desktop'].map(tier => ({ id: `draw.${tier}`, tier, material: 'stone',
      capacity: { vertices: 3, indices: 3, instances: 1 } })),
    placements: [{ id: 'common', file: 'common.json' },
      { id: 'small', file: 'small.json', tier: 'phone' }, { id: 'large', file: 'large.json', tier: 'desktop' }],
    steps: [{ id: 'profile', variants: { standalone: 'old.json', cell: 'new.json' } }],
  });
}

test.each(['phone', 'desktop'] as const)('selects %s before intake and keeps shared/profile rows', tier => {
  const source = fixture(), selected = worldScenesForTier(source, tier), library = selected.libraries[0];
  if (library?.kind !== 'owned') throw new Error('Missing owned library');
  expect(library.models.map(row => row.id)).toEqual(['shared', tier === 'phone' ? 'small' : 'large']);
  expect(selected.batches?.map(row => row.id)).toEqual([`draw.${tier}`]);
  expect(selected.placements?.map(row => row.id)).toEqual(['common', tier === 'phone' ? 'small' : 'large']);
  expect(selected.steps).toBe(source.steps);
  expect(source.batches).toHaveLength(2);
  expect(source.libraries[0]?.kind === 'owned' && source.libraries[0].models).toHaveLength(3);
});

test('rejects unknown tiers instead of silently skipping declarations', () => {
  const row = fixture();
  expect(() => parseWorldScenes({ ...row, batches: [{ ...row.batches[0], tier: 'tablet' }] })).toThrow();
});

test('admits instance colours and product KTX2 rows as plain data', () => {
  const step = (rows: unknown[]) => ({ id: 'cards', scene: 'cards.json', instanceAttributes: rows });
  const parsed = parseWorldScenes({ version: 1, libraries: [], materials: [], steps: [step([{ part: 'm', target: 'instanceColor', width: 3, values: [1, 0, 0] }, { part: 'm', name: 'aWin', width: 4, values: [0, 0, 0, 0] }])],
    lent: [{ kind: 'product', looks: ['neon'], param: 'mono', file: { phone: 'a-phone.ktx2', desktop: 'a-desktop.ktx2' }, label: 'atlas', sampler: { anisotropy: 8, filter: 'linear', mips: 'gpu' }, publish: 'signs.mono' }] });
  expect(parsed.steps[0]?.instanceAttributes.map(row => row.target ?? 'geometry')).toEqual(['instanceColor', 'geometry']);
  expect(() => parseWorldScenes({ version: 1, libraries: [], materials: [], steps: [step([{ part: 'm', target: 'instanceColor', width: 4, values: [] }])] })).toThrow();
  expect(() => parseWorldScenes({ version: 1, libraries: [], materials: [], steps: [], lent: [{ kind: 'product', file: { phone: 'a' }, label: 'x', sampler: {} }] })).toThrow();
});

test('admits product instance packets and tier-selected channel pools', () => {
  const packet = (byteOffset: number) => ({ file: 'w.bin', storage: 'f32', byteOffset, count: 2 });
  const scenes = (rows: unknown[], files: unknown[] = []) => ({ version: 1, materials: [], libraries: [{ id: 'signs', kind: 'pool', publish: 'signs', files }], steps: [{ id: 'w', scene: 'w.json', instanceAttributes: rows }] });
  const parsed = parseWorldScenes(scenes([{ part: 'm', target: 'instanceMatrix', width: 16, packet: packet(0) }, { part: 'm', name: 'aWin', width: 4, packet: packet(128) }],
    [{ file: { phone: 'p.glb', desktop: 'd.glb' }, parts: ['board'], channels: [{ name: 'aTint', source: '_tint', width: 3 }] }, { file: 'hd.glb', tier: 'desktop', parts: ['tube'] }]));
  expect(parsed.steps[0]?.instanceAttributes.map(row => row.packet?.byteOffset)).toEqual([0, 128]);
  const pool = worldScenesForTier(parsed, 'phone').libraries[0];
  expect(pool?.kind === 'pool' && pool.files.map(row => row.parts)).toEqual([['board']]);
  expect(pool?.kind === 'pool' && pool.publish).toBe('signs');
  expect(() => parseWorldScenes(scenes([{ part: 'm', name: 'aWin', width: 4, values: [], packet: packet(0) }]))).toThrow();
  expect(() => parseWorldScenes(scenes([{ part: 'm', name: 'aWin', width: 4, packet: packet(2) }]))).toThrow();
  expect(() => parseWorldScenes(scenes([], [{ file: 'a.glb', parts: ['x'] }, { file: 'b.glb', tier: 'phone', parts: ['x'] }]))).toThrow();
});
