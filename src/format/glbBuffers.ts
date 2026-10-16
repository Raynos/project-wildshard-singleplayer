import { MeshoptDecoder } from 'meshoptimizer/decoder';

// Admission is synchronous once this pure codec has initialized, in both Node and the browser.
await MeshoptDecoder.ready;
const MAX_BYTES = 25_000_000;
const EXT = 'EXT_meshopt_compression';
const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('GLB buffer object required');
  return value as Record<string, unknown>;
};
const list = (value: unknown): unknown[] => {
  if (!Array.isArray(value) || value.length > 10_000) throw new Error('GLB buffer array outside cap');
  return value;
};
function count(value: unknown, maximum = MAX_BYTES): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error('GLB buffer count outside cap');
  return value;
}
function extension(row: Record<string, unknown>): Record<string, unknown> | undefined {
  const extensions = row['extensions'];
  return extensions === undefined ? undefined : record(extensions)[EXT] === undefined ? undefined : record(record(extensions)[EXT]);
}

/** Bound physical and virtual meshopt buffers before decoding. Return ordinary contiguous views so all existing
 * finite-position, index, skin, animation and triangle checks inspect the decoded bytes, never compressed bytes. */
export function glbBuffers(doc: Record<string, unknown>, physical: Uint8Array): { views: Record<string, unknown>[]; bytes: Uint8Array; decoded: number } {
  const buffers = list(doc['buffers'] ?? []).map(record), views = list(doc['bufferViews'] ?? []).map(record);
  const lengths = buffers.map((buffer, index) => {
    const length = count(buffer['byteLength']);
    if (buffer['uri'] !== undefined) throw new Error('external GLB buffer');
    if (index === 0) {
      if (length > physical.length || extension(buffer) !== undefined) throw new Error('truncated GLB buffer');
    } else if (extension(buffer)?.['fallback'] !== true || !list(doc['extensionsRequired'] ?? []).includes(EXT)) throw new Error('GLB virtual buffer requires meshopt fallback');
    return length;
  });
  if (lengths.reduce((sum, length) => sum + length, 0) > MAX_BYTES) throw new Error('GLB aggregate buffer cap');
  let total = 0;
  const rows = views.map(view => {
    const buffer = count(view['buffer'] ?? 0, 9999), offset = count(view['byteOffset'] ?? 0), length = count(view['byteLength']);
    const available = lengths[buffer];
    if (available === undefined || offset + length > available) throw new Error('GLB buffer view outside buffer');
    const codec = extension(view);
    total += length;
    if (total > MAX_BYTES) throw new Error('GLB decoded view cap');
    if (codec === undefined) {
      if (buffer !== 0) throw new Error('GLB virtual view needs meshopt data');
      return { view, offset, length, source: physical.subarray(offset, offset + length) };
    }
    if (!list(doc['extensionsUsed'] ?? []).includes(EXT)) throw new Error('GLB meshopt extension is undeclared');
    const sourceBuffer = count(codec['buffer'], 9999), sourceOffset = count(codec['byteOffset'] ?? 0), sourceLength = count(codec['byteLength']);
    if (sourceBuffer !== 0 || sourceOffset + sourceLength > (lengths[0] ?? 0)) throw new Error('GLB meshopt source outside physical buffer');
    const size = count(codec['byteStride'], 256), elements = count(codec['count'], 4_000_000);
    const mode = codec['mode'], filter = codec['filter'] ?? 'NONE';
    if (size === 0 || elements * size !== length || (view['byteStride'] !== undefined && view['byteStride'] !== size)
      || typeof mode !== 'string' || typeof filter !== 'string'
      || !['ATTRIBUTES', 'TRIANGLES', 'INDICES'].includes(mode)
      || !['NONE', 'OCTAHEDRAL', 'QUATERNION', 'EXPONENTIAL'].includes(filter)) throw new Error('Invalid GLB meshopt layout');
    if (mode === 'ATTRIBUTES' ? size % 4 !== 0 : (size !== 2 && size !== 4) || filter !== 'NONE'
      || (mode === 'TRIANGLES' && elements % 3 !== 0)) throw new Error('Invalid GLB meshopt stride or mode');
    if ((filter === 'OCTAHEDRAL' && size !== 4 && size !== 8) || (filter === 'QUATERNION' && size !== 8)) throw new Error('Invalid GLB meshopt filter');
    return { view, offset, length, source: physical.subarray(sourceOffset, sourceOffset + sourceLength), codec: { elements, size, mode, filter } };
  });
  if (!rows.some(row => row.codec !== undefined)) return { views, bytes: physical, decoded: 0 };
  const bytes = new Uint8Array(total);
  let offset = 0;
  const normalized = rows.map(row => {
    const target = bytes.subarray(offset, offset + row.length);
    if (row.codec === undefined) target.set(row.source);
    else MeshoptDecoder.decodeGltfBuffer(target, row.codec.elements, row.codec.size, row.source, row.codec.mode, row.codec.filter);
    const view = row.view;
    view['buffer'] = 0; view['byteOffset'] = offset;
    offset += row.length;
    return view;
  });
  return { views: normalized, bytes, decoded: total };
}
