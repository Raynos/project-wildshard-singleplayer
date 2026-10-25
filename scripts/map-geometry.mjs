// Build-only map geometry: no forest, level or runtime services are imported.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { BufferGeometry, Float32BufferAttribute, Matrix4, MeshBasicMaterial } from 'three';
import { GeometryPackWriter } from '../src/sdk/kit/geometryPack.ts';

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
  /** Encode the same ordered scene and geometry without publishing source files. */
  encode() {
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
    const binary = new Uint8Array(deflateSync(pack.bytes()));
    const scene = { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: this.nodes.map(row => row.id) }, ...this.nodes], materials: [{ id: 'map', kind: 'port', source: 'map' }] };
    const json = new TextEncoder().encode(`${JSON.stringify({ version: 1, inventory: this.inventory, pack: { ...pack.rows(), names: this.shapes.map(row => row.name) }, scene })}\n`);
    return { json, binary };
  }
  write(file) {
    const { json, binary } = this.encode();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.bin`, binary);
    writeFileSync(`${file}.json`, json);
    for (const shape of this.shapes) { shape.geometry.dispose(); shape.material.dispose(); }
  }
}
