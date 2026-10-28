import { unzlibSync } from 'fflate';
import { worldSceneBuffers as parseSceneBuffers } from '@wildshard/sdk/worldScenes';

import { nameBlob } from '@wildshard/sdk/blobs';
import { bakeMeadowBlades } from './meadowBlades';
import { MEADOW, meadowCard } from './rows/meadowLook';

type SceneBuffers = ReturnType<typeof parseSceneBuffers>;

/** The original blade bytes, card channels and chunk LOD transforms, frozen before product compilation. */
export function skyMeadowScene(publish: (id: string, bytes: Uint8Array) => { file: string; byteOffset: number }): SceneBuffers {
  const bytes = unzlibSync(bakeMeadowBlades()), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = view.getUint32(0, true), buffers: SceneBuffers['buffers'] = [], attributes: SceneBuffers['attributes'] = [];
  const geometries: SceneBuffers['geometries'] = [], draws: SceneBuffers['draws'] = [];
  const cards = [meadowCard(1), meadowCard(1 + MEADOW.layers)];
  for (const [level, card] of cards.entries()) {
    const id = `card.${String(level)}`;
    for (const [channel, array, size, storage] of [
      ['aCard', card.card, 4, 'f32'], ['aLayer', card.layer, 1, 'f32'],
      ['index', card.index, 1, 'u16'], ['position', new Float32Array(card.layer.length * 3), 3, 'f32'],
    ] as const) {
      const key = `${id}.${channel}`, channelBytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      buffers.push({ id: key, storage, ...publish(key, channelBytes), byteLength: channelBytes.byteLength, instanced: false });
      attributes.push({ id: key, buffer: key, size, offset: 0, normalized: false });
    }
  }
  let at = 4 + chunks * 20;
  for (let index = 0; index < chunks; index++) {
    const header = 4 + index * 20, count = view.getUint32(header + 12, true), phone = view.getUint32(header + 16, true), id = `chunk.${String(index)}`;
    const chunk = bytes.subarray(at, at + count * 8);
    buffers.push({ id, storage: 'u8', ...publish(id, chunk), byteLength: chunk.byteLength, stride: 8, instanced: true }); at += count * 8;
    attributes.push({ id: `${id}.a`, buffer: id, size: 4, offset: 0, normalized: true }, { id: `${id}.b`, buffer: id, size: 4, offset: 4, normalized: true });
    for (const level of cards.keys()) {
      const card = `card.${String(level)}`;
      geometries.push({ id: `${id}.${String(level)}`, attributes: { position: `${card}.position`, aCard: `${card}.aCard`, aLayer: `${card}.aLayer`, aBladeA: `${id}.a`, aBladeB: `${id}.b` },
        index: `${card}.index`, instances: { knob: 'far.meadowBlades', threshold: MEADOW.blades, below: phone, above: count },
        sphere: [MEADOW.tile / 2, 1.5, MEADOW.tile / 2, MEADOW.tile] });
    }
    const draw = (level: number): NonNullable<SceneBuffers['draws'][number]['draw']> => ({ kind: 'mesh', geometry: `${id}.${String(level)}`, at: [-MEADOW.tile / 2, 0, -MEADOW.tile / 2], frustum: true });
    draws.push({ id, name: '', at: [view.getFloat32(header, true) + MEADOW.tile / 2, view.getFloat32(header + 8, true), view.getFloat32(header + 4, true) + MEADOW.tile / 2],
      // Keep native child insertion order; LOD.addLevel sorts its distance table.
      levels: [{ from: MEADOW.lods[0], draw: draw(0) }, { from: 0, draw: draw(1) }, { from: MEADOW.lods[1] }] });
  }
  if (at !== bytes.byteLength) throw new Error('Meadow bake has trailing or truncated blade bytes');
  return parseSceneBuffers({ version: 1, name: 'far.meadow', buffers, attributes, geometries, draws });
}
export const SKY_MEADOW_FILE = 'world/fields/meadow.json';
export const SKY_MEADOW_DATA_FILE = 'world/fields/meadow.bin';
const channels: { bytes: Uint8Array; offset: number }[] = [];
let length = 0;
const scene = skyMeadowScene((_id, bytes) => {
  const offset = Math.ceil(length / 4) * 4;
  channels.push({ bytes, offset }); length = offset + bytes.byteLength;
  return { file: SKY_MEADOW_DATA_FILE, byteOffset: offset };
});
const packed = new Uint8Array(length);
for (const channel of channels) packed.set(channel.bytes, channel.offset);
const binary = nameBlob(SKY_MEADOW_DATA_FILE, 'bin', packed);
export const SKY_MEADOW_BLOB = nameBlob(SKY_MEADOW_FILE, 'json', new TextEncoder().encode(JSON.stringify(scene)), {
  gpu: scene.buffers.reduce((sum, buffer) => sum + (buffer.byteLength ?? 0), 0),
  dependencies: [binary.file.hash],
});
/** One verified packed file keeps every channel binary without adding per-channel reads. */
export const SKY_MEADOW_BLOBS = [binary, SKY_MEADOW_BLOB];
