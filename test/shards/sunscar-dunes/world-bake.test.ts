import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bake's bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readdirSync, readFileSync } from 'node:fs';
import { InstancedMesh, Matrix4, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { signalDunesField } from '../../../src/shards/sunscar-dunes/generators/tiles';
import { bakeSignalRocks, buildRocks } from '../../../src/shards/sunscar-dunes/generators/rocks';
import { bakedRocks } from '../../../src/shards/sunscar-dunes/world/baked';
import rocks from '../../../src/shards/sunscar-dunes/data/rocks.json' with { type: 'json' };

const folder = new URL('../../../public/assets/sunscar-dunes/baked/', import.meta.url);
const instanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('Signal Dunes bakes its code-built world offline (SHARD-PLATFORM SF72, SF67 fix 3)', () => {
  it('the committed rock field is byte-exact against its generator (the stale gate: rerun scripts/bake-signal-world.mjs)', () => {
    const { glb, ...rows } = bakeSignalRocks();
    expect({ glb: sha(glb), ...rows }).toEqual(rocks);
    expect(sha(new Uint8Array(readFileSync(new URL('rocks.glb', folder))))).toBe(rocks.glb);
    // the folder holds exactly this bake: no orphan GLB from an older bake ships
    expect(readdirSync(folder).filter((name) => name.endsWith('.glb'))).toEqual(['rocks.glb']);
  });

  it('the client draws the bake: one instanced draw per kind on the builder\'s own transforms, the builder\'s colliders', async () => {
    const bytes = readFileSync(new URL('rocks.glb', folder)), gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const nodes: InstancedMesh[] = []; gltf.scene.traverse((node) => { if (instanced(node)) nodes.push(node); });
    const baked = new Map(rocks.kinds.map((kind, i) => { const node = nodes[i]; if (node === undefined) throw new Error('missing node'); return [kind.name, node]; }));
    const drawn = bakedRocks(baked), source = bakeSignalRocks();
    expect(drawn.colliders).toEqual(source.colliders);
    const [ridges] = drawn.root.children; if (!(ridges instanceof InstancedMesh)) throw new Error('ridges not instanced');
    expect([drawn.root.children.length, ridges.count, ridges.castShadow]).toEqual([1, 30, false]);
    // the GLB's TRS round trip keeps every instance within float32 noise of the builder's own matrix (≤ 1e-5 m on the field)
    const field = signalDunesField(), built = buildRocks(field.heightAt, field.trailDistance);
    const want = new Matrix4(), got = new Matrix4();
    for (let i = 0; i < ridges.count; i++) {
      ridges.getMatrixAt(i, got); built.ridges.getMatrixAt(i, want);
      got.elements.forEach((n, k) => { expect(Math.abs(n - (want.elements[k] ?? Infinity))).toBeLessThan(1e-5); });
    }
  });
});
