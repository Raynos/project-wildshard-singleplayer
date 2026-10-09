import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bake's bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readdirSync, readFileSync } from 'node:fs';
import { InstancedMesh, Matrix4, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { signalDunesField } from '../../../src/shards/sunscar-dunes/generators/tiles';
import { bakeSignalRocks, buildRocks } from '../../../src/shards/sunscar-dunes/generators/rocks';
import { bakeSignalDressing, buildDressing } from '../../../src/shards/sunscar-dunes/generators/dressing';
import type { PieceBake } from '../../../src/shards/sunscar-dunes/generators/kinds';
import { bakedPiece, type BakedWorld } from '../../../src/shards/sunscar-dunes/world/baked';
import { BAKED_PIECES, type BakedPiece } from '../../../src/shards/sunscar-dunes/boot/files';
import rocks from '../../../src/shards/sunscar-dunes/data/rocks.json' with { type: 'json' };
import dressing from '../../../src/shards/sunscar-dunes/data/dressing.json' with { type: 'json' };

const folder = new URL('../../../public/assets/sunscar-dunes/baked/', import.meta.url);
const instanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const ROWS: Record<BakedPiece, { glb: string; kinds: readonly { name: string }[] }> = { rocks, dressing };
const BAKES: Record<BakedPiece, () => PieceBake> = { rocks: bakeSignalRocks, dressing: bakeSignalDressing };

async function loadBaked(): Promise<BakedWorld> {
  const world = new Map<BakedPiece, Map<string, InstancedMesh>>();
  for (const piece of BAKED_PIECES) {
    const bytes = readFileSync(new URL(`${piece}.glb`, folder)), gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const nodes: InstancedMesh[] = []; gltf.scene.traverse((node) => { if (instanced(node)) nodes.push(node); });
    world.set(piece, new Map(ROWS[piece].kinds.map((kind, i) => { const node = nodes[i]; if (node === undefined) throw new Error('missing node'); return [kind.name, node]; })));
  }
  return world;
}
const near = (got: InstancedMesh, want: InstancedMesh): void => {
  const a = new Matrix4(), b = new Matrix4();
  for (let i = 0; i < got.count; i++) {
    got.getMatrixAt(i, a); want.getMatrixAt(i, b);
    a.elements.forEach((n, k) => { expect(Math.abs(n - (b.elements[k] ?? Infinity))).toBeLessThan(1e-5); });
  }
};

describe('Signal Dunes bakes its code-built world offline (SHARD-PLATFORM SF72, SF67 fix 3)', () => {
  it('every committed piece is byte-exact against its generator (the stale gate: rerun scripts/bake-signal-world.mjs)', () => {
    for (const piece of BAKED_PIECES) {
      const { glb, ...rows } = BAKES[piece]();
      expect({ glb: sha(glb), ...rows }).toEqual(ROWS[piece]);
      expect(sha(new Uint8Array(readFileSync(new URL(`${piece}.glb`, folder))))).toBe(ROWS[piece].glb);
    }
    // the folder holds exactly this bake: no orphan GLB from an older bake ships
    expect(readdirSync(folder).filter((name) => name.endsWith('.glb')).sort()).toEqual(BAKED_PIECES.map((piece) => `${piece}.glb`).sort());
  });

  it('the client draws the bake: one instanced draw per kind on the builder\'s own transforms, the builder\'s colliders', async () => {
    const baked = await loadBaked(), field = signalDunesField();
    const drawnRocks = bakedPiece(baked, 'rocks');
    expect(drawnRocks.colliders).toEqual(bakeSignalRocks().colliders);
    const [ridges] = drawnRocks.root.children; if (ridges === undefined || !instanced(ridges)) throw new Error('ridges not instanced');
    expect([drawnRocks.root.children.length, ridges.count, ridges.castShadow]).toEqual([1, 30, false]);
    // the GLB's TRS round trip keeps every instance within float32 noise of the builder's own matrix (≤ 1e-5 m on the field)
    near(ridges, buildRocks(field.heightAt, field.trailDistance).ridges);

    const drawn = bakedPiece(baked, 'dressing'), built = buildDressing(field.heightAt, field.trailDistance);
    expect(drawn.colliders).toEqual(bakeSignalDressing().colliders);
    expect(drawn.root.children.map((m) => instanced(m) ? m.count : -1)).toEqual([built.counts.carcasses, built.counts.trees, built.counts.scree]);
    const [carcasses, trees, scree] = drawn.root.children;
    for (const [got, want] of [[carcasses, built.meshes.carcasses], [trees, built.meshes.trees], [scree, built.meshes.scree]] as const) {
      if (got === undefined || !instanced(got)) throw new Error('dressing kind not instanced');
      near(got, want);
      // the soup draws unindexed, its own vertices
      expect([got.geometry.getIndex(), got.geometry.getAttribute('position').count]).toEqual([want.geometry.getIndex(), want.geometry.getAttribute('position').count]);
    }
  });
});
