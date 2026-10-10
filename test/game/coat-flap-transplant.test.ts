// oxlint-disable-next-line import/no-nodejs-modules -- the committed rig is the fixture
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- the fixture's digest
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- the GLB's chunks
import { Buffer } from 'node:buffer';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { expect, it } from 'vitest';
import { flapTransplant } from '../../src/game/systems/looks/coatAtlas';
import { pressFlap } from '../../src/game/systems/looks/riggedHulls';
import { PINE_HULLS } from '../../src/shards/pine-hollow/data/hulls';

/**
 * E435 SF63: flapTransplant's nearest-texel search moved from string-keyed cells (4.9 s / 8.7 s per bear hull on the main
 * thread, Pine Hollow's herd spawn) to dense cells with normal bounds. The digests are the old search's output on the
 * shipped rigs at 1024²: the new search must find the very same texels.
 */
const OLD_SEARCH: Readonly<Record<string, string>> = {
  'bear-brown': '42468b86ddb2b3034920a6615c6ca3fc18ea92ae',
  'bear-black': 'f270b431a6a13172b5db4443e8fa8753cf2351bc',
};

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true;

/** the GLB with its materials dropped (Node decodes no WebP): the geometry is all the transplant reads */
function geometryOnly(glb: Buffer): ArrayBuffer {
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8')) as { meshes?: { primitives: { material?: number }[] }[]; [k: string]: unknown };
  for (const key of ['materials', 'textures', 'images', 'samplers']) Reflect.deleteProperty(json, key);
  for (const mesh of json.meshes ?? []) for (const p of mesh.primitives) Reflect.deleteProperty(p, 'material');
  const text = Buffer.from(JSON.stringify(json), 'utf8'), pad = (4 - (text.length % 4)) % 4;
  const chunk = Buffer.concat([text, Buffer.alloc(pad, 0x20)]), rest = glb.subarray(20 + jsonLength);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + chunk.length + rest.length, 8);
  head.writeUInt32LE(chunk.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  const out = Buffer.concat([head, chunk, rest]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

async function rigGeometry(hull: string): Promise<THREE.BufferGeometry> {
  const bytes = geometryOnly(readFileSync(`public/assets/pine-hollow/creatures/${hull}.rigged.glb`));
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(bytes, '');
  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => { if (isMesh(o)) meshes.push(o); });
  const src = meshes[0]?.geometry;
  if (src === undefined) throw new Error(`${hull}: no mesh`);
  const out = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'uv'] as const) {
    const a = src.getAttribute(key), arr = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);
    out.setAttribute(key, new THREE.BufferAttribute(arr, a.itemSize));
  }
  const index = src.getIndex();
  if (index !== null) out.setIndex(Array.from(index.array));
  return out;
}

for (const [hull, digest] of Object.entries(OLD_SEARCH)) {
  it(`${hull}: the flap transplant finds the old search's texels`, async () => {
    const geo = await rigGeometry(hull);
    const trim = PINE_HULLS.flaps?.[hull];
    const pos = geo.getAttribute('position').array, nrm = geo.getAttribute('normal').array, index = geo.getIndex()?.array;
    if (trim === undefined || !(pos instanceof Float32Array) || !(nrm instanceof Float32Array) || index === undefined) throw new Error(`${hull}: no flap fixture`);
    const flap = pressFlap(pos, nrm, index, trim);
    if (flap === null) throw new Error(`${hull}: nothing pressed`);
    const map = flapTransplant(geo, flap, 1024, 1024, false);
    if (map === null) throw new Error(`${hull}: no transplant`);
    const got = createHash('sha1').update(new Uint8Array(map.dst.buffer)).update(new Uint8Array(map.src.buffer)).update(new Uint8Array(map.w.buffer)).digest('hex');
    expect(got).toBe(digest);
  }, 30_000);
}
