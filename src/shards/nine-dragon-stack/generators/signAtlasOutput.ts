import { BufferAttribute, BufferGeometry, MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import rows from '../data/signAtlas.generated.json' with { type: 'json' };

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

/** Standard exact rest pools and lossless KTX2 textures, admitted by the existing named-file writer. */
export function signAtlasBlobs(): NamedBlob[] {
  const blobs = Object.entries(rows).flatMap(([tier, row]) => {
    const material = new MeshStandardMaterial();
    const primitives = Object.entries(row.geometries).map(([name, source]) => {
      const geometry = new BufferGeometry();
      for (const [channel, attribute] of Object.entries(source.attributes)) geometry.setAttribute(channel, new BufferAttribute(new Float32Array(bytes(attribute.data).buffer), attribute.width));
      geometry.setIndex(new BufferAttribute(new Uint32Array(bytes(source.index).buffer), 1));
      return { name, geometry, material, customAttributes: { _TINT: 'aTint', _NEON: 'aNeon' },
        extras: { restBox: null, restSphere: source.sphere, restGroups: [] } };
    });
    const pools = Array.from({ length: Math.ceil(primitives.length / 100) }, (_, index) => {
      const parts = primitives.slice(index * 100, (index + 1) * 100), glb = staticGlb(parts);
      const name = `signs/pool-${hashImmutableBytes(glb)}.glb`;
      return { name, parts: parts.map(part => part.name), blob: nameBlob(name, 'glb', glb) };
    });
    for (const primitive of primitives) primitive.geometry.dispose(); material.dispose();
    return pools.map(pool => pool.blob).concat([
      nameBlob(`signs/atlas-${tier}.json`, 'json', json({ cells: row.cells, keys: row.keys, placed: row.placed, lights: row.lights,
        pools: pools.map(({ name, parts }) => ({ name, parts })), channels: SIGN_CHANNELS })),
      ...(['mono', 'colour'] as const).map(name => textureBlob(tier, name, row[name])),
    ]);
  });
  return [...new Map(blobs.map(blob => [blob.file.hash, blob])).values()];
}
