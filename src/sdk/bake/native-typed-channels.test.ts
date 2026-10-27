import { expect, it } from 'vitest';
import { BoxGeometry, BufferAttribute, Float16BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { createRigLoader } from '@wildshard/engine/anim/rigParser';
import { nativeWholeGeometry } from '@wildshard/engine/models/nativeGeometry';
import * as v from 'valibot';
import { staticGlb } from './glb';

const GlbJson = v.object({ accessors: v.array(v.object({ componentType: v.number() })),
  meshes: v.array(v.object({ primitives: v.array(v.object({ attributes: v.record(v.string(), v.number()) })) })) });
const json = (glb: Uint8Array): v.InferOutput<typeof GlbJson> =>
  v.parse(GlbJson, JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + new DataView(glb.buffer, glb.byteOffset).getUint32(12, true)))));

it('a nativeOnce GLB writes an integer channel once in its type and a half channel only as its bits, and restores both exactly', async () => {
  const geometry = new BoxGeometry(2, 3, 4), count = geometry.getAttribute('position').count;
  const tag = new Uint16Array(count * 2).map((_, i) => (i * 37) % 65535), half = new Uint16Array(count * 4).map((_, i) => 0x3c00 + (i % 512));
  geometry.setAttribute('tag', new BufferAttribute(tag, 2));
  geometry.setAttribute('half', new Float16BufferAttribute(half, 4));
  const glb = staticGlb([{ geometry, material: new MeshStandardMaterial(), nativeAttributes: true, nativeOnce: true, customAttributes: { _TAG: 'tag', _HALF: 'half' } }]);
  const { accessors, meshes } = json(glb), attributes = meshes[0]?.primitives[0]?.attributes ?? {};
  // no float32 copy of either channel: the integer one is stored once as Uint16, the half one only as its raw bits
  expect(accessors[attributes['_TAG'] ?? -1]?.componentType).toBe(5123);
  expect(attributes['_HALF']).toBeUndefined();
  expect(accessors[attributes['_WS_RAW_HALF'] ?? -1]?.componentType).toBe(5123);
  const gltf = await createRigLoader().parseBytesAsync(glb, '');
  let node: Mesh | undefined;
  gltf.scene.traverse(child => { if (child instanceof Mesh) node = child; });
  if (node === undefined) throw new Error('Missing native mesh');
  const restored = nativeWholeGeometry(node);
  expect(Array.from(restored.getAttribute('tag').array)).toEqual(Array.from(tag));
  const halves = restored.getAttribute('half');
  expect(halves).toBeInstanceOf(Float16BufferAttribute);
  expect(Array.from(halves.array)).toEqual(Array.from(half));
});
