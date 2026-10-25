// Build-only map geometry: no forest, level or runtime services are imported.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { BufferGeometry, Float32BufferAttribute, Matrix4 } from 'three';
import { MapAssembly as OwnedMapAssembly } from '../src/sdk/bake/mapAssembly.ts';

export const readMapJson = file => JSON.parse(readFileSync(file, 'utf8'), (_key, value) => value === '-0' ? -0 : value === 'Infinity' ? Infinity : value === '-Infinity' ? -Infinity : value);

/** Prepared specimens borrow local geometry, ignoring the source node's pose.
 * Raw sculpts explicitly opt into the node transform, as their live loader does. */
export async function mapModel(file, slot = 0, world = false) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(file instanceof Uint8Array ? file : new Uint8Array(readFileSync(file)));
  const node = doc.getRoot().listNodes().filter(row => row.getMesh() !== null).at(slot), mesh = node?.getMesh();
  if (mesh?.listPrimitives().length !== 1) throw new Error(`Map model needs one primitive: ${file}:${slot}`);
  const primitive = mesh.listPrimitives()[0], geometry = new BufferGeometry();
  for (const [semantic, name] of [['POSITION', 'position'], ['COLOR_0', 'color']]) {
    const source = primitive.getAttribute(semantic); if (source === null) continue;
    const values = [];
    for (let i = 0; i < source.getCount(); i++) values.push(...source.getElement(i, []).slice(0, 3));
    geometry.setAttribute(name, new Float32BufferAttribute(values, 3));
  }
  const index = primitive.getIndices(); if (index !== null) geometry.setIndex(Array.from(index.getArray()));
  if (world) geometry.applyMatrix4(new Matrix4().fromArray(node.getWorldMatrix()));
  return geometry;
}

export class MapAssembly extends OwnedMapAssembly {
  /** Encode the same ordered scene and geometry without publishing source files. */
  encode() {
    const { json, binary } = this.pack();
    return { json, binary: new Uint8Array(deflateSync(binary)) };
  }
  write(file) {
    const { json, binary } = this.encode();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.bin`, binary);
    writeFileSync(`${file}.json`, json);
    for (const shape of this.shapes) { shape.geometry.dispose(); shape.material.dispose(); }
  }
}
