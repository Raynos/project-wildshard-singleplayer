// oxlint-disable-next-line import/no-nodejs-modules -- Author-only lossless KTX2 encoding, matching the SDK texture baker.
import { zstdCompressSync } from 'node:zlib';
import { unzlibSync } from 'fflate';
import { NeonText } from './neonGeometry';
import glyphs from '../data/glyphs.generated.json' with { type: 'json' };
import signRows from '../data/signView.json' with { type: 'json' };
import { signCopies } from './signCopies';
import type { SignModelParams } from '../data/signTypes';
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, Vector3 } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import rows from '../data/signAtlas.generated.json' with { type: 'json' };

const specimenKey = (p: SignModelParams): string => `${signRows.model.key}:${p.style}:${p.text}:${p.color}:${p.ink ?? ''}:${String(p.vertical)}:${p.size}:${String(p.blade)}`;
const vector = (values: readonly (string | number)[]): Vector3 => new Vector3(Number(values[0]), Number(values[1]), Number(values[2]));
const bytes = (value: string): Uint8Array => Uint8Array.from(atob(value), char => char.codePointAt(0) ?? 0);
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value, (_key, entry: unknown) =>
  typeof entry === 'number' && Object.is(entry, -0) ? '-0' : entry));
export const SIGN_CHANNELS = [{ name: 'aTint', source: '_tint', width: 3 }, { name: 'aNeon', source: '_neon', width: 4 }];

function textureBlob(tier: string, name: 'mono' | 'colour', row: { packed: string; bytes: number }): NamedBlob {
  const data = bytes(row.packed), header = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let width = header.getUint32(20, true), height = header.getUint32(24, true), gpu = 0;
  for (;;) {
    gpu += width * height * (name === 'mono' ? 1 : 4);
    if (width === 1 && height === 1) break;
    width = Math.max(1, width >> 1); height = Math.max(1, height >> 1);
  }
  return nameBlob(`signs/atlas-${tier}-${name}.ktx2`, 'ktx2', data, { decoded: row.bytes, gpu });
}

/** Ordinary RG8 KTX2; the existing texture reader owns decompression. */
function glyphTexture(tier: string, field: { size: number; packed: readonly string[] }): NamedBlob {
  const pixels = new Uint8Array(field.size * field.size * 2);
  field.packed.forEach((part, i) => pixels.set(unzlibSync(bytes(part)), i * 2_097_152));
  const packed = zstdCompressSync(pixels), offset = 168, data = new Uint8Array(offset + packed.length), view = new DataView(data.buffer);
  data.set([171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10]);
  [16, 1, field.size, field.size, 0, 0, 1, 1, 2, 104, 60].forEach((n, i) => view.setUint32(12 + i * 4, n, true));
  view.setBigUint64(80, BigInt(offset), true); view.setBigUint64(88, BigInt(packed.length), true); view.setBigUint64(96, BigInt(pixels.length), true);
  view.setUint32(104, 60, true); view.setUint16(112, 2, true); view.setUint16(114, 56, true); data.set([1, 1, 1, 0], 116);
  data[124] = 2;
  for (let i = 0; i < 2; i++) { const at = 132 + i * 16; view.setUint16(at, i * 8, true); data[at + 2] = 7; data[at + 3] = i; view.setUint32(at + 12, 255, true); }
  data.set(packed, offset);
  return nameBlob(`signs/glyphs-${tier}.ktx2`, 'ktx2', data, { decoded: pixels.length });
}

/** Standard exact rest pools and lossless KTX2 textures, admitted by the existing named-file writer. */
export function signAtlasBlobs(): NamedBlob[] {
  const blobs = Object.entries(rows).flatMap(([tier, row]) => {
    const material = new MeshStandardMaterial();
    const field = tier === 'phone' ? glyphs.phone : glyphs.desktop;
    const atlas = { layout: field.layout, rect: (ch: string) => {
      const rects: Readonly<Record<string, { u0: number; v0: number; u1: number; v1: number }>> = field.rects;
      const rect = rects[ch]; if (rect === undefined) throw new Error(`Missing baked glyph ${ch}`); return rect;
    } };
    const neon = new NeonText(signRows.model.tubeGain, atlas), keys: Record<string, string> = { ...row.keys };
    const placed = row.placed.map(({ p, ...rest }) => ({ ...rest, p: { ...p, at: vector(p.at), normal: vector(p.normal) } }));
    for (const { p, neon: calligraphy } of placed) if (calligraphy) neon.add({ text: p.spec.text, color: p.spec.color, vertical: p.spec.vertical, em: p.size, at: p.at, facing: p.normal,
      twoSided: p.blade === true, gain: ((p.gain ?? signRows.model.calligraphyGain) / signRows.model.calligraphyGain) * signRows.model.tubeGain, flicker: p.flicker ?? 0, clear: p.clear ?? 0 });
    const baked = neon.build(), neonGeometries: { name: string; geometry: BufferGeometry }[] = [{ name: 'neon-world-boards', geometry: baked.boards }, { name: 'neon-world-tubes', geometry: baked.tubes }];
    const params: SignModelParams[] = [];
    for (const { p, neon: calligraphy } of placed) if (calligraphy) params.push({ ...p.spec, size: p.size, blade: p.blade === true, ...(p.gain === undefined ? {} : { gain: p.gain }) });
    params.push(signRows.defaults);
    for (const variant of signRows.variants) if (variant.params.style === 'tube') params.push({ ...signRows.defaults, ...variant.params });
    for (const p of params) {
      const key = specimenKey(p); if (keys[key] !== undefined) continue;
      const name = `neon-specimen-${Object.keys(keys).length}`;
      const geometry = neon.one({ text: p.text, color: p.color, vertical: p.vertical, em: p.size, at: new Vector3(), facing: new Vector3(0, 0, 1), twoSided: p.blade, gain: ((p.gain ?? signRows.model.calligraphyGain) / signRows.model.calligraphyGain) * signRows.model.tubeGain });
      keys[key] = name; neonGeometries.push({ name: `${name}-boards`, geometry: geometry.boards }, { name: `${name}-tubes`, geometry: geometry.tubes });
    }
    const channels: { name: string; source: string; width: number; parts?: string[] }[] = [...SIGN_CHANNELS];
    const primitives = Object.entries(row.geometries).map(([name, source]) => {
      const geometry = new BufferGeometry();
      for (const [channel, attribute] of Object.entries(source.attributes)) geometry.setAttribute(channel, new BufferAttribute(new Float32Array(bytes(attribute.data).buffer), attribute.width));
      geometry.setIndex(new BufferAttribute(new Uint32Array(bytes(source.index).buffer), 1));
      return { name, geometry, material, customAttributes: { _TINT: 'aTint', _NEON: 'aNeon' },
        extras: { restBox: null, restSphere: source.sphere, restGroups: [] } };
    });
    const neonParts = neonGeometries.map(({ name, geometry }) => {
      const customAttributes: Record<string, string> = {};
      for (const [channel, attribute] of Object.entries(geometry.attributes)) {
        if (!(attribute instanceof BufferAttribute)) throw new Error('Neon needs plain vertex channels');
        if (channel === 'position') continue;
        const source = `_NEON_${channel.toUpperCase()}`, lower = source.toLowerCase();
        const values = new Float32Array(attribute.count * attribute.itemSize);
        for (let i = 0; i < attribute.count; i++) for (let j = 0; j < attribute.itemSize; j++) values[i * attribute.itemSize + j] = (j === 0 ? attribute.getX(i) : j === 1 ? attribute.getY(i) : j === 2 ? attribute.getZ(i) : attribute.getW(i));
        geometry.setAttribute(channel, new Float32BufferAttribute(values, attribute.itemSize));
        customAttributes[source] = channel;
        let channelRow = channels.find(entry => entry.source === lower);
        if (channelRow === undefined) { channelRow = { name: channel, source: lower, width: attribute.itemSize, parts: [] }; channels.push(channelRow); }
        channelRow.parts?.push(name);
      }
      return { name, geometry, material, customAttributes, extras: { restBox: null, restSphere: geometry.boundingSphere === null ? null : [...geometry.boundingSphere.center, geometry.boundingSphere.radius], restGroups: [] } };
    });
    for (const channelRow of channels.slice(0, SIGN_CHANNELS.length)) channelRow.parts = primitives.map(part => part.name);
    const all = [...primitives, ...neonParts];
    const pools = [primitives, neonParts].flatMap(group => Array.from({ length: Math.ceil(group.length / 100) }, (_, index) => {
      const parts = group.slice(index * 100, (index + 1) * 100), glb = staticGlb(parts);
      const name = `signs/pool-${hashImmutableBytes(glb)}.glb`;
      return { name, parts: parts.map(part => part.name), blob: nameBlob(name, 'glb', glb) };
    }));
    for (const primitive of all) primitive.geometry.dispose(); material.dispose();
    return pools.map(pool => pool.blob).concat([
      nameBlob(`signs/atlas-${tier}.json`, 'json', json({ keys, glyphLayout: field.layout, neonLights: neon.emitters.map(({ at, color, ...rest }) => Object.assign(rest, { at: at.toArray(), color: color.toArray() })), copies: signCopies(placed, signRows.model), lights: row.lights,
        pools: pools.map(({ name, parts }) => ({ name, parts })), channels })),
      ...(['mono', 'colour'] as const).map(name => textureBlob(tier, name, row[name])), glyphTexture(tier, field),
    ]);
  });
  return [...new Map(blobs.map(blob => [blob.file.hash, blob])).values()];
}
