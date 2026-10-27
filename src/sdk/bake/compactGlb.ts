// oxlint-disable-next-line import/no-nodejs-modules -- The build measures each file's wire bytes with the deploy's brotli.
import { brotliCompressSync, constants } from 'node:zlib';
import { WebIO, type Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { compressGlb } from './glbCompression';

/** The brotli size a phone pays for a file over the wire (the deploy's own encoder settings). */
export function brotliBytes(bytes: Uint8Array): number {
  return brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 24 } }).length;
}

const quantized = (accessor: Accessor, array: Int16Array<ArrayBuffer> | Int8Array<ArrayBuffer> | Uint8Array<ArrayBuffer>): void => {
  accessor.setArray(array).setNormalized(true);
};

/**
 * iPhone downloads I3: a phone-tier baked model with 16-bit positions, 8-bit normals and 8-bit colours
 * (KHR_mesh_quantization), meshopt-compressed (EXT_meshopt_compression), kept only when its brotli bytes are smaller
 * than the input's. The positions sit on the mesh's own grid: a uniform scale and a translation on its node dequantize
 * them (`createOwnedGeometry` bakes that node transform back into float positions). Only a file with exactly one mesh on
 * one identity-space node and no skin, morph target, animation, instancing or existing quantization or meshopt is
 * compacted; every other file, and every channel but POSITION / NORMAL / COLOR_0, passes through unchanged.
 */
export async function compactPhoneGlb(input: Uint8Array): Promise<Uint8Array> {
  await MeshoptDecoder.ready;
  const io = new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(Uint8Array.from(input)), root = doc.getRoot();
  const used = new Set(root.listExtensionsUsed().map(extension => extension.extensionName));
  const nodes = root.listNodes().filter(node => node.getMesh() !== null), node = nodes[0], mesh = node?.getMesh();
  if (nodes.length !== 1 || node === undefined || mesh === null || mesh === undefined || root.listMeshes().length !== 1
    || root.listSkins().length > 0 || root.listAnimations().length > 0 || used.has('KHR_mesh_quantization')
    || used.has('EXT_meshopt_compression') || used.has('EXT_mesh_gpu_instancing')
    || node.getMatrix().some((value, i) => value !== (i % 5 === 0 ? 1 : 0)) || node.getParentNode() !== null) return input;
  const primitives = mesh.listPrimitives();
  if (primitives.length === 0 || primitives.some(primitive => primitive.listTargets().length > 0)) return input;
  // one uniform grid for the whole mesh (a non-uniform scale would bend its normals)
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], point: number[] = [];
  for (const primitive of primitives) {
    const position = primitive.getAttribute('POSITION');
    if (position === null || position.getComponentType() !== 5126 || position.getElementSize() !== 3) return input;
    for (let i = 0; i < position.getCount(); i++) {
      position.getElement(i, point);
      for (let axis = 0; axis < 3; axis++) { const value = point[axis] ?? 0; min[axis] = Math.min(min[axis] ?? 0, value); max[axis] = Math.max(max[axis] ?? 0, value); }
    }
  }
  const mid = (axis: number): number => ((min[axis] ?? 0) + (max[axis] ?? 0)) / 2;
  const centre: [number, number, number] = [mid(0), mid(1), mid(2)];
  const half = Math.max(...[0, 1, 2].map(axis => ((max[axis] ?? 0) - (min[axis] ?? 0)) / 2), 1e-6);
  const done = new Set<Accessor>();
  for (const primitive of primitives) {
    const position = primitive.getAttribute('POSITION'), normal = primitive.getAttribute('NORMAL'), colour = primitive.getAttribute('COLOR_0');
    if (position !== null && !done.has(position)) {
      const out = new Int16Array(position.getCount() * 3);
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, point);
        for (let axis = 0; axis < 3; axis++) out[i * 3 + axis] = Math.round(((point[axis] ?? 0) - (centre[axis] ?? 0)) / half * 32767);
      }
      quantized(position, out); done.add(position);
    }
    if (normal !== null && !done.has(normal) && normal.getComponentType() === 5126 && normal.getElementSize() === 3) {
      const out = new Int8Array(normal.getCount() * 3);
      for (let i = 0; i < normal.getCount(); i++) { normal.getElement(i, point); for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(Math.max(-1, Math.min(1, point[c] ?? 0)) * 127); }
      quantized(normal, out); done.add(normal);
    }
    if (colour !== null && !done.has(colour) && colour.getComponentType() === 5126) {
      const width = colour.getElementSize(), values = colour.getArray();
      if (values !== null && Array.from(values).every(value => value >= 0 && value <= 1)) {
        const out = new Uint8Array(colour.getCount() * width);
        for (let i = 0; i < out.length; i++) out[i] = Math.round((values[i] ?? 0) * 255);
        quantized(colour, out); done.add(colour);
      }
    }
  }
  node.setTranslation(centre).setScale([half, half, half]);
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  const packed = compressGlb(await io.writeBinary(doc));
  return brotliBytes(packed) < brotliBytes(input) ? packed : input;
}
