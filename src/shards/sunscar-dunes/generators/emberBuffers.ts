import { parseSceneBuffers } from '@wildshard/format/sceneBuffers';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';

export const SIGNAL_EMBER_BLOBS: NamedBlob[] = [];
/** Original Points storage and golden-ratio seed rounding, baked once per authored ember count. */
export function signalEmberBuffer(count: number, name: string): string {
  const file = `world/fields/embers-${String(count)}.json`;
  if (SIGNAL_EMBER_BLOBS.some(row => row.file.name === file)) return file;
  const index = new Float32Array(count), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) { index[i] = i; seed[i] = (i * 0.618034) % 1; }
  const channels = { position: new Float32Array(count * 3), aIndex: index, aSeed: seed };
  const binaryFile = `world/fields/embers-${String(count)}.bin`, packed = new Uint8Array(Object.values(channels).reduce((sum, values) => sum + values.byteLength, 0));
  let offset = 0;
  const buffers = Object.entries(channels).map(([id, values]) => {
    const bytes = new Uint8Array(values.buffer), byteOffset = offset;
    packed.set(bytes, offset); offset += bytes.byteLength;
    return packed.length === 0 ? { id, storage: 'f32', bytes: '' }
      : { id, storage: 'f32', file: binaryFile, byteLength: bytes.byteLength, byteOffset };
  });
  const binary = packed.length === 0 ? undefined : nameBlob(binaryFile, 'bin', packed);
  const row = parseSceneBuffers({ version: 1, buffers,
    attributes: Object.keys(channels).map(id => ({ id, buffer: id, size: id === 'position' ? 3 : 1 })),
    geometries: [{ id: 'embers', attributes: Object.fromEntries(Object.keys(channels).map(id => [id, id])) }],
    draws: [{ id: 'embers', name, draw: { kind: 'points', geometry: 'embers', frustum: false } }] });
  SIGNAL_EMBER_BLOBS.push(...(binary === undefined ? [] : [binary]), nameBlob(file, 'json', new TextEncoder().encode(JSON.stringify(row)), {
    dependencies: binary === undefined ? [] : [binary.file.hash],
    gpu: Object.values(channels).reduce((sum, values) => sum + values.byteLength, 0),
  })); return file;
}
