// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial, Points } from 'three';
import { Scope } from '../src/engine/app/scope';
import { WorldRegistry } from '../src/engine/world/registry';
import { parseExplorerCatalogue } from '../src/format/explorerCatalogue';
import { parseWorldScenes } from '../src/format/worldScenes';
import { parseWorldScene } from '../src/format/clientChannels';
import { emptyShardfile } from '../src/sdk/author';
import { nameBlob, emitNamedBlobs } from '../src/sdk/blobs';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { explorerRoster } from '../src/game/models/explorerCatalogue';
import { installWorldScenes } from '../src/game/shardfile/worldScenes';
import { drawSceneRows } from '../src/game/shardfile/sceneDraws';
import * as sceneSources from '../src/game/shardfile/sceneSources';
import { admitWorldSceneStepSources, worldSceneStepSources } from '../src/game/shardfile/worldSceneStepSources';
import { createModelLibrary, rigLibrary } from '../src/game/plugin/geometry';
import { sceneScalar, sceneScalarValue, sceneVectors } from '../src/game/shardfile/sceneInputs';
import type { ShardContext } from '../src/game/plugin/context';
import { output as sky } from '../src/shards/far-reach/generators/output';
import { output as signal } from '../src/shards/sunscar-dunes/generators/output';

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const emptyLibrary = { rows: { meshes: [], hd: [], meshUrls: {}, hdUrls: {}, hdLooks: {}, aoFloor: 1 } };
function fixture(slug: string, catalogue: unknown, scenes = parseWorldScenes({ version: 1, libraries: [], materials: [], steps: [] }), blobs: readonly ReturnType<typeof nameBlob>[] = []) {
  const declared = emitNamedBlobs(blobs);
  return createShardProduct({ slug, revision: 1, shardfile: emptyShardfile({ slug, name: slug, author: 'Fixture', revision: 1, seed: 1 }),
    sections: new Map<string, unknown>([['explore/catalogue', parseExplorerCatalogue(catalogue)], ['world/scenes', scenes]]),
    files: new Map(declared.files.flatMap(row => row.name === undefined ? [] : [[row.name, { hash: row.hash, url: row.hash }]])),
    read: hash => { const bytes = declared.assets.get(hash); if (bytes === undefined) throw new Error('Missing fixture bytes'); return Promise.resolve(bytes); }, check: true });
}

test('catalogue preserves original Sky and Signal order through source references', () => {
  const entries = (output: typeof sky | typeof signal) => {
    const bytes = output.platform.files.get('sections/explore/catalogue.json'); if (bytes === undefined) throw new Error('Missing catalogue');
    return parseExplorerCatalogue(JSON.parse(new TextDecoder().decode(bytes))).entries.map(row => row.kind === 'scene' ? row.part : row.kind === 'rigs' ? row.library : row.kind === 'held' ? row.item : row.kind === 'npc' ? row.npc : row.kind);
  };
  expect(entries(sky)).toEqual(['weapon.far-reach.fan', 'specimen-mill.root', 'specimen-bridge.root', 'specimen-vane.root', 'sky', 'far.keeper']);
  expect(entries(signal)).toEqual(['weapon.sunscar-whip', 'models', 'sunscar.scout', 'tower.root', 'caravan.root', 'well.root', 'brazier.0.root']);
});

test('every emitted Sky and Signal scene recipe passes runtime admission', async () => {
  for (const [index, output] of [sky, signal].entries()) {
    const bytes = output.platform.files.get('sections/world/scenes.json'); if (bytes === undefined) throw new Error('Missing scene section');
    const scenes = parseWorldScenes(JSON.parse(new TextDecoder().decode(bytes)));
    const blobs = output.namedFiles.flatMap(file => {
      if (file.name === undefined) return [];
      const data = output.assets.get(file.hash); if (data === undefined) throw new Error('Missing declared source');
      return [nameBlob(file.name, 'json', data)];
    });
    const product = fixture(`fixture-sources-${String(index)}`, { version: 1, entries: [] }, scenes, blobs);
    await sceneSources.prepareSceneSources(product);
    for (const step of scenes.steps) {
      const file = step.scene; if (file === undefined) throw new Error('Missing declared scene file');
      const recipe = parseWorldScene(await product.json<unknown>(file));
      expect(() => admitWorldSceneStepSources(product, step, recipe)).not.toThrow();
      const parts = new Set(recipe.scene.nodes.map(node => node.id));
      for (const row of step.registry) expect(parts.has(row.part), row.id).toBe(true);
      for (const binding of Object.values(step.publish)) if ('part' in binding && binding.kind !== 'standard-material') {
        expect(binding.kind === 'colliders' ? step.registry.some(row => row.id === binding.part) : parts.has(binding.part), binding.part).toBe(true);
      }
    }
  }
});

test.each([
  { kind: 'scene', part: 'a', owner: 'native' }, { kind: 'held', item: 'a', build: () => new Group() },
  { kind: 'species', species: 'a', prepare: () => undefined }, { kind: 'scene', part: 'a', frame: { distance: Infinity } },
])('refuses executable or reflected catalogue fields %#', entry => {
  expect(() => parseExplorerCatalogue({ version: 1, entries: [entry] })).toThrow();
});

test('refuses duplicate explicit identities and overlong catalogues', () => {
  const entry = { id: 'a', kind: 'engine', model: 'swim-hands' };
  expect(() => parseExplorerCatalogue({ version: 1, entries: [entry, entry] })).toThrow();
  expect(() => parseExplorerCatalogue({ version: 1, entries: Array.from({ length: 257 }, () => ({ kind: 'engine', model: 'swim-hands' })) })).toThrow();
});

test('native transition selects by id, retaining authored order and native remainder', async () => {
  const native = ['first', 'second', 'last'].map(id => ({ id, list: () => undefined }));
  const product = fixture('fixture-order', { version: 1, entries: [{ kind: 'library', library: 'native', model: 'second' }, { kind: 'library', library: 'native', model: 'first' }] });
  const roster = await explorerRoster(product, native);
  expect(roster).toEqual([native[1], native[0], native[2]]);
  const invalid = fixture('fixture-order-refusal', { version: 1, entries: [{ kind: 'library', library: 'native', model: 'missing' }] });
  await expect(explorerRoster(invalid, native)).rejects.toMatchObject({ item: 'explore/catalogue', reason: 'schema' });
  const duplicate = fixture('fixture-order-duplicate', { version: 1, entries: [0, 1].map(() => ({ kind: 'library', library: 'native', model: 'first' })) });
  await expect(explorerRoster(duplicate, native)).rejects.toMatchObject({ item: 'explore/catalogue', reason: 'schema' });
});

test('posed references read existing library ids in their authored order', async () => {
  const native = ['owl', 'hare', 'raven'].map(id => ({ id, list: () => undefined }));
  const product = fixture('fixture-posed', { version: 1, entries: [{ kind: 'posed', file: 'look/birds.json' }] }, undefined,
    [nameBlob('look/birds.json', 'json', encode({ models: [{ id: 'raven' }, { id: 'owl' }] }))]);
  expect(await explorerRoster(product, native)).toEqual([native[2], native[0], native[1]]);
  await expect(explorerRoster(product, [native[1]].filter(row => row !== undefined))).rejects.toMatchObject({ item: 'explore/catalogue', reason: 'schema' });
});

test('unknown species, items and scene definitions refuse the entire roster', async () => {
  for (const entry of [{ kind: 'species', species: 'missing', id: 'missing', file: 'missing' }, { kind: 'held', item: 'missing' }, { kind: 'scene', part: 'missing' }]) {
    await expect(explorerRoster(fixture(`fixture-${entry.kind}`, { version: 1, entries: [entry] }))).rejects.toMatchObject({ item: 'explore/catalogue', reason: 'schema' });
  }
});

test('made-up second scene user binds declared lights, sources and cube membership', async () => {
  const recipe = { scene: { version: 1, root: 'root', materials: [], nodes: [{ id: 'root', kind: 'group', children: ['lamp'] }, { id: 'lamp', kind: 'object', source: 'lamp', missing: 'refuse' }] }, imports: [] };
  const scenes = parseWorldScenes({ version: 1, libraries: [{ id: 'fixture', kind: 'models', file: 'sources/models.json' }], materials: [], steps: [
    { id: 'lamp', scene: 'scenes/lamp.json', lights: [{ id: 'lamp', color: 0xffaa66, intensity: 3, distance: 5, decay: 2 }], publish: { light: { kind: 'point-light', part: 'lamp' } } },
    { id: 'cell', cube: 'cell', scene: 'scenes/lamp.json', lights: [{ id: 'lamp', color: 0xffaa66, intensity: 3, distance: 5, decay: 2 }] },
    { id: 'specimen', load: 'explorer', scene: 'scenes/lamp.json', lights: [{ id: 'lamp', color: 0xffaa66, intensity: 3, distance: 5, decay: 2 }] },
  ] });
  const product = fixture('fixture-lamp', { version: 1, entries: [] }, scenes, [nameBlob('sources/models.json', 'json', encode(emptyLibrary)), nameBlob('scenes/lamp.json', 'json', encode(recipe))]);
  const scope = new Scope('fixture-lamp'), root = new Group(), registry = new WorldRegistry();
  const context = { product, scope, root, cube: null, game: {}, app: { registry } } as ShardContext;
  try {
    const handles = await installWorldScenes(context, scenes);
    expect(handles.light('lamp.light').intensity).toBe(3); expect(root.children).toEqual([handles.group('lamp.root')]);
    expect(handles.has('cell.root')).toBe(false); expect(handles.has('specimen.root')).toBe(false);
  } finally { scope.dispose(); }
});

test('draw fields keep original float32 seeds, order, visibility and ownership', () => {
  const product = fixture('fixture-points', { version: 1, entries: [] }), scope = new Scope('fixture-points'), root = new Group(), material = new MeshStandardMaterial();
  drawSceneRows(product, [{ kind: 'points', name: 'sparks', material: 'glow', count: 3, scale: 2, y: 4 }], root, scope, new Map([['glow', material]]));
  const points = root.children[0]; if (!(points instanceof Points)) throw new Error('Missing point field');
  expect(points.name).toBe('sparks'); expect(points.frustumCulled).toBe(false); expect(points.position.y).toBe(4); expect(points.scale.toArray()).toEqual([2, 2, 2]);
  const shape: unknown = points.geometry; if (!(shape instanceof BufferGeometry)) throw new Error('Missing point geometry');
  const attribute: unknown = shape.getAttribute('aSeed'); if (!(attribute instanceof BufferAttribute)) throw new Error('Missing point seeds');
  expect(Array.from(attribute.array)).toEqual(Array.from(new Float32Array([0, 0.618034, (2 * 0.618034) % 1])));
  scope.dispose(); expect(root.children).toEqual([]); material.dispose();
});

test('stable graph inputs retain identity and refuse a changed vector capacity', () => {
  expect(sceneScalarValue('fixture-input', 'dusk')).toBeUndefined();
  const scalar = sceneScalar('fixture-input', 'dusk'); scalar.value = 0.42;
  expect(sceneScalarValue('fixture-input', 'dusk')).toBe(0.42); expect(sceneScalar('fixture-input', 'dusk')).toBe(scalar);
  expect(sceneVectors('fixture-input', 'lights', 4)).toBe(sceneVectors('fixture-input', 'lights', 4));
  expect(() => sceneVectors('fixture-input', 'lights', 3)).toThrow();
});

test('draw copies share one geometry allocation per product and scope', () => {
  const product = fixture('fixture-shared-draws', { version: 1, entries: [] }), scope = new Scope('fixture-shared-draws');
  const geometry = vi.fn(() => new BufferGeometry()), material = new MeshStandardMaterial();
  const read = vi.spyOn(sceneSources, 'sceneModelSource').mockReturnValue({ ...createModelLibrary<string, string>(emptyLibrary.rows, 'fixture'), geometry });
  const rows = [{ kind: 'pool', geometry: { library: 'shapes', model: 'quad' }, material: 'paint' }];
  const a = new Group(), b = new Group(), c = new Group(), other = new Scope('fixture-other-draws');
  try {
    drawSceneRows(product, rows, a, scope, new Map([['paint', material]]));
    drawSceneRows(product, rows, b, scope, new Map([['paint', material]]));
    expect(geometry).toHaveBeenCalledTimes(1);
    drawSceneRows(product, rows, c, other, new Map([['paint', material]]));
    expect(geometry).toHaveBeenCalledTimes(2);
  } finally { read.mockRestore(); scope.dispose(); other.dispose(); material.dispose(); }
  expect(a.children).toEqual([]); expect(b.children).toEqual([]); expect(c.children).toEqual([]);
});


test('equal declared rig descriptors share live and specimen body ownership', () => {
  const rows = { bodies: { creatures: [], urls: {}, standIns: {}, fault: 'fixture-rig', releaseDecoded: true }, looks: [] };
  const original = rigLibrary(rows), copy = structuredClone(rows);
  expect(rigLibrary({ looks: copy.looks, bodies: { releaseDecoded: true, fault: 'fixture-rig', standIns: {}, urls: {}, creatures: [] } })).toBe(original);
  expect(rigLibrary({ ...copy, bodies: { ...copy.bodies, fault: 'fixture-other-rig' } })).not.toBe(original);
});


test('specimen hero copies keep declared looks without resident shader decorators', () => {
  const section = parseWorldScenes({ version: 1, libraries: [{ id: 'book', kind: 'models', file: 'book.json' }], materials: [],
    steps: [{ id: 'part', scene: 'part.json', geometry: {}, models: { hero: { library: 'book', model: 'hero' } }, publish: {}, registry: [] }] });
  const step = section.steps[0]; if (step === undefined) throw new Error('Missing fixture step');
  const product = fixture('fixture-declared-materials', { version: 1, entries: [] }, section), template = new Group();
  const geometry = new BufferGeometry(), material = new MeshStandardMaterial({ color: 0x234567 });
  material.onBeforeCompile = shader => { shader.fragmentShader = 'resident-decoration'; };
  template.add(new Mesh(geometry, material), new Mesh(geometry, material));
  const book = vi.spyOn(sceneSources, 'sceneModelSource').mockReturnValue({ ...createModelLibrary<string, string>(emptyLibrary.rows, 'fixture'), model: () => template.clone(true) });
  const definition = vi.spyOn(sceneSources, 'sceneModelDefinition').mockReturnValue({ rows: { ...emptyLibrary.rows, hd: ['hero'], hdLooks: { hero: { surface: [{ kind: 'desaturate', amount: 0.4 }] } } } });
  const inputs = vi.spyOn(sceneSources, 'sceneSurfaceInputs').mockReturnValue({});
  let fresh: MeshStandardMaterial | undefined;
  try {
    const resident = worldSceneStepSources(product, step, new Map(), new Map()).ports.model('hero', { size: 1, by: 'height' });
    expect(resident?.children[0]).toBeInstanceOf(Mesh);
    if (!(resident?.children[0] instanceof Mesh)) throw new Error('Missing resident mesh');
    expect(resident.children[0].material).toBe(material);
    const specimen = worldSceneStepSources(product, step, new Map(), new Map(), 'declared').ports.model('hero', { size: 1, by: 'height' });
    const first = specimen?.children[0], second = specimen?.children[1];
    if (!(first instanceof Mesh) || !(second instanceof Mesh) || !(first.material instanceof MeshStandardMaterial)) throw new Error('Missing specimen mesh');
    fresh = first.material; expect(fresh).not.toBe(material); expect(second.material).toBe(fresh); expect(fresh.color.equals(material.color)).toBe(true);
    expect(fresh.customProgramCacheKey()).toContain('surface:'); expect(fresh.customProgramCacheKey()).not.toContain('resident-decoration');
    expect(material.onBeforeCompile.toString()).toContain('resident-decoration');
  } finally { book.mockRestore(); definition.mockRestore(); inputs.mockRestore(); fresh?.dispose(); material.dispose(); geometry.dispose(); }
});
