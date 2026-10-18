import { type BufferGeometry, type Texture, Color, Vector3, LinearFilter, LinearMipmapLinearFilter } from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { BASIS_PATH, detectKtx2Support } from '@wildshard/engine/core/ktx2';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { PlacedSign } from '../runtime/signs/signModel';
import type { Emitter } from '../runtime/looks/vertexSpill';
import { createModelLibrary } from '@wildshard/game/plugin/geometry';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import * as v from 'valibot';
import type { LayoutRows } from '../runtime/productSections.generated';
import { layoutReviver } from './layoutBake';

const finite = v.number();
const V3 = v.tuple([finite, finite, finite]);
const STYLES = ['tube', 'box', 'plaque', 'paper', 'talisman', 'etch', 'banner'] as const;
const Spec = v.strictObject({ text: v.string(), color: v.string(), vertical: v.boolean(), style: v.picklist(STYLES), ink: v.exactOptional(v.string()) });
const Place = v.strictObject({
  at: V3, normal: V3, size: finite, spec: Spec, gain: v.exactOptional(finite), flicker: v.exactOptional(finite), blade: v.exactOptional(v.boolean()),
  board: v.exactOptional(finite), fogK: v.exactOptional(finite), clear: v.exactOptional(finite),
});
const SignCall = v.variant('k', [
  v.strictObject({ k: v.literal('place'), p: Place }),
  v.strictObject({ k: v.literal('light'), c: V3, r: V3, u: V3, w: finite, h: finite, color: finite, gain: finite, mode: v.picklist([1, 2] as const), seed: finite }),
  v.strictObject({ k: v.literal('tube'), a: V3, b: V3, f: V3, width: finite, color: finite, gain: finite, flicker: finite }),
]);

/** Adopt the exact prepared prop at its former load phase; the caller owns this geometry. */
export async function loadCast(name: string): Promise<BufferGeometry> {
  const bytes = await (await loadFirstPartyProduct('nine-dragon-stack')).file('geometry/cast-channels.json');
  const channels = v.parse(v.pipe(v.array(v.strictObject({ name: v.string(), source: v.string(), width: v.number() })), v.maxLength(16)),
    JSON.parse(new TextDecoder().decode(bytes)));
  const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
    geometryPools: [{ url: `/assets/nine-dragon/baked/casts/${name}.glb`, parts: [name], channels }],
  }, `Nine ${name}`);
  await library.preload();
  const geometry = library.geometry(name, { borrow: true });
  if (geometry === null) throw new Error(`Nine prepared cast ${name} did not load`);
  return geometry;
}

/** Recorded fixed additions; their source author and the geometry are generated together. */
export async function loadFixedRows(): Promise<{ signs: LayoutRows['signs']; lanterns: number[][]; lantern: { drop: number; glow: { color: number; w: number; h: number; power: number; spill: number } } }> {
  const bytes = await (await loadFirstPartyProduct('nine-dragon-stack')).file('geometry/fixed-kits.json');
  return v.parse(v.strictObject({ signs: v.array(SignCall), lanterns: v.array(v.array(v.number())), lantern: v.strictObject({ drop: v.number(), glow: v.strictObject({ color: v.number(), w: v.number(), h: v.number(), power: v.number(), spill: v.number() }) }) }),
    JSON.parse(new TextDecoder().decode(bytes), layoutReviver));
}

const N = v.number();
const SignRows = v.strictObject({
  cells: v.record(v.string(), v.strictObject({ u0: N, v0: N, u1: N, v1: N, mono: v.boolean() })),
  keys: v.record(v.string(), v.string()),
  pools: v.array(v.strictObject({ name: v.string(), parts: v.array(v.string()) })),
  channels: v.array(v.strictObject({ name: v.string(), source: v.string(), width: N })),
  placed: v.array(v.strictObject({ p: Place, w: N, h: N, neon: v.boolean() })),
  lights: v.array(v.strictObject({ at: V3, color: V3, w: N, h: N, power: N, spill: N })),
});
export interface BakedSigns {
  readonly keys: Readonly<Record<string, string>>;
  readonly placed: readonly PlacedSign<v.InferOutput<typeof Place>['spec']['style']>[];
  readonly lights: readonly Emitter[];
  readonly textures: { readonly mono: Texture; readonly colour: Texture };
  readonly geometry: (name: string) => BufferGeometry;
}

/** Existing rest-pool and KTX2 readers; all painting, packing and face construction are offline. */
export async function loadSignAtlas(tier: 'phone' | 'desktop', renderer: Renderer): Promise<BakedSigns> {
  const product = await loadFirstPartyProduct('nine-dragon-stack');
  const rows = v.parse(SignRows, JSON.parse(new TextDecoder().decode(await product.file(`signs/atlas-${tier}.json`)), layoutReviver));
  const libraries = await Promise.all(rows.pools.map(async pool => {
    const url = URL.createObjectURL(new Blob([Uint8Array.from(await product.file(pool.name))]));
    try {
      const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
        geometryPools: [{ url, parts: pool.parts, channels: rows.channels }] }, `Nine sign atlas ${tier}`);
      await library.preload(); return library;
    } finally { URL.revokeObjectURL(url); }
  }));
  const loader = detectKtx2Support(new KTX2Loader().setTranscoderPath(BASIS_PATH), renderer);
  const read = async (name: 'mono' | 'colour'): Promise<Texture> => {
    const bytes = await product.file(`signs/atlas-${tier}-${name}.ktx2`);
    const texture = await new Promise<Texture>((resolve, reject) => { loader.parse(Uint8Array.from(bytes).buffer, resolve, reject); });
    texture.flipY = false; texture.generateMipmaps = true; texture.mipmaps = [];
    texture.minFilter = LinearMipmapLinearFilter; texture.magFilter = LinearFilter; texture.anisotropy = 8;
    texture.needsUpdate = true;
    gpuOnlyTexture(texture, 'Nine Dragon baked sign atlas (GPU only)');
    return texture;
  };
  let mono: Texture, colour: Texture;
  try { [mono, colour] = await Promise.all([read('mono'), read('colour')]); }
  finally { loader.dispose(); }
  return { keys: rows.keys, textures: { mono, colour },
    placed: rows.placed.map(({ p, ...rest }) => ({ ...rest, p: { ...p, at: new Vector3(...p.at), normal: new Vector3(...p.normal) } })),
    lights: rows.lights.map(({ at, color, ...rest }) => ({ ...rest, at: new Vector3(...at), color: new Color(...color) })),
    geometry: name => {
      const index = rows.pools.findIndex(pool => pool.parts.includes(name));
      const geometry = libraries[index]?.geometry(name, name === 'world' ? { borrow: true } : undefined);
      if (geometry === null || geometry === undefined) throw new Error(`Nine baked sign has no ${name}`);
      return geometry;
    },
  };
}
