import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bake's bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readdirSync, readFileSync } from 'node:fs';
import { InstancedMesh, Matrix4, Mesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { colliderRows } from '@wildshard/sdk/bake/kinds';
import { bakeSkyWinchHouse, buildWinchHouse } from '../../../src/shards/far-reach/generators/winchHouse';
import { bakeSkyRoost, roost } from '../../../src/shards/far-reach/generators/roost';
import { skyBakedPiece } from '../../../src/shards/far-reach/world/baked';
import { BAKED_PIECES } from '../../../src/shards/far-reach/boot/files';
import { STEP, WINCH_HOUSE } from '../../../src/shards/far-reach/data/layout';
import winchHouse from '../../../src/shards/far-reach/data/winchHouse.json' with { type: 'json' };
import roostRows from '../../../src/shards/far-reach/data/roost.json' with { type: 'json' };

const folder = new URL('../../../public/assets/far-reach/baked/', import.meta.url);
const instanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;
const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

async function nodesOf(piece: string, kinds: readonly { name: string }[]): Promise<Map<string, InstancedMesh>> {
  const bytes = readFileSync(new URL(`${piece}.glb`, folder)), gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const nodes: InstancedMesh[] = []; gltf.scene.traverse((node) => { if (instanced(node)) nodes.push(node); });
  return new Map(kinds.map((kind, i) => { const node = nodes[i]; if (node === undefined) throw new Error('missing node'); return [kind.name, node]; }));
}

describe('Sky Reach bakes its code-built world offline (SHARD-PLATFORM SF72)', () => {
  it('every committed piece is byte-exact against its generator (the stale gate: rerun scripts/bake-sky-world.mjs)', () => {
    const pieces = [['winch-house', bakeSkyWinchHouse(), winchHouse], ['roost', bakeSkyRoost(), roostRows]] as const;
    for (const [piece, { glb, ...rows }, committed] of pieces) {
      expect({ glb: sha(glb), ...rows }).toEqual(committed);
      expect(sha(new Uint8Array(readFileSync(new URL(`${piece}.glb`, folder))))).toBe(committed.glb);
    }
    // the folder holds exactly this bake: no orphan GLB from an older bake ships
    expect(readdirSync(folder).filter((name) => name.endsWith('.glb')).sort()).toEqual(BAKED_PIECES.map((piece) => `${piece}.glb`).sort());
  });

  it('the winch house draws every built mesh as one instance of a kind, its shack parts in their shaders with their `shk` channel', async () => {
    const drawn = skyBakedPiece('winch-house', await nodesOf('winch-house', winchHouse.kinds)), built = buildWinchHouse(), meshes: Mesh[] = [];
    // the client stands the piece on the step (world/build.ts); the parts keep the house's own frame
    drawn.root.position.set(WINCH_HOUSE.x, STEP.y, WINCH_HOUSE.z); drawn.root.updateMatrixWorld(true);
    // the builder's own box (its `-0` yaw is the rows' `0`)
    expect(drawn.colliders).toEqual(colliderRows(built.colliders));
    built.group.updateMatrixWorld(true); built.group.traverse((o) => { if (isMesh(o)) meshes.push(o); });
    const kinds = drawn.root.children.filter(instanced);
    expect(kinds.length).toBe(winchHouse.kinds.length);
    expect(kinds.reduce((n, m) => n + m.count, 0)).toBe(meshes.length);
    // fewer draws than meshes, never multi-draw: one instanced mesh per kind
    expect(kinds.length).toBeLessThan(meshes.length);
    for (const mesh of kinds) {
      const shack = mesh.geometry.hasAttribute('shk');
      expect(Array.isArray(mesh.material)).toBe(false);
      // a shack kind is drawn in its pattern shader, which reads `shk`
      const material = mesh.material, patched = !Array.isArray(material) && material.defines !== undefined && 'SHK_MODE' in material.defines;
      expect(patched).toBe(shack);
      // the soups draw unindexed, as built (the GLB's identity index dropped)
      if (shack) expect(mesh.geometry.getIndex()).toBe(null);
    }
    // every vertex of every built mesh lands where an instance of its kind puts it (≤ 1e-4 m after the TRS round trip)
    const all = kinds.flatMap((o) => Array.from({ length: o.count }, (_, i) => { const t = new Matrix4(); o.getMatrixAt(i, t); return { o, t: t.premultiply(drawn.root.matrixWorld) }; }));
    const want = new Vector3(), got = new Vector3();
    for (const mesh of meshes) {
      const p = mesh.geometry.getAttribute('position');
      const hit = all.find(({ o, t }) => {
        const q = o.geometry.getAttribute('position'); if (q.count !== p.count) return false;
        for (let v = 0; v < p.count; v += Math.max(1, Math.floor(p.count / 16))) {
          want.fromBufferAttribute(p, v).applyMatrix4(mesh.matrixWorld);
          if (got.fromBufferAttribute(q, v).applyMatrix4(t).distanceTo(want) >= 1e-4) return false; // a box's unit corner scales onto its own
        }
        return true;
      });
      expect(hit).toBeDefined();
    }
  });

  it('the Roost draws every built mesh and stick / feather instance as an instance of a kind, the tints restored', async () => {
    const drawn = skyBakedPiece('roost', await nodesOf('roost', roostRows.kinds)), built = roost();
    drawn.root.updateMatrixWorld(true); built.group.updateMatrixWorld(true);
    expect(drawn.colliders).toEqual(colliderRows(built.colliders));
    // the built pieces: each plain mesh once, each instance of an instanced mesh with its colour
    const want: { geometry: Mesh['geometry']; matrix: Matrix4; color?: number[] }[] = [];
    built.group.traverse((o) => {
      if (instanced(o)) for (let i = 0; i < o.count; i++) { const m = new Matrix4(); o.getMatrixAt(i, m); want.push({ geometry: o.geometry, matrix: m.premultiply(o.matrixWorld), ...(o.instanceColor === null ? {} : { color: [o.instanceColor.getX(i), o.instanceColor.getY(i), o.instanceColor.getZ(i)] }) }); }
      else if (isMesh(o)) want.push({ geometry: o.geometry, matrix: o.matrixWorld });
    });
    const kinds = drawn.root.children.filter(instanced);
    expect(kinds.length).toBe(roostRows.kinds.length);
    expect(kinds.reduce((n, m) => n + m.count, 0)).toBe(want.length);
    const all = kinds.flatMap((o) => Array.from({ length: o.count }, (_, i) => { const t = new Matrix4(); o.getMatrixAt(i, t); return { o, i, t: t.premultiply(drawn.root.matrixWorld) }; }));
    const a = new Vector3(), b = new Vector3();
    for (const w of want) {
      const p = w.geometry.getAttribute('position');
      const hit = all.find(({ o, t }) => {
        const q = o.geometry.getAttribute('position'); if (q.count !== p.count) return false;
        for (let v = 0; v < p.count; v += Math.max(1, Math.floor(p.count / 16))) if (b.fromBufferAttribute(q, v).applyMatrix4(t).distanceTo(a.fromBufferAttribute(p, v).applyMatrix4(w.matrix)) >= 1e-4) return false;
        return true;
      });
      expect(hit).toBeDefined();
      if (hit !== undefined && w.color !== undefined) {
        const c = hit.o.instanceColor;
        expect(c === null ? null : [c.getX(hit.i), c.getY(hit.i), c.getZ(hit.i)]).toEqual(w.color);
      }
    }
  });
});
