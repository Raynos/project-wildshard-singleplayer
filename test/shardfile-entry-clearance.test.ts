import { expect, it } from 'vitest';
import { BoxGeometry, Matrix4, MeshStandardMaterial } from 'three';
import { emptyShardfile } from '../src/sdk/author';
import { staticGlb } from '../src/sdk/bake/glb';
import { contentHash } from '../src/sdk/project';
import { validateEntrywayClearance } from '../src/game/shardfile/entryClearance';
import { visitGlbTriangles, parseGlb } from '../src/game/shardfile/assets';
import { parseShardfile } from '../src/game/shardfile/schema';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import type { ShardProps } from '../src/game/shardfile/props';
import type { ShardWater } from '../src/game/shardfile/water';

const empty = () => emptyShardfile({ slug: 'clearance-test', name: 'Clearance', author: 'Test', seed: 1, revision: 1 });
const props = (): ShardProps => ({ version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, textures: [], colliders: [] });
function box(x = 0, z = 240): ShardProps['colliders'][number] {
  return { id: 'obstacle', panel: null, initialActive: true, shapes: [{ kind: 'box', x, y: 1, z, hx: 0.1, hy: 1, hz: 0.1 }] };
}
function inspect(section: ShardProps | null, water: ShardWater = [], assets = new Map<string, Uint8Array>()) {
  validateEntrywayClearance({ entryways: empty().entryways, props: section, water }, assets);
}
function glb(instanced = false): Uint8Array {
  const geometry = new BoxGeometry(0.2, 2, 0.2), material = new MeshStandardMaterial();
  try {
    if (!instanced) geometry.translate(0, 1, 240);
    return staticGlb([{ geometry, material, ...(instanced ? { instances: [new Matrix4().makeTranslation(0, 1, 240)] } : {}) }]);
  } finally { geometry.dispose(); material.dispose(); }
}
function withNodeHierarchy(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), jsonSize = view.getUint32(12, true);
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonSize)));
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Missing GLB document');
  const doc = value as Record<string, unknown>, nodes: unknown = doc['nodes'];
  if (!Array.isArray(nodes) || nodes.length !== 1) throw new Error('Missing GLB node');
  doc['nodes'] = [...nodes.map((node: unknown) => node), { translation: [0, 0, -240], children: [0] }]; doc['scenes'] = [{ nodes: [1] }];
  const json = new TextEncoder().encode(JSON.stringify(doc)), padded = Math.ceil(json.length / 4) * 4, binary = bytes.subarray(20 + jsonSize);
  const result = new Uint8Array(20 + padded + binary.length), output = new DataView(result.buffer);
  result.set(bytes.subarray(0, 20)); output.setUint32(8, result.length, true); output.setUint32(12, padded, true);
  result.fill(32, 20, 20 + padded); result.set(json, 20); result.set(binary, 20 + padded); return result;
}
it('admits empty non-terrain products and walls on the sides of a full 8 m canyon', () => {
  expect(() => inspect(null)).not.toThrow();
  const section = props(); section.colliders = [-4.125, 4.125].map((x, i) => ({ id: `wall.${String(i)}`, panel: null, initialActive: true, shapes: [{ kind: 'box', x, y: 1, z: 240, hx: 0.125, hy: 1, hz: 1 }] }));
  expect(() => inspect(section)).not.toThrow();
});
it.each([[0, 240], [240, 0], [0, -240], [-240, 0]])('refuses a tiny collider inside the full footprint at %s,%s', (x, z) => {
  const section = props(); section.colliders = [box(x, z)]; expect(() => inspect(section)).toThrow('clear of props and colliders');
});
it('checks rotated collider geometry rather than a broad AABB, and refuses inactive obstacles and treads', () => {
  const section = props();
  section.colliders = [{ ...box(), initialActive: false }]; expect(() => inspect(section)).toThrow('clear of props and colliders');
  section.colliders = [{ ...box(), shapes: [{ kind: 'treads', from: { x: 0, y: 0, z: 240 }, to: { x: 0, y: 1, z: 242 }, width: 1, count: 2 }] }]; expect(() => inspect(section)).toThrow('clear of props and colliders');
  // A long slanted box has an AABB crossing the rectangle, but its actual rotated faces lie outside it.
  section.colliders = [{ ...box(), shapes: [{ kind: 'box', x: 5, y: 1, z: 232, hx: 0.1, hy: 1, hz: 3, yaw: Math.PI / 4 }] }];
  expect(() => inspect(section)).not.toThrow();
  section.colliders = [{ ...box(), shapes: [{ kind: 'box', x: 0, y: 0.05, z: 240, hx: 1, hy: 0.1, hz: 1, rot: { x: Math.sin(Math.PI / 8), y: 0, z: 0, w: Math.cos(Math.PI / 8) } }] }];
  expect(() => inspect(section)).toThrow('clear of props and colliders');
});
it.each([false, true])('inspects actual static prop positions (GPU instancing=%s), not forged bounds', (instanced) => {
  const bytes = glb(instanced), hash = contentHash(bytes), section = props(); section.tiles = [{ lod: 0, x: 4, z: 7, file: hash }];
  expect(() => inspect(section, [], new Map([[hash, bytes]]))).toThrow('clear of props and colliders');
  section.tiles = []; section.panels = [{ id: 'hidden', file: hash, visible: false }];
  expect(() => inspect(section, [], new Map([[hash, bytes]]))).toThrow('clear of props and colliders');
  section.panels = []; section.far = hash; expect(() => inspect(section, [], new Map([[hash, bytes]]))).toThrow('clear of props and colliders');
  section.far = null; section.models = [{ id: 'unplaced', file: hash }]; expect(() => inspect(section, [], new Map([[hash, bytes]]))).not.toThrow();
});
it('respects nested GLB node transforms and refuses nonfinite binary positions', () => {
  const transformed = withNodeHierarchy(glb()), hash = contentHash(transformed), section = props(); section.tiles = [{ lod: 0, x: 4, z: 4, file: hash }];
  expect(() => inspect(section, [], new Map([[hash, transformed]]))).not.toThrow();
  let count = 0; visitGlbTriangles(transformed, () => { count++; }); expect(count).toBe(12);
  const bytes = glb(), view = new DataView(bytes.buffer); view.setFloat32(28 + view.getUint32(12, true), Number.NaN, true);
  expect(() => visitGlbTriangles(bytes, () => { throw new Error('Unexpected geometry callback'); })).toThrow('nonfinite GLB position');
});
it('refuses pools and narrow streams between sparse sample points, including water at road height', () => {
  const pool: ShardWater = [{ id: 'pool', kind: 'pool', level: 0, shape: { kind: 'circle', x: 0.3, z: 240.3, radius: 0.01 } }];
  expect(() => inspect(null, pool)).toThrow('must be dry');
  expect(() => inspect(null, [{ id: 'polygon', kind: 'pool', level: 0, shape: { kind: 'polygon', points: [[-5, 239], [5, 239], [5, 240], [-5, 240]] } }])).toThrow('must be dry');
  expect(() => inspect(null, [{ id: 'stream', kind: 'stream', width: 0.01, points: [{ x: -10, z: 240.3, level: 1 }, { x: 10, z: 240.3, level: 1 }] }])).toThrow('must be dry');
  pool[0] = { id: 'pool', kind: 'pool', level: -1, shape: { kind: 'circle', x: 0, z: 240, radius: 1 } }; expect(() => inspect(null, pool)).not.toThrow();
});
it('bounds every future sea crest and checks the wet portion of a sloping stream', () => {
  expect(() => inspect(null, [{ id: 'sea', kind: 'sea', level: -1, waves: true }])).not.toThrow();
  expect(() => inspect(null, [{ id: 'sea', kind: 'sea', level: -0.4, waves: true }])).toThrow('must be dry');
  expect(() => inspect(null, [{ id: 'sea', kind: 'sea', level: 0, waves: false }])).toThrow('must be dry');
  expect(() => inspect(null, [{ id: 'stream', kind: 'stream', width: 0.1, points: [{ x: 0, z: 235, level: -1 }, { x: 0, z: 240, level: 1 }] }])).toThrow('must be dry');
  expect(() => inspect(null, [{ id: 'stream', kind: 'stream', width: 0.1, points: [{ x: 0, z: 240, level: -10 }, { x: 0, z: 230, level: 1 }] }])).not.toThrow();
});
it('refuses a valid-hash blocked or submerged non-terrain cartridge at the real admission entrypoint', () => {
  const bytes = glb(true), hash = contentHash(bytes), cost = parseGlb(bytes), section = props();
  section.panels = [{ id: 'obstacle', file: hash, visible: false }];
  const source = empty(); source.props = section; source.files = [{ hash, kind: 'glb', compressed: bytes.length, ...cost, critical: false, dependencies: [] }];
  source.library = [hash]; source.budgets.library = { resident: cost.decoded + cost.gpu, compressed: bytes.length };
  expect(() => parseShardfile(source)).not.toThrow();
  expect(() => validateShardfileAssets(source, new Map([[hash, bytes]]), contentHash)).toThrow('clear of props and colliders');
  const wet = empty(); wet.water = [{ id: 'pool', kind: 'pool', level: 0, shape: { kind: 'circle', x: 0, z: 240, radius: 1 } }];
  expect(() => parseShardfile(wet)).not.toThrow();
  expect(() => validateShardfileAssets(wet, new Map(), contentHash)).toThrow('must be dry');
});
