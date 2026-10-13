import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare every native attribute byte without a deep-array matcher.
import { Buffer } from 'node:buffer';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { assembleWholeGeometryViews } from '@wildshard/game/plugin/geometry';
import { TimberBlocks } from '../../../src/shards/pine-hollow/world/timberBake';
import { pineLookoutBake, pineSiteTimberBake } from '../../../src/shards/pine-hollow/generators/timberScene';
import { pineTimberWorldBake } from '../../../src/shards/pine-hollow/generators/timberWorld';
import { pineTimberGround, bakeLookoutRows } from '../../../src/shards/pine-hollow/generators/bake-pine-lookout.mjs';
import { bakeSiteTimberRows } from '../../../src/shards/pine-hollow/generators/bake-pine-site-timbers.mjs';
import { timberFrame, ZIP_YAW, landingSite, bridgeSite } from '../../../src/shards/pine-hollow/generators/timberPlacement';
import { LOOKOUT } from '../../../src/shards/pine-hollow/data/layout';
import type { BakedScene } from '@wildshard/sdk/bake';
import type { TimberRow } from '../../../src/shards/pine-hollow/generators/timberRows';

async function compare(authored: BakedScene, bin: Uint8Array, copies: readonly { id: string; row: TimberRow; frame: THREE.Matrix4 }[]): Promise<void> {
  const nodes: THREE.Mesh[] = [];
  for (const bytes of [...authored.assets.values(), ...authored.pieces.map(piece => piece.glb)]) {
    const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
    const isMesh = (node: THREE.Object3D): node is THREE.Mesh => node instanceof THREE.Mesh;
    loaded.scene.traverse(node => { if (isMesh(node)) nodes.push(node); });
  }
  expect(authored.shardfile.tiles.length).toBeGreaterThan(0);
  expect(authored.colliders.scene).toEqual([]); expect(authored.colliders.props).toEqual([]);
  const assembled = assembleWholeGeometryViews(nodes), blocks = new TimberBlocks(bin, bin.length);
  let draws = 0;
  for (const copy of copies) {
    const { parts, glass } = blocks.parts(copy.row);
    for (const [key, list] of [...parts, ['glass', glass] as const]) {
      if (list.length === 0) continue;
      const expected = mergeGeometries([...list]), actual = assembled.get(`${copy.id}-${key}`);
      if (actual === undefined) throw new Error(`Original draw missing: ${copy.id}-${key}`);
      expect(actual.matrix.elements).toEqual(copy.frame.elements);
      expect(actual.geometry.getIndex()).toBeNull();
      expect(Object.keys(actual.geometry.attributes).sort()).toEqual(Object.keys(expected.attributes).sort());
      for (const name of Object.keys(expected.attributes)) {
        const a = actual.geometry.getAttribute(name), b = expected.getAttribute(name);
        expect(a.itemSize).toBe(b.itemSize);
        expect(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength).equals(new Uint8Array(b.array.buffer, b.array.byteOffset, b.array.byteLength)), `${copy.id}:${key}:${name}`).toBe(true);
      }
      expected.dispose(); draws++;
    }
  }
  expect(assembled.size).toBe(draws); blocks.done();
  for (const view of assembled.values()) view.geometry.dispose();
}

it('reconstructs every original lookout draw and placement from its centroid-owned tiles', async () => {
  const ground = pineTimberGround(), { bin, rows } = bakeLookoutRows();
  await compare(pineLookoutBake(ground.heightAt), bin, [{ id: 'fire-lookout', row: rows, frame: timberFrame(LOOKOUT.x, ground.heightAt(LOOKOUT.x, LOOKOUT.z), LOOKOUT.z, ZIP_YAW) }]);
});

it('reconstructs all five native copies from one placed Scene and its non-world Explorer library', async () => {
  const ground = pineTimberGround(), tower = bakeLookoutRows(), sites = bakeSiteTimberRows();
  const binary = new Uint8Array(tower.bin.length + sites.bin.length); binary.set(tower.bin); binary.set(sites.bin, tower.bin.length);
  const baked = pineTimberWorldBake(ground.heightAt);
  expect(baked.pieces.map(piece => piece.name)).toEqual(['pine-timber-explorer']);
  await compare(baked, binary, [
    { id: 'fire-lookout', row: tower.rows, frame: timberFrame(LOOKOUT.x, ground.heightAt(LOOKOUT.x, LOOKOUT.z), LOOKOUT.z, ZIP_YAW) },
    { id: 'zipline-landing', row: sites.rows.landing.world, frame: landingSite(ground.heightAt).at },
    { id: 'zipline-landing-turntable', row: sites.rows.landing.turntable, frame: new THREE.Matrix4() },
    { id: 'creek-footbridge', row: sites.rows.bridge.world, frame: bridgeSite(ground.heightAt).at },
    { id: 'creek-footbridge-turntable', row: sites.rows.bridge.turntable, frame: new THREE.Matrix4() },
  ]);
});

it('places only the real landing and bridge, retaining the four-copy oracle and every gameplay fact', async () => {
  const ground = pineTimberGround(), { bin, rows } = bakeSiteTimberRows();
  // Native oracle bytes include the Explorer copies. Decode past them before comparing real world draws.
  const blocks = new TimberBlocks(bin, bin.length), real: Uint8Array[] = [];
  for (const [row, keep] of [[rows.landing.world, true], [rows.landing.turntable, false], [rows.bridge.world, true], [rows.bridge.turntable, false]] as const) {
    const decoded = blocks.parts(row);
    if (keep) for (const list of [...decoded.parts.values(), decoded.glass]) for (const geometry of list) for (const name of ['position', 'normal', 'uv']) {
      const a = geometry.getAttribute(name); real.push(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
    }
  }
  blocks.done(); const joined = new Uint8Array(real.reduce((size, bytes) => size + bytes.length, 0));
  let offset = 0; for (const bytes of real) { joined.set(bytes, offset); offset += bytes.length; }
  await compare(pineSiteTimberBake(ground.heightAt), joined, [
    { id: 'zipline-landing', row: rows.landing.world, frame: landingSite(ground.heightAt).at },
    { id: 'creek-footbridge', row: rows.bridge.world, frame: bridgeSite(ground.heightAt).at },
  ]);
});
