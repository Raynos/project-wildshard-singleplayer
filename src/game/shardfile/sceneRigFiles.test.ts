import { expect, test } from 'vitest';
import type { ModelLibraryRows } from '../plugin/geometry';
import { sceneRigFiles } from './sceneRigFiles';

const empty: ModelLibraryRows<string, string> = { meshes: [], meshUrls: {}, hd: [], hdUrls: {}, aoFloor: 0, hdLooks: {} };
const rows: ModelLibraryRows<string, string> = { ...empty, rigs: { bodies: { creatures: ['owned', 'public'],
  urls: { owned: 'rigs/owned.glb', public: '/assets/public.glb' }, standIns: {}, fault: 'rig' }, looks: [] } };

test('public rigs and libraries without rigs keep their original identity', () => {
  const product = { hasFile: () => false, url: () => { throw new Error('Unexpected URL read'); } };
  expect(sceneRigFiles(empty, product)).toBe(empty);
  expect(sceneRigFiles(rows, product)).toBe(rows);
});

test('owned rig names use verified product URLs without changing public URLs or the source descriptor', () => {
  const reads: string[] = [];
  const resolved = sceneRigFiles(rows, { hasFile: name => name === 'rigs/owned.glb', url: name => { reads.push(name); return '/shardfiles/hash.glb'; } });
  expect(reads).toEqual(['rigs/owned.glb']);
  expect(resolved.rigs?.bodies.urls).toEqual({ owned: '/shardfiles/hash.glb', public: '/assets/public.glb' });
  expect(resolved.rigs?.bodies.standIns).toBe(rows.rigs?.bodies.standIns);
  expect(resolved.rigs?.looks).toBe(rows.rigs?.looks);
  expect(rows.rigs?.bodies.urls['owned']).toBe('rigs/owned.glb');
});

test('a refused owned URL remains a preparation refusal', () => {
  expect(() => sceneRigFiles(rows, { hasFile: () => true, url: () => { throw new Error('Not admitted'); } })).toThrow('Not admitted');
});
