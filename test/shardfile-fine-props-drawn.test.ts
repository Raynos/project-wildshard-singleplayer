// oxlint-disable-next-line import/no-nodejs-modules -- The template's admitted bytes are read from the tree.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Content hashes for the admitted-asset reader.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Frustum, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PerspectiveCamera, Sphere, Vector3, type Material, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { clientViews } from '../src/game/shardfile/clientViews';
import { clientWorld } from '../src/game/shardfile/clientWorld';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import source from '../src/shards/_template/shard.config';
import { templateProps } from '../scripts/bake/templatePropsSource';

// SHARD-PLATFORM SF16: the M1 board once read as "near props missing on the shardfile side" (the template stair right of
// the hut). The bytes were proven present (template-baked-playground.test.ts); this proves the DRAW path: every resident
// fine (L0) tile's props sit in the scene graph under the client root, visible through every ancestor, with renderer-cull
// bounds that hold every drawn vertex, drawn with their own materials (never a coarse tile's masked variant), and the
// stair is inside the board's close-camera frustum.

function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }
const meshes = (root: Object3D): Mesh[] => { const out: Mesh[] = []; root.traverse((o) => { if (isMesh(o)) out.push(o); }); return out; };
const materials = (mesh: Mesh): Material[] => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
/** visible through every ancestor up to `root` (the renderer skips a hidden subtree) */
function drawnUnder(object: Object3D, root: Object3D): boolean {
  for (let node: Object3D | null = object; node !== null; node = node.parent) { if (!node.visible) return false; if (node === root) return true; }
  return false;
}
/** the sphere the renderer culls with (three's Frustum.intersectsObject), in world space */
function cullSphere(mesh: Mesh): Sphere {
  if (mesh instanceof InstancedMesh) { if (mesh.boundingSphere === null) mesh.computeBoundingSphere(); return (mesh.boundingSphere ?? new Sphere()).clone().applyMatrix4(mesh.matrixWorld); }
  if (mesh.geometry.boundingSphere === null) mesh.geometry.computeBoundingSphere();
  return (mesh.geometry.boundingSphere ?? new Sphere()).clone().applyMatrix4(mesh.matrixWorld);
}
/** every world-space vertex the mesh draws (each instance of an instanced mesh) */
function worldVertices(mesh: Mesh): Vector3[] {
  const position = mesh.geometry.getAttribute('position'), out: Vector3[] = [];
  const instances = mesh instanceof InstancedMesh ? Array.from({ length: mesh.count }, (_v, i) => { const m = new Matrix4(); mesh.getMatrixAt(i, m); return m; }) : [new Matrix4()];
  for (const instance of instances) for (let i = 0; i < position.count; i++) out.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(instance).applyMatrix4(mesh.matrixWorld));
  return out;
}
const pointKey = (p: Vector3): string => [p.x, p.y, p.z].map((n) => n.toFixed(3)).join(',');

it('a resident fine tile draws its props: in the scene graph, visible, cull bounds hold, own materials, the stair in frustum', async () => {
  const assets = new Map(source.files.map((file) => [file.hash, new Uint8Array(readFileSync(new URL(`../src/shards/_template/assets/${file.hash}`, import.meta.url)))]));
  const options = { base: 'https://shards.test/template/shard.json', offline: false, firstParty: true,
    fetch: (url: string): Promise<Response> => { const bytes = assets.get(url.split('/').at(-1) ?? ''); return Promise.resolve(bytes === undefined ? new Response(null, { status: 404 }) : new Response(bytes.slice())); },
    hash: (bytes: Uint8Array): Promise<string> => Promise.resolve(createHash('sha256').update(bytes).digest('hex')) };
  const props = source.props; if (props === null) throw new Error('The template declares props');
  const scope = new Scope('fine-props'), scene = new Group(), root = new Group(); scene.add(root);
  const family = scope.own(new MeshStandardMaterial({ vertexColors: true })), fixture = templateProps(20);
  // which prop root each tile installs into: the views attach a tile's root under `root` as a direct child
  const installed = new Map<string, Object3D>();
  const views = clientViews({ root, terrain: source.terrain?.family ?? null, materials: new Map([[props.family, family]]), textures: new Map() });
  const tracking: typeof views = { ...views, props: async (p, key, bytes, tileScope) => {
    const before = new Set(root.children), tile = await views.props(p, key, bytes, tileScope);
    const added = root.children.filter((child) => !before.has(child)); expect(added).toHaveLength(1);
    const [child] = added; if (child !== undefined) { installed.set(key, child); tileScope.onDispose(() => { installed.delete(key); }); }
    return tile;
  } };
  try {
    const spawn = source.spawn, world = await clientWorld(source, new ClientAssets(source, assets, options), { scope, views: tracking, x: spawn.x, z: spawn.z });
    scene.updateMatrixWorld(true);
    const fineWithProps = [...world.fine].filter((key) => props.tiles.some((tile) => `${tile.lod}/${tile.x}/${tile.z}` === key));
    expect(fineWithProps).toContain('0/4/3'); // the stair and slope tile (template-baked-playground.test.ts)
    const coarseMaterials = new Set<Material>();
    for (const [key, tile] of installed) if (key.startsWith('1/')) for (const mesh of meshes(tile)) for (const m of materials(mesh)) coarseMaterials.add(m);
    const drawn = new Set<string>();
    for (const key of fineWithProps) {
      const tile = installed.get(key); if (tile === undefined) throw new Error(`Resident fine tile ${key} installed no props root`);
      // 0/5/3 and 0/5/4 are empty on purpose: the practice pads above them are a hidden panel, not tile content
      for (const mesh of meshes(tile)) {
        expect(drawnUnder(mesh, root), `${key} ${mesh.name}: hidden or detached`).toBe(true);
        expect(mesh.geometry.drawRange.count, `${key} ${mesh.name}: empty draw range`).toBeGreaterThan(0);
        for (const m of materials(mesh)) { expect(m.visible).toBe(true); expect(coarseMaterials.has(m), `${key} ${mesh.name}: draws with a coarse tile's masked material`).toBe(false); }
        const sphere = cullSphere(mesh), vertices = worldVertices(mesh);
        for (const v of vertices) expect(sphere.distanceToPoint(v), `${key} ${mesh.name}: vertex outside its cull bounds`).toBeLessThan(1e-3);
        for (const v of vertices) drawn.add(pointKey(v));
      }
    }
    // every stair tread and slope vertex the generator authored is drawn by a resident fine tile
    const ramp = fixture.source.static.children[1]; if (ramp === undefined) throw new Error('Missing generator ramp');
    ramp.updateMatrixWorld(true);
    let rampVertices = 0;
    for (const mesh of meshes(ramp)) for (const v of worldVertices(mesh)) { expect(drawn.has(pointKey(v)), `stair vertex ${pointKey(v)} not drawn`).toBe(true); rampVertices++; }
    expect(rampVertices).toBeGreaterThan(0);
    // the board's close stair camera ((4,-6) toward (8,-11), portrait, Hor+ 86.8 deg): the stair meshes pass the cull
    const camera = new PerspectiveCamera(86.8, 402 / 874, 0.1, 500); camera.position.set(4, 1.6, -6); camera.lookAt(8, 0.5, -11); camera.updateMatrixWorld(true);
    const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const stairTile = installed.get('0/4/3'); if (stairTile === undefined) throw new Error('Missing stair tile');
    expect(meshes(stairTile).filter((mesh) => frustum.intersectsSphere(cullSphere(mesh))).length).toBeGreaterThan(0);
  } finally { fixture.dispose(); scope.dispose(); }
  expect(root.children).toHaveLength(0);
});
