import { MeshoptEncoder } from 'meshoptimizer/encoder';
import { parseGlb } from '@wildshard/format/product';

await MeshoptEncoder.ready;
const EXT = 'EXT_meshopt_compression';
const object = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('GLB compression object required');
  return value as Record<string, unknown>;
};
const rows = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) throw new Error('GLB compression array required');
  return value.map(object);
};
const integer = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('GLB compression count required');
  return value;
};

/** Lossless buffer-view encoding, without quantization, welding, index reordering or scene/material edits.
 * The ordinary meshopt-capable runtime decodes the exact original channels, including application accessors. */
export function compressGlb(input: Uint8Array): Uint8Array {
  parseGlb(input);
  const header = new DataView(input.buffer, input.byteOffset, input.byteLength), jsonLength = header.getUint32(12, true);
  const doc = object(JSON.parse(new TextDecoder().decode(input.subarray(20, 20 + jsonLength))));
  if (Array.isArray(doc['extensionsUsed']) && doc['extensionsUsed'].includes(EXT)) return Uint8Array.from(input);
  const source = input.subarray(28 + jsonLength), views = rows(doc['bufferViews'] ?? []), accessors = rows(doc['accessors'] ?? []);
  const chunks: Uint8Array[] = [];
  let physical = 0, fallback = 0;
  const append = (bytes: Uint8Array): number => {
    const offset = physical, padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
    padded.set(bytes); chunks.push(padded); physical += padded.length; return offset;
  };
  const packedViews = views.map((view, index) => {
    const output = view;
    const length = integer(view['byteLength']), offset = integer(view['byteOffset'] ?? 0), bytes = source.subarray(offset, offset + length);
    const accessor = accessors.find(row => row['bufferView'] === index && (row['byteOffset'] ?? 0) === 0);
    const count = accessor === undefined ? 0 : integer(accessor['count']);
    const indices = accessor?.['type'] === 'SCALAR' && (accessor['componentType'] === 5123 || accessor['componentType'] === 5125);
    const inferred = count === 0 ? 0 : length / count;
    const size = view['byteStride'] === undefined ? inferred : integer(view['byteStride']);
    const mode = indices ? 'INDICES' : 'ATTRIBUTES';
    if (size === 0 || !Number.isInteger(size) || length % size !== 0 || size > 256
      || (indices ? size !== 2 && size !== 4 : size % 4 !== 0)) { output['byteOffset'] = append(bytes); return output; }
    const packed = MeshoptEncoder.encodeGltfBuffer(bytes, length / size, size, mode), target = fallback;
    fallback += Math.ceil(length / 4) * 4;
    output['buffer'] = 1; output['byteOffset'] = target;
    output['extensions'] = { ...(view['extensions'] === undefined ? {} : object(view['extensions'])),
      [EXT]: { buffer: 0, byteOffset: append(packed), byteLength: packed.length, byteStride: size, count: length / size, mode } };
    return output;
  });
  if (fallback === 0) return Uint8Array.from(input);
  doc['bufferViews'] = packedViews;
  doc['buffers'] = [{ byteLength: physical }, { byteLength: fallback, extensions: { [EXT]: { fallback: true } } }];
  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    const existing = doc[key];
    const entries: unknown[] = existing === undefined ? [] : Array.isArray(existing) ? existing : (() => { throw new Error('GLB extension list required'); })();
    doc[key] = [...entries, EXT];
  }
  const json = new TextEncoder().encode(JSON.stringify(doc)), paddedJson = Math.ceil(json.length / 4) * 4;
  const output = new Uint8Array(28 + paddedJson + physical), result = new DataView(output.buffer);
  result.setUint32(0, 0x46546c67, true); result.setUint32(4, 2, true); result.setUint32(8, output.length, true);
  result.setUint32(12, paddedJson, true); result.setUint32(16, 0x4e4f534a, true);
  output.fill(32, 20, 20 + paddedJson); output.set(json, 20);
  result.setUint32(20 + paddedJson, physical, true); result.setUint32(24 + paddedJson, 0x004e4942, true);
  let offset = 28 + paddedJson;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  parseGlb(output);
  return output;
}
