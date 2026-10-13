import * as v from 'valibot';
import { expect, it } from 'vitest';
import { Texture, RepeatWrapping, SRGBColorSpace, Group, Material, Mesh, MeshStandardMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';
import { compileGraph } from '../src/engine/render/graph/compile';
import { bindGraphMeshMap } from '../src/engine/render/graphBackend';
import { installDeclaredProps } from '../src/engine/world/declaredProps';
import { propSurfaces } from '../src/game/shardfile/clientPropMaterials';
import { validatePropMaterials, PropMaterialsSchema } from '../src/format/propMaterials';
import { namedMaterialsGlb, NAMES } from './fixtures/prop-materials/fixture';
import { graph, meshMap } from '../src/sdk/materials';

const mapped = (): GraphIr => ({ version: 1, kind: 'material', model: 'unlit', nodes: {
  original: { op: 'meshMap' }, colour: { op: 'swizzle', in: ['original'], mask: 'xyz' },
  alpha: { op: 'swizzle', in: ['original'], mask: 'w' },
}, stages: { surface: { colour: 'colour', alpha: 'alpha' } } });

it('admits an original mesh colour sample once and preserves its RGBA channels', () => {
  const result = validateGraph(mapped());
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(result.cost.samplers).toBe(1);
  const compiled = compileGraph(mapped());
  expect(compiled.material.userData['graphMeshMap']).toBe(true);
  expect(compiled.cost.samplers).toBe(1);
});

it('refuses mesh sampling in post, points and vertex programs', () => {
  expect(validateGraph({ ...mapped(), primitive: 'points' }).ok).toBe(false);
  expect(validateGraph({ version: 1, kind: 'post', nodes: { map: { op: 'meshMap' } }, stages: { post: { colour: 'map' } } }).ok).toBe(false);
  expect(validateGraph({ ...mapped(), stages: { vertex: { offset: 'colour' }, surface: { colour: 'colour' } } }).ok).toBe(false);
});

it('authors meshMap as a serializable named input without a file URL or shader code', () => {
  const authored = graph({ model: 'unlit', surface: { colour: meshMap.rgb, alpha: meshMap.a } });
  expect(Object.values(authored.nodes).filter(node => node.op === 'meshMap')).toHaveLength(1);
  expect(validateGraph(structuredClone(authored)).ok).toBe(true);
});

it('borrows the exact source texture and isolates different maps while sharing equal pairs', () => {
  const scope = new Scope('mesh-map-test'), base = compileGraph(mapped()).material;
  const first = new Texture(), second = new Texture();
  first.wrapS = RepeatWrapping; first.repeat.set(3, 5); first.offset.set(0.25, 0.5); first.colorSpace = SRGBColorSpace;
  const a = bindGraphMeshMap(base, first, scope), b = bindGraphMeshMap(base, second, scope);
  expect(a).not.toBe(base); expect(a).not.toBe(b);
  expect(bindGraphMeshMap(base, first, scope)).toBe(a);
  expect(Reflect.get(a, 'map')).toBe(first); expect(Reflect.get(b, 'map')).toBe(second);
  expect(Reflect.get(base, 'map')).not.toBe(first);
  expect([first.wrapS, first.repeat.toArray(), first.offset.toArray(), first.colorSpace]).toEqual([RepeatWrapping, [3, 5], [0.25, 0.5], SRGBColorSpace]);
  let variantsDisposed = 0, sourcesDisposed = 0;
  a.addEventListener('dispose', () => { variantsDisposed++; }); b.addEventListener('dispose', () => { variantsDisposed++; });
  first.addEventListener('dispose', () => { sourcesDisposed++; }); base.addEventListener('dispose', () => { sourcesDisposed++; });
  scope.dispose(); expect(variantsDisposed).toBe(2); expect(sourcesDisposed).toBe(0);
});

it('leaves unmapped and non-opted-in materials unchanged', () => {
  const scope = new Scope('mesh-map-absent'), original = compileGraph(mapped()).material;
  expect(bindGraphMeshMap(original, undefined, scope)).toBe(original);
  expect(bindGraphMeshMap(original, null, scope)).toBe(original);
  const plain = compileGraph({ version: 1, kind: 'material', nodes: {}, stages: { surface: { colour: [1, 1, 1] } } }).material;
  expect(bindGraphMeshMap(plain, new Texture(), scope)).toBe(plain);
  scope.dispose();
});

it('binds admitted named GLB colour slots when the graph replaces each original model material', async () => {
  const scope = new Scope('mesh-map-props'), first = new Texture(), second = new Texture();
  const one = '1'.repeat(64), two = '2'.repeat(64), model = 'a'.repeat(64);
  const look = { mapped: { family: 'graph' as const, graph: mapped() } };
  const named = v.parse(PropMaterialsSchema, Object.fromEntries(NAMES.map((name, i) => [name, { id: 'mapped', colour: { file: i === 1 ? two : one } }])));
  const file = (hash: string, kind: string, dependencies: string[] = []) => ({ hash, kind, dependencies, compressed: 10, decoded: 0, gpu: 16, triangles: 0, draws: 0, critical: false });
  expect(() => validatePropMaterials(named, { look, models: [model], textures: [], files: [file(model, 'glb', [one, two]), file(one, 'ktx2'), file(two, 'ktx2')] })).not.toThrow();
  const surface = propSurfaces(named, { look, catalogue: new Map(), compile: () => scope.own(compileGraph(mapped()).material), texture: ref => ref === one ? first : second });
  const props = await installDeclaredProps({ family: 'pbr', tiles: [], panels: [], models: [{ id: 'fixture', file: model }], far: null, textures: [] }, {
    scene: new Group(), scope, assets: new Map([[model, await namedMaterialsGlb()]]), materials: new Map([['pbr', new MeshStandardMaterial()]]), surfaces: surface,
  });
  const maps: unknown[] = [], root = props.models.get('fixture'); if (root === undefined) throw new Error('Missing model');
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const material: unknown = object.material;
    if (!(material instanceof Material)) throw new Error('Expected one graph per source draw');
    maps.push(Reflect.get(material, 'map'));
  });
  expect(maps).toEqual([first, second, first]);
  scope.dispose();
});
