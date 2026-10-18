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
  const row = parseSceneBuffers({ version: 1, buffers: Object.entries(channels).map(([id, values]) => ({ id, storage: 'f32', bytes: btoa(Array.from(new Uint8Array(values.buffer), byte => String.fromCodePoint(byte)).join('')) })),
    attributes: Object.keys(channels).map(id => ({ id, buffer: id, size: id === 'position' ? 3 : 1 })),
    geometries: [{ id: 'embers', attributes: Object.fromEntries(Object.keys(channels).map(id => [id, id])) }],
    draws: [{ id: 'embers', name, draw: { kind: 'points', geometry: 'embers', frustum: false } }] });
  SIGNAL_EMBER_BLOBS.push(nameBlob(file, 'json', new TextEncoder().encode(JSON.stringify(row)), {
    gpu: Object.values(channels).reduce((sum, values) => sum + values.byteLength, 0),
  })); return file;
}
