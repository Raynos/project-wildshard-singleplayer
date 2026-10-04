// oxlint-disable-next-line import/no-nodejs-modules -- The template's admitted bytes are read from the tree.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Content hashes for the admitted-asset reader.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { encodeTerrainTile, terrainTileHeight } from '../src/engine/world/terrainTileData';
import { installTerrainTile, maskTerrainTile } from '../src/engine/world/terrainTileView';
import { addBakedTerrainCollider } from '../src/engine/physics/terrainTiles';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { Rng } from '../src/engine/core/rng';
import { clientViews } from '../src/game/shardfile/clientViews';
import { clientWorld } from '../src/game/shardfile/clientWorld';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { terrainResidency } from '../src/game/shardfile/residency';
import source from '../src/shards/_template/shard.config';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rough = (r: number, seed: number): Float32Array => { const rng = new Rng(seed); return Float32Array.from({ length: r * r }, () => rng.range(-6, 6)); };
function isMesh(o: Object3D): o is Mesh { return o instanceof Mesh; }
const meshes = (root: Object3D): Mesh[] => { const out: Mesh[] = []; root.traverse((o) => { if (isMesh(o)) out.push(o); }); return out; };

describe('terrain tile view (SF15a)', () => {
  it('draws exactly the Rapier heightfield: 2,000 rays on a rough tile agree to 0.1 mm', async () => {
    const r = 9, size = 16, heights = rough(r, 7), data = { resolution: r, x: -40, z: 24, size, heights };
    const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R), scope = new Scope('diagonal');
    try {
      addBakedTerrainCollider(physics, encodeTerrainTile(data), scope); physics.world.step();
      const root = new Group(), mesh = installTerrainTile(encodeTerrainTile({ ...data, colours: new Float32Array(r * r * 3).fill(0.5) }), { root, scope, material: scope.own(new MeshStandardMaterial()), shadow: false });
      root.updateMatrixWorld(true);
      const rng = new Rng(11), caster = new Raycaster(); let worst = 0;
      for (let i = 0; i < 2000; i++) {
        const x = rng.range(data.x + 0.01, data.x + size - 0.01), z = rng.range(data.z + 0.01, data.z + size - 0.01);
        const hit = physics.world.castRay(new R.Ray({ x, y: 100, z }, { x: 0, y: -1, z: 0 }), 200, true); if (hit === null) throw new Error('ray missed the collider');
        caster.set(new Vector3(x, 100, z), new Vector3(0, -1, 0)); const drawn = caster.intersectObject(mesh)[0]; if (drawn === undefined) throw new Error('ray missed the mesh');
        worst = Math.max(worst, Math.abs((100 - hit.timeOfImpact) - drawn.point.y), Math.abs(drawn.point.y - terrainTileHeight(data, x, z)));
      }
      expect(worst).toBeLessThan(1e-4);
    } finally { scope.dispose(); physics.dispose(); }
  });

  it('L0 skirts hang below every edge, face outward and leave the surface alone; neighbours light their shared edge alike', () => {
    const r = 33, size = 62.5, scope = new Scope('skirts'), root = new Group(), material = scope.own(new MeshStandardMaterial());
    const field = (x: number, z: number): number => Math.sin(x * 0.11) * 3 + Math.cos(z * 0.07) * 4;
    const tile = (tx: number): Uint8Array => { const x0 = -250 + tx * size; return encodeTerrainTile({ resolution: r, x: x0, z: -250, size,
      heights: Float32Array.from({ length: r * r }, (_v, i) => field(x0 + (i % r) * size / (r - 1), -250 + Math.floor(i / r) * size / (r - 1))), colours: new Float32Array(r * r * 3).fill(0.4) }); };
    const a = installTerrainTile(tile(0), { root, scope, material, shadow: true }), b = installTerrainTile(tile(1), { root, scope, material, shadow: false });
    expect(a.castShadow).toBe(true); expect(b.castShadow).toBe(false); expect(a.receiveShadow).toBe(true);
    const grid = r * r, ring = 4 * (r - 1), position = a.geometry.getAttribute('position'), index = a.geometry.index;
    expect(position.count).toBe(grid + ring); expect(index?.count).toBe((r - 1) ** 2 * 6 + ring * 6);
    for (let i = 0; i < ring; i++) {
      const x = position.getX(grid + i), z = position.getZ(grid + i);
      expect(x === 0 || z === 0 || Math.abs(x - size) < 1e-4 || Math.abs(z - size) < 1e-4).toBe(true);
      expect(position.getY(grid + i)).toBeCloseTo(field(-250 + x, -250 + z) - size / 16, 4);
    }
    // every skirt triangle is a vertical face along an edge, facing out of the tile
    const centre = new Vector3(size / 2, 0, size / 2), p = [new Vector3(), new Vector3(), new Vector3()];
    for (let t = (r - 1) ** 2 * 6; t < (index?.count ?? 0); t += 3) {
      p.forEach((v, k) => { v.fromBufferAttribute(position, index?.getX(t + k) ?? 0); });
      const normal = new Vector3().subVectors(p[1] ?? centre, p[0] ?? centre).cross(new Vector3().subVectors(p[2] ?? centre, p[0] ?? centre)).normalize();
      const out = new Vector3().addVectors(p[0] ?? centre, p[1] ?? centre).multiplyScalar(0.5).sub(centre).setY(0).normalize();
      expect(Math.abs(normal.y)).toBeLessThan(1e-5); expect(Math.max(Math.abs(normal.x), Math.abs(normal.z))).toBeGreaterThan(0.9999); expect(normal.dot(out)).toBeGreaterThan(0);
    }
    // the shared edge (a's x = r−1 column, b's x = 0 column): same positions, normals within 0.5°
    const na = a.geometry.getAttribute('normal'), nb = b.geometry.getAttribute('normal'), pb = b.geometry.getAttribute('position');
    for (let z = 0; z < r; z++) {
      const ia = z * r + r - 1, ib = z * r;
      expect(position.getY(ia)).toBeCloseTo(pb.getY(ib), 5);
      expect(new Vector3().fromBufferAttribute(na, ia).angleTo(new Vector3().fromBufferAttribute(nb, ib))).toBeLessThan(0.5 * Math.PI / 180);
    }
    expect(() => { maskTerrainTile(a, new Set([0])); }).toThrow(); maskTerrainTile(a, new Set());
    expect(scope.census.geometries).toBe(2); scope.dispose(); expect(root.children).toHaveLength(0); expect(scope.census.geometries).toBe(0);
  });

  it('a coarse tile masks quadrants in its one index buffer and draws nothing it hides', () => {
    const resolution = 17, scope = new Scope('mask'), root = new Group(), material = scope.own(new MeshStandardMaterial());
    const mesh = installTerrainTile(encodeTerrainTile({ resolution, x: -250, z: -250, size: 125, heights: new Float32Array(resolution ** 2), colours: new Float32Array(resolution ** 2 * 3) }), { root, scope, material, shadow: false });
    const index = mesh.geometry.index; expect(mesh.geometry.getAttribute('position').count).toBe(resolution ** 2);
    maskTerrainTile(mesh, new Set([0, 3])); expect(mesh.geometry.index).toBe(index); expect(mesh.geometry.drawRange.count).toBe(128 * 6);
    const values = [...index?.array ?? []].slice(0, mesh.geometry.drawRange.count);
    for (let at = 0; at < values.length; at += 6) {
      const vertex = values[at]; if (vertex === undefined) throw new Error('Missing triangle');
      expect(Number(vertex % resolution >= 8) + Number(Math.floor(vertex / resolution) >= 8) * 2).not.toBeOneOf([0, 3]);
    }
    maskTerrainTile(mesh, new Set()); expect(mesh.geometry.drawRange.count).toBe(256 * 6); expect(mesh.visible).toBe(true);
    maskTerrainTile(mesh, new Set([0, 1, 2, 3])); expect(mesh.geometry.drawRange.count).toBe(0); expect(mesh.visible).toBe(false);
    expect(() => { maskTerrainTile(mesh, new Set([4])); }).toThrow();
    expect(() => installTerrainTile(encodeTerrainTile({ resolution: 2, x: 0, z: 0, size: 1, heights: new Float32Array(4) }), { root, scope, material, shadow: false })).toThrow();
    scope.dispose(); expect(() => installTerrainTile(new Uint8Array(), { root, scope, material, shadow: false })).toThrow();
  });
});

describe('the loader through the views (template shardfile)', () => {
  const assets = new Map(source.files.map((file) => [file.hash, new Uint8Array(readFileSync(new URL(`../src/shards/_template/assets/${file.hash}`, import.meta.url)))]));
  const options = { base: 'https://shards.test/template/shard.json', offline: false, firstParty: true,
    fetch: (url: string): Promise<Response> => { const bytes = assets.get(url.split('/').at(-1) ?? ''); return Promise.resolve(bytes === undefined ? new Response(null, { status: 404 }) : new Response(bytes.slice())); },
    hash: (bytes: Uint8Array): Promise<string> => Promise.resolve(createHash('sha256').update(bytes).digest('hex')) };

  it('keeps fine residency in the 150 m disc, shadows exactly where the data side selects them, no L0/L1 overlap, and unloads to nothing', async () => {
    const scope = new Scope('template-world'), root = new Group(), family = scope.own(new MeshStandardMaterial({ vertexColors: true }));
    const views = clientViews({ root, terrain: source.terrain?.family ?? null, materials: new Map([['pbr', family]]), textures: new Map() });
    const world = await clientWorld(source, new ClientAssets(source, assets, options), { scope, views, x: 0, z: 0 });
    const check = (x: number, z: number): void => {
      const shadows = terrainResidency(x, z).shadows;
      const terrain = meshes(root).filter((m) => m.name.startsWith('terrain:')), fine = terrain.filter((m) => m.geometry.index !== null && m.geometry.getAttribute('position').count > 17 * 17);
      const coarse = terrain.filter((m) => !fine.includes(m));
      expect(coarse).toHaveLength(16); expect(fine.length).toBe(world.fine.size); expect(fine.length).toBeGreaterThan(0);
      for (const m of fine) {
        const box = new Box3().setFromObject(m), cx = Math.max(box.min.x - x, 0, x - box.max.x), cz = Math.max(box.min.z - z, 0, z - box.max.z);
        expect(Math.hypot(cx, cz)).toBeLessThanOrEqual(150);
        expect(m.castShadow).toBe(shadows.has(`0/${Math.round((box.min.x + 250) / 62.5)}/${Math.round((box.min.z + 250) / 62.5)}`));
      }
      // every triangle a coarse tile still draws lies outside every resident fine tile
      const fineBoxes = fine.map((m) => new Box3().setFromObject(m));
      for (const m of coarse) {
        const index = m.geometry.index, position = m.geometry.getAttribute('position'), v = new Vector3();
        for (let t = 0; t < m.geometry.drawRange.count; t += 3) {
          const c = new Vector3(); for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(position, index?.getX(t + k) ?? 0)); c.multiplyScalar(1 / 3).add(m.position);
          expect(fineBoxes.some((b) => c.x > b.min.x && c.x < b.max.x && c.z > b.min.z && c.z < b.max.z)).toBe(false);
        }
      }
    };
    check(0, 0);
    await world.refresh(180, -120); check(180, -120);
    scope.dispose(); expect(root.children).toHaveLength(0); expect(scope.census.geometries).toBe(0);
  });
});
