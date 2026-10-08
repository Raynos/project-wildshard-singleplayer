import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as v from 'valibot';
import { bakeProps } from '../src/sdk/bake/props';
import { staticGlb } from '../src/sdk/bake/glb';
import { parseGlb } from '../src/sdk/assets';
import { emptyShardfile } from '../src/sdk/author';
import { contentHash, validateProject } from '../src/sdk/project';
import { PropsSchema, propColliderDescriptors, validatePropsReferences } from '../src/game/shardfile/props';
import { installDeclaredProps } from '../src/engine/world/declaredProps';
import { Scope } from '../src/engine/app/scope';
import { bakeTerrain } from '../src/sdk/bake/terrain';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { installDeclaredPropColliders } from '../src/engine/physics/declaredProps';
import { castRay } from '../src/engine/physics/query';
import { tagOf } from '../src/engine/physics/surface';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { templateProps } from '../scripts/bake/templatePropsSource';

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });
const source = () => { const fixture = templateProps(); cleanups.push(fixture.dispose); return fixture; };
/** the yard's 20 (hut 5, door 1, ramp 11, practice pads 3) and G220's cell fill: 94 set-piece and hub boxes, 56 lamp posts, and pass 2's 269 district, entry-extra and plot shapes */
const COLLIDERS = 20 + 94 + 56 + 269;
const terrain = () => bakeTerrain({ heightAt: () => 0, colourAt: () => [0.2, 0.2, 0.2] });

describe('declared prop baker', () => {
  it('reconnects stable collider handles after replacing Physics without allocating duplicate colliders', async () => {
    const rows = propColliderDescriptors(bakeProps(source().source).props), R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
    let physics = new Physics(R); const first = new Scope('props.before'), restoredScope = new Scope('props.restored');
    try {
      const ports = installDeclaredPropColliders(rows, () => physics, first), door = ports.get('template.door');
      if (door === undefined) throw new Error('Missing door port'); door.setActive(false);
      physics.world.forEachCollider((collider) => expect(typeof tagOf(collider)?.owner).toBe('string'));
      const states = new Map([...ports].map(([id, port]) => [id, port.snapshot()])), bytes = physics.world.takeSnapshot();
      const restored = installDeclaredPropColliders(rows, () => physics, restoredScope, states);
      expect(physics.world.colliders.len()).toBe(COLLIDERS);
      physics.dispose(); physics = new Physics(R, bytes);
      const restoredDoor = restored.get('template.door'); if (restoredDoor === undefined) throw new Error('Missing restored door');
      expect(restoredDoor.active()).toBe(false); restoredDoor.setActive(true); expect(restoredDoor.active()).toBe(true);
      restoredScope.dispose(); expect(physics.world.colliders.len()).toBe(0);
    } finally { restoredScope.dispose(); first.dispose(); physics.dispose(); }
  });
  it('installs the exact hut, ramp, door and practice collision descriptors, toggles their active ports, and unloads all colliders', async () => {
    const fixture = source(), hutY = fixture.source.static.children[0]?.position.y;
    expect(hutY).not.toBe(0);
    const baked = bakeProps(fixture.source), R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R), scope = new Scope('props.physics');
    const wall = baked.props.colliders.find((row) => row.id === 'template.hut')?.shapes[0];
    if (hutY === undefined || wall?.kind !== 'box') throw new Error('Missing seeded hut');
    expect(wall.y - wall.hy).toBeCloseTo(hutY, 12);
    try {
      const ports = installDeclaredPropColliders(propColliderDescriptors(baked.props), physics, scope); physics.world.step();
      expect(physics.world.colliders.len()).toBe(COLLIDERS);
      expect(castRay(physics, { x: 0, y: 1.2, z: -7 }, { x: 0, y: 0, z: -1 }, 2.5)).not.toBeNull();
      const door = ports.get('template.door'), course = ports.get('template.jump'); if (door === undefined || course === undefined) throw new Error('Missing collider port');
      door.setActive(false); physics.world.step(); expect(castRay(physics, { x: 0, y: 1.2, z: -7 }, { x: 0, y: 0, z: -1 }, 2.5)).toBeNull();
      expect(course.active()).toBe(false); expect(castRay(physics, { x: 90, y: 35, z: 0 }, { x: 0, y: -1, z: 0 }, 10)).toBeNull();
      course.setActive(true); physics.world.step(); expect(castRay(physics, { x: 90, y: 35, z: 0 }, { x: 0, y: -1, z: 0 }, 10)).not.toBeNull();
      scope.dispose(); expect(physics.world.colliders.len()).toBe(0);
    } finally { scope.dispose(); physics.dispose(); }
  });
  it('bakes the actual template world, scatter, bounded practice pads, door and lantern under caps, and validates actual costs', () => {
    const ground = terrain(), result = bakeProps(source().source, ground.tiles), assets = new Map([...ground.assets, ...result.assets]);
    const input = { ...emptyShardfile({ slug: 'props-fixture', name: 'Props', author: 'Test', revision: 1, seed: 435 }), tiles: result.tiles, files: [...ground.files, ...result.files], far: result.far, library: result.library,
      edge: ground.edge, critical: ground.critical, terrain: ground.terrain, budgets: { library: { resident: 100000, compressed: 100000 }, sim: { resident: 600000, compressed: 300000 }, overlap: 0 }, serverBudget: { tickMicros: 1000, memory: 600000, entities: 1, commandsPerTick: 1 } };
    expect(() => validatePropsReferences(result.props, input)).not.toThrow(); expect(() => validateProject(input, assets)).not.toThrow();
    expect(Math.max(...result.report.filter((t) => t.lod === 0).map((t) => t.draws))).toBeLessThanOrEqual(8);
    expect(Math.max(...result.report.filter((t) => t.lod === 1).map((t) => t.draws))).toBe(2);
    expect(result.far.draws).toBe(1); expect(result.props.panels[0]?.id).toBe('template.door'); expect(result.props.models[0]?.id).toBe('template.lantern');
    for (const [hash, bytes] of result.assets) expect(contentHash(bytes)).toBe(hash);
  });
  it('is deterministic and the real loader reconstructs instance matrices, geometry and panel ports, then scope disposal removes roots', async () => {
    // Full-template admission is covered above. This lifecycle fixture stays bounded when teaching content grows.
    const geometry = new BoxGeometry(1, 1, 1), material = new MeshStandardMaterial(), root = new Group();
    const fixed = new Mesh(geometry, material); fixed.position.set(-20, 1, -20); root.add(fixed);
    const door = new Mesh(geometry, material); door.position.set(10, 1, 10);
    const transforms = [2, 4, 6].map(x => new Matrix4().makeTranslation(x, 1, 2));
    cleanups.push(() => geometry.dispose(), () => material.dispose());
    const fixture = { static: root, scatter: [{ model: new Mesh(geometry, material), transforms }],
      panels: [{ id: 'template.door', model: door }], models: [{ id: 'template.lantern', model: new Mesh(geometry, material) }] };
    const a = bakeProps(fixture), b = bakeProps(fixture);
    expect(a.props).toEqual(b.props); expect(a.report).toEqual(b.report); expect([...a.assets]).toEqual([...b.assets]);
    const scene = new Group(), scope = new Scope('props.fixture'); cleanups.push(() => scope.dispose());
    const installed = await installDeclaredProps(a.props, { scene, scope, assets: a.assets, materials: new Map([['pbr', material]]) });
    const matrices: number[][] = [];
    scene.traverse((o) => { if (o instanceof InstancedMesh) for (let i = 0; i < o.count; i++) {
      const matrix = new Matrix4(); o.getMatrixAt(i, matrix); matrices.push(matrix.elements);
      if (!(o.geometry instanceof BufferGeometry)) throw new Error('Missing loaded instance geometry');
      const position: unknown = o.geometry.getAttribute('position');
      if (!(position instanceof BufferAttribute)) throw new Error('Missing loaded positions');
      expect(position.count).toBe(geometry.index?.count ?? geometry.getAttribute('position').count);
    } });
    expect(matrices).toEqual(transforms.map(matrix => matrix.elements));
    const panel = installed.panels.get('template.door'); expect(panel).toBeDefined(); if (panel === undefined) throw new Error('Missing panel'); panel.visible = false; expect(panel.visible).toBe(false);
    expect(installed.models.has('template.lantern')).toBe(true); expect(scene.children).toHaveLength(1); scope.dispose(); expect(scene.children).toHaveLength(0);
  });
  it('uses ordinary GLB instancing and admission counts each rendered triangle and each 64-byte matrix', async () => {
    const geometry = new BoxGeometry(1, 1, 1), material = new MeshStandardMaterial(), instances = [new Matrix4().makeTranslation(2, 0, 2), new Matrix4().makeTranslation(4, 0, 4)];
    cleanups.push(() => geometry.dispose(), () => material.dispose());
    const bytes = staticGlb([{ geometry, material, instances }]); const cost = parseGlb(bytes); expect(cost.triangles).toBe(24); expect(cost.draws).toBe(2);
    const gltf = await new GLTFLoader().parseAsync(bytes.slice().buffer, ''); let found = false;
    gltf.scene.traverse((o) => { if (o instanceof InstancedMesh) { found = true; const matrix = new Matrix4(); o.getMatrixAt(1, matrix); expect(matrix.elements).toEqual(instances[1]?.elements); } }); expect(found).toBe(true);
    expect(cost.gpu).toBeGreaterThan(128);
  });
  it('refuses outside-cell geometry, over-budget scatter, malformed references and unsupported transforms', () => {
    const root = new Group(), model = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()); root.add(model); model.position.set(250, 0, 0);
    cleanups.push(() => model.geometry.dispose(), () => model.material.dispose()); expect(() => bakeProps({ static: root })).toThrow(/cell/u);
    model.position.set(2, 0, 2); const transforms = Array.from({ length: 4000 }, () => new Matrix4().makeTranslation(5, 0, 5));
    expect(() => bakeProps({ static: root, scatter: [{ model, transforms }] })).toThrow(/caps/u);
    const result = bakeProps(source().source); expect(() => validatePropsReferences(result.props, { ...result, library: [] })).toThrow(/library/u);
    expect(() => v.parse(PropsSchema, { ...result.props, panels: [...result.props.panels, ...result.props.panels] })).toThrow();
    expect(() => staticGlb([{ geometry: model.geometry, material: model.material, instances: [new Matrix4().makeScale(-1, 1, 1)] }])).toThrow(/TRS/u);
  });
});
