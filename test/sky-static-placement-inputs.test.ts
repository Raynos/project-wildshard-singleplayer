// oxlint-disable-next-line import/no-nodejs-modules -- Read original native inputs and own isolated sealed-generation fixtures.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine omitted-input catalogues to repository scratch.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyStaticSceneBytes, skyStaticScenes } from '../src/shards/far-reach/generators/staticScene';
import { fixedWorld, skyFixedWorldValues } from '../src/shards/far-reach/generators/fixedWorld';
import { STATIC_SCENE_INPUTS, skyStaticSceneSource } from '../src/shards/far-reach/generators/staticSceneProgram';
import { readSkyStaticSceneEnvelope } from '../src/shards/far-reach/generators/staticSceneIntake';
import { originalSkySceneInputs } from './fixtures/sky-scene-source';
import { WORLD_PLACEMENT_INPUTS, skyWorldPlacementValues } from '../src/shards/far-reach/generators/worldPlacementBytes';

test('static contact intake admits retained registry fields and refuses malformed or extra metadata', () => {
  const wire = (contact: unknown): Uint8Array => {
    const variant = { models: [], recipe: {}, bindings: [], fixed: { models: [], textureOnly: [], recipe: {}, halo: {},
      bindings: { crown: [], early: [], furniture: [], mill: [] }, colliders: [contact] } };
    return new TextEncoder().encode(JSON.stringify({ half: 1, standalone: variant, cell: variant }));
  };
  const contact = { id: 'bridge', colliders: [], name: 'Bridge', category: 'buildings', file: 'bridge.ts', active: false, surface: 'wood', mode: 'board' };
  expect(readSkyStaticSceneEnvelope(wire(contact)).standalone.fixed.colliders).toEqual([{ id: 'bridge', colliders: [] }]);
  expect(readSkyStaticSceneEnvelope(wire({ id: 'ground', colliders: [] })).cell.fixed.colliders).toEqual([{ id: 'ground', colliders: [] }]);
  expect(() => readSkyStaticSceneEnvelope(wire({ ...contact, active: 1 }))).toThrow('contact envelope differs');
  expect(() => readSkyStaticSceneEnvelope(wire({ ...contact, extra: true }))).toThrow('contact envelope differs');
});


test('both fixed worlds retain the complete original bytes and isolate caller-owned values', async () => {
  const { mill } = await originalSkySceneInputs();
  const values = skyFixedWorldValues(mill.recipe), original = JSON.stringify(values);
  for (const [standalone, length, hash] of [
    [true, 267_448, '6ab10af8592452f0307edeb7acbe905fa8ca2411e822ec19e8dfd97799fdf7d6'],
    [false, 267_137, '4f5741f1e848a1b1143ca259a94d48794a9778a1ab581a0faef69b907f0789dc'],
  ] as const) {
    const rows = fixedWorld(standalone, values), bytes = new TextEncoder().encode(JSON.stringify(rows));
    expect(bytes.byteLength).toBe(length); expect(hashImmutableBytes(bytes)).toBe(hash);
    rows.recipe.scene.nodes.length = 0;
    const hull = rows.colliders.flatMap(row => row.colliders).find(row => row.kind === 'hull');
    if (hull === undefined || hull.kind !== 'hull' || hull.points === undefined) throw new Error('Missing original fixed hull');
    Reflect.set(hull.points, 0, 999);
    expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(fixedWorld(standalone, values))))).toBe(hash);
    expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(fixedWorld(standalone, skyFixedWorldValues(mill.recipe)))))).toBe(hash);
  }
  expect(JSON.stringify(values)).toBe(original);
  const changed = skyFixedWorldValues(mill.recipe), hull = changed.groundColliders[0]?.colliders[0];
  if (hull === undefined) throw new Error('Missing authored ground hull');
  hull.points[0] = 456;
  expect(JSON.stringify(skyFixedWorldValues(mill.recipe))).toBe(original);
});

test('the static factory consumes explicit fixed-world values for both envelopes without mutating them', async () => {
  const { mill } = await originalSkySceneInputs();
  const { placements } = await skyWorldPlacementValues(new Map(WORLD_PLACEMENT_INPUTS.map(name => [name, new Uint8Array(readFileSync(`public${name}`))])));
  const values = skyFixedWorldValues(mill.recipe);
  values.mill.scene.nodes = values.mill.scene.nodes.map(node => node.id === 'hub' ? { ...node, rotation: [0.25, 0, 0] } : node);
  const supplied = { ...values, groundColliders: [{ id: 'owned-ground', colliders: [{ kind: 'hull' as const, x: 1, y: 2, z: 3, points: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], surface: 'grass' as const }] }] };
  const before = JSON.stringify(supplied), rows = skyStaticScenes(placements, supplied);
  for (const mode of ['standalone', 'cell'] as const) {
    const hub = rows[mode].fixed.recipe.scene.nodes.find(node => node.id === 'mill.hub');
    if (hub?.kind !== 'group') throw new Error('Missing supplied mill hub');
    expect(hub.rotation).toEqual([0.25, 0, 0]);
    expect(rows[mode].fixed.colliders.find(row => row.id === 'owned-ground')).toEqual(supplied.groundColliders[0]);
  }
  const standaloneHull = rows.standalone.fixed.colliders.find(row => row.id === 'owned-ground')?.colliders[0];
  if (standaloneHull === undefined || standaloneHull.kind !== 'hull' || standaloneHull.points === undefined) throw new Error('Missing supplied hull');
  Reflect.set(standaloneHull.points, 0, 999);
  expect(rows.cell.fixed.colliders.find(row => row.id === 'owned-ground')).toEqual(supplied.groundColliders[0]);
  expect(JSON.stringify(supplied)).toBe(before);
  expect(() => fixedWorld(true, { ...values, mill: { ...values.mill, scene: { ...values.mill.scene, nodes: [] } } })).toThrow();
});

test('the static reader derives all original scene bytes from exactly eight explicit native models', async () => {
  const reads: string[] = [];
  const bytes = await skyStaticSceneBytes(name => { reads.push(name); return new Uint8Array(readFileSync(`public${name}`)); });
  expect(reads).toEqual(STATIC_SCENE_INPUTS);
  expect(bytes.byteLength).toBe(583_343);
  expect(hashImmutableBytes(bytes)).toBe('1be5a532bca78ccb782a80905105ca6d6fe243676539dc04d58e78f213ddef2a');
  const { placements } = await skyWorldPlacementValues(new Map(WORLD_PLACEMENT_INPUTS.map(name => [name, new Uint8Array(readFileSync(`public${name}`))])));
  const { mill } = await originalSkySceneInputs();
  const source = skyStaticScenes(placements, skyFixedWorldValues(mill.recipe));
  const admitted = readSkyStaticSceneEnvelope(bytes);
  for (const mode of ['standalone', 'cell'] as const) {
    // Intake reads the exact hashed JSON wire, not the pre-serialization
    // quaternion objects (whose signed zero is deliberately left unchanged).
    const originalWire = JSON.stringify(source[mode].fixed.colliders.map(({ id, colliders }) => ({ id, colliders })));
    const originalContacts: unknown = JSON.parse(originalWire);
    expect(admitted[mode].fixed.colliders).toEqual(originalContacts);
  }
  expect(skyStaticScenes({ ...placements, half: 123 }, skyFixedWorldValues(mill.recipe)).half).toBe(123);
});

test('the static scheduler handoff is retired while original native-source inventory refusals remain strict', async () => {
  const inputs = new Map(STATIC_SCENE_INPUTS.map(url => [url, new Uint8Array(readFileSync(`public${url}`))]));
  for (const name of STATIC_SCENE_INPUTS) {
    const omitted = new Map(inputs); omitted.delete(name);
    await expect(skyStaticSceneSource(omitted)).rejects.toThrow('input inventory differs');
  }
  const bytes = (await skyStaticSceneSource(inputs)).get('static-scenes.json');
  if (bytes === undefined) throw new Error('Missing original static wire');
  expect(bytes.byteLength).toBe(583_343);
  expect(hashImmutableBytes(bytes)).toBe('1be5a532bca78ccb782a80905105ca6d6fe243676539dc04d58e78f213ddef2a');
});

test('the reader bundle includes its owned producer and excludes the generated placement handoff', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/staticScene.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing static reader bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/worldPlacementBytes.ts'))).toBe(true);
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/data/placements.json'))).toBe(false);
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/groundScene.ts'))).toBe(true);
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/data/groundScene.generated.json'))).toBe(false);
  }
});
