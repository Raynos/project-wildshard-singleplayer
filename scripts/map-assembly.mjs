// Build-only geometry inventory for worlds whose boot still assembles copies.
// Persist exact matrices beside a local geometry pool; the painter never boots
// a shard or runs a model factory.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { BufferGeometry, Float32BufferAttribute, Matrix4, MeshBasicMaterial } from 'three';
import { GeometryPackWriter } from '../src/sdk/kit/geometryPack.ts';
import { readBakedGeometry } from '../src/sdk/kit/bakedGeometry.ts';
import { _applyChunkConstants } from '../src/engine/core/config.ts';
import { configureLevel } from '../src/engine/level/selection.ts';
import { placeForest } from '../src/engine/world/forest/placement.ts';

export function mapForest(constants, field, forest, variants) {
  _applyChunkConstants(constants);
  configureLevel({ id: constants.slug, ground: { terrain: field }, forest });
  return placeForest(variants).trees;
}

export const readMapJson = file => JSON.parse(readFileSync(file, 'utf8'), (_key, value) => value === '-0' ? -0 : value === 'Infinity' ? Infinity : value === '-Infinity' ? -Infinity : value);
export function mapBinary(file, shuffled = false) {
  const bytes = new Uint8Array(inflateSync(readFileSync(file)));
  if (!shuffled) return bytes;
  const out = new Uint8Array(bytes.length), n = bytes.length / 4;
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) out[i * 4 + b] = bytes[b * n + i];
  return out;
}
export function mapGeometry(bytes, offset, row) {
  const geometry = readBakedGeometry(bytes, offset, row);
  if (!row.expand || geometry.index === null) return geometry;
  const expanded = geometry.toNonIndexed(); geometry.dispose(); return expanded;
}
/** Prepared specimens borrow local geometry, ignoring the source node's pose.
 * Raw sculpts explicitly opt into the node transform, as their live loader does. */
export async function mapModel(file, slot = 0, world = false) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(new Uint8Array(readFileSync(file)));
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

export class MapAssembly {
  shapes = [];
  nodes = [];
  inventory = {};
  add(name, geometry, matrices = [new Matrix4()]) {
    if (matrices.length === 0 || geometry.getAttribute('position').count === 0) return;
    const id = `part-${this.shapes.length}`;
    const material = new MeshBasicMaterial({ vertexColors: geometry.hasAttribute('color') });
    this.shapes.push({ name: id, geometry, material });
    // InstancedMesh stores float32 matrices in play; retain that same rounding.
    this.nodes.push({ id, kind: 'mesh', name, geometry: id, material: 'map', instances: matrices.length,
      matrices: matrices.flatMap(matrix => Array.from(Float32Array.from(matrix.elements))) });
    this.inventory[name] = (this.inventory[name] ?? 0) + matrices.length;
  }
  write(file) {
    mkdirSync(dirname(file), { recursive: true });
    const pack = new GeometryPackWriter('map-assembly');
    for (const shape of this.shapes) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', shape.geometry.getAttribute('position'));
      const source = shape.geometry.getAttribute('color'), colour = shape.material.color.toArray();
      const count = geometry.getAttribute('position').count, values = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) values[i * 3 + c] = (source?.getComponent(i, c) ?? .45) * colour[c];
      geometry.setAttribute('color', new Float32BufferAttribute(values, 3)); geometry.setIndex(shape.geometry.getIndex());
      pack.add(geometry); geometry.dispose();
    }
    writeFileSync(`${file}.bin`, deflateSync(pack.bytes()));
    const scene = { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: this.nodes.map(row => row.id) }, ...this.nodes], materials: [{ id: 'map', kind: 'port', source: 'map' }] };
    writeFileSync(`${file}.json`, `${JSON.stringify({ version: 1, inventory: this.inventory, pack: { ...pack.rows(), names: this.shapes.map(row => row.name) }, scene })}\n`);
    for (const shape of this.shapes) { shape.geometry.dispose(); shape.material.dispose(); }
  }
}
