// oxlint-disable-next-line import/no-nodejs-modules -- Verify shipped bake against the independent original-factory oracle.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare exact geometry bytes, including signed zero.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The original factory oracle was recorded on the M5 Mac.
import { arch, platform } from 'node:process';
import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { SPRUCE_SPECS, spruceGeometry } from '../src/shards/nalati-grasslands/generators/spruceGeometry';
import { GeometryPack, GeometryPackWriter } from '../src/sdk/kit/geometryPack';
import { SpruceFactory } from '../src/shards/nalati-grasslands/world/spruceView';
import { TREE_SPECS } from '../src/engine/world/forest/treeSpec';
import oracle from './fixtures/nalati-spruce.json' with { type: 'json' };

const hash = (a: THREE.TypedArray): string => createHash('sha256').update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
const fingerprint = (g: THREE.BufferGeometry) => {
  if (g.index === null) throw new Error('Spruce must stay indexed');
  return { attrs: Object.fromEntries(Object.entries(g.attributes).map(([name, a]) => [name, { hash: hash(a.array), size: a.itemSize, normalized: a.normalized, count: a.count }])), index: { hash: hash(g.index.array), type: g.index.array.constructor.name, count: g.index.count }, sphere: g.boundingSphere, box: g.boundingBox, groups: g.groups, drawRange: { start: g.drawRange.start, count: String(g.drawRange.count) } };
};

test('offline spruce keeps the original forest geometry, LODs and material binding', async () => {
  // No renderer calls beyond the extension capability, and a null sky skips light adoption.
  const make = () => Reflect.construct(SpruceFactory, [{ extensions: { has: () => false } }, null]) as SpruceFactory;
  const encoded = readFileSync('public/assets/nalati/baked/spruce.bin');
  const rows = readFileSync('public/assets/nalati/baked/spruce.json', 'utf8');
  const fetch = vi.fn((url: string) => Promise.resolve(new Response(url.endsWith('.json') ? rows : encoded)));
  vi.stubGlobal('fetch', fetch);
  try {
    const factory = await make().build();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith('/assets/nalati/baked/spruce.bin');
    expect(fetch).toHaveBeenCalledWith('/assets/nalati/baked/spruce.json');
    expect(factory.lodTris).toEqual(oracle.lodTris);
    expect(factory.variants.map(v => v.trunkRadius)).toEqual(TREE_SPECS.map(s => s.trunk));
    const original = spruceGeometry();
    const actual = factory.variants.map((v, i) => ({ height: v.height, trunkRadius: v.trunkRadius, geometry: Object.fromEntries((['trunk', 'cardsHi', 'cardsLo', 'twigs', 'far'] as const).map(key => {
      const source = original[i]; if (source === undefined) throw new Error('Missing original variant');
      expect(fingerprint(v[key])).toEqual(fingerprint(source[key]));
      return [key, fingerprint(v[key])];
    })) }));
    if (platform === 'darwin' && arch === 'arm64') expect(JSON.stringify(actual)).toBe(JSON.stringify(oracle.variants));
    expect(factory.twigDepth).toBe(factory.needleDepth);
    expect(factory.needleDepth?.depthPacking).toBe(THREE.RGBADepthPacking);
    for (const material of [factory.needleMaterial, factory.twigMaterial, factory.farMaterial, factory.barkMaterial]) {
      expect(material.vertexColors).toBe(true);
      expect(material.customProgramCacheKey()).toBe(factory.needleMaterial.customProgramCacheKey());
    }
    const writer = new GeometryPackWriter('original spruce');
    for (const v of original) for (const key of ['trunk', 'cardsHi', 'cardsLo', 'twigs', 'far'] as const) writer.add(v[key]);
    const metadata: unknown = JSON.parse(rows);
    expect(metadata).toMatchObject({ pack: writer.rows() });
    expect(new GeometryPack(writer.bytes(), writer.rows(), 'spruce').geometry(0).getAttribute('position').count).toBe(original[0]?.trunk.getAttribute('position').count);
    expect(SPRUCE_SPECS.map(s => s.height)).toEqual(factory.variants.map(v => v.height));
  } finally { vi.unstubAllGlobals(); }
});
