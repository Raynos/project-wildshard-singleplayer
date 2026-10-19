import { PlaneGeometry, InstancedBufferAttribute, InstancedMesh, type Material, type Object3D, type BufferGeometry, type Texture, Color, Float32BufferAttribute, Vector3, LinearFilter, LinearMipmapLinearFilter } from 'three';
import type { GeometryBoot } from '../runtime/productSections.generated';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { BASIS_PATH, detectKtx2Support } from '@wildshard/engine/core/ktx2';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { Emitter } from '../runtime/looks/emitterCards';
import { createModelLibrary, type ModelGeometryPool } from '@wildshard/game/plugin/geometry';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import * as v from 'valibot';
import { PracticeSceneSchema } from '@wildshard/format/practiceCourse';
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
export async function loadCast(name: string, applicationChannels?: ModelGeometryPool['channels']): Promise<BufferGeometry> {
  const bytes = await (await loadFirstPartyProduct('nine-dragon-stack')).file('geometry/cast-channels.json');
  const declared = v.parse(v.pipe(v.array(v.strictObject({ name: v.string(), source: v.string(), width: v.number() })), v.maxLength(16)),
    JSON.parse(new TextDecoder().decode(bytes)));
  const channels = applicationChannels ?? declared;
  const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
    geometryPools: [{ url: `/assets/nine-dragon/baked/casts/${name}.glb`, parts: [name], channels }],
  }, `Nine ${name}`);
  await library.preload();
  const geometry = library.geometry(name, { borrow: true });
  if (geometry === null) throw new Error(`Nine prepared cast ${name} did not load`);
  return geometry;
}

/** Attach verified, lossless float32 spill to the final merged vertex stream. */
export async function loadSpill(meshes: readonly (readonly [string, BufferGeometry])[], tier: 'phone' | 'desktop', caps: boolean): Promise<void> {
  const product = await loadFirstPartyProduct('nine-dragon-stack');
  for (const [name, geometry] of meshes) {
    const values = new Float32Array(geometry.getAttribute('position').count * 3);
    for (let i = 0; i < values.length; i += 196608) {
      const path = `lighting/spill/${tier}/${caps ? 'capped' : 'open'}/${name}-${i / 196608}.bin`, packed = await product.file(path);
      const decoded = await new Response(new Blob([Uint8Array.from(packed)]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
      const length = new DataView(decoded).getUint32(0, true);
      if (new TextDecoder().decode(new Uint8Array(decoded, 4, length)) !== path) throw new Error('Nine spill draw binding differs');
      const part = new Float32Array(decoded, 4 + Math.ceil(length / 4) * 4);
      if (part.length !== Math.min(196608, values.length - i)) throw new Error(`Nine spill vertex count differs: ${name}`);
      values.set(part, i);
    }
    geometry.setAttribute('aSpill', new Float32BufferAttribute(values, 3));
  }
}

const Course = v.strictObject({
  id: v.string(), title: v.string(), chip: v.string(),
  piece: v.strictObject({ id: v.string(), name: v.string(), file: v.string(), surface: v.string() }),
  room: v.strictObject({ x0: finite, x1: finite, z0: finite, z1: finite, height: finite }),
  ringUp: finite, ringOut: finite, fallY: finite, slab: finite,
  pads: v.pipe(v.array(v.strictObject({ id: v.string(), label: v.string(), x: finite, z: finite, w: finite, d: finite, top: finite, kind: v.string(), next: v.exactOptional(v.string()) })), v.maxLength(256)),
  column: v.strictObject({ x: finite, z: finite, w: finite, d: finite }),
  hooks: v.pipe(v.array(v.strictObject({ pad: v.string(), edge: v.string(), along: v.exactOptional(finite) })), v.maxLength(256)),
  run: v.strictObject({ from: v.string(), to: v.string(), goals: finite }),
  words: v.strictObject({ ready: v.string(), finish: v.string(), running: v.string(), between: v.string(), done: v.string(), best: v.string(), fell: v.string() }),
  look: v.strictObject({ ceiling: finite, ring: finite, mast: finite, paint: finite, label: v.string(), startLabel: v.string(), finishLabel: v.string(),
    map: v.strictObject({ floor: v.string(), grid: v.string(), wall: v.string(), column: v.string(), lit: v.string(), pad: v.string(), finish: v.string(), hook: v.string(), label: v.string() }) }),
});
const FixedRows = v.strictObject({ signs: v.array(SignCall), lanterns: v.array(v.array(v.number())),
  lantern: v.strictObject({ drop: v.number(), glow: v.strictObject({ color: v.number(), w: v.number(), h: v.number(), power: v.number(), spill: v.number() }) }),
  practice: v.strictObject({ presentation: PracticeSceneSchema, hooks: v.pipe(v.array(v.strictObject({ pad: v.string(), x: finite, y: finite, z: finite })), v.maxLength(256)), course: Course }),
});
/** Admit the complete fixed-kit payload, including the course used by the playground. */
export function parseFixedRows(value: unknown): v.InferOutput<typeof FixedRows> { return v.parse(FixedRows, value); }

/** Recorded fixed additions; their source author and the geometry are generated together. */
export async function loadFixedRows(): Promise<v.InferOutput<typeof FixedRows>> {
  const bytes = await (await loadFirstPartyProduct('nine-dragon-stack')).file('geometry/fixed-kits.json');
  return parseFixedRows(JSON.parse(new TextDecoder().decode(bytes), layoutReviver));
}

const N = v.number();
const SignRows = v.strictObject({
  glyphLayout: v.strictObject({ cell: N, fontPx: N, spread: N, skeletonSpread: N }),
  keys: v.record(v.string(), v.string()),
  pools: v.array(v.strictObject({ name: v.string(), parts: v.array(v.string()) })),
  channels: v.array(v.strictObject({ name: v.string(), source: v.string(), width: N, parts: v.exactOptional(v.array(v.string())) })),
  lights: v.array(v.strictObject({ at: V3, color: V3, w: N, h: N, power: N, spill: N })),
  neonLights: v.array(v.strictObject({ at: V3, color: V3, w: N, h: N, power: N, spill: N })),
  copies: v.array(v.strictObject({ neon: v.boolean(), boxes: v.array(N), poses: v.array(v.strictObject({ x: N, y: N, z: N, yaw: N, variant: v.string(), params: v.record(v.string(), v.unknown()) })) })),
});
export interface BakedSigns {
  readonly keys: Readonly<Record<string, string>>;
  readonly lights: readonly Emitter[];
  readonly neonLights: readonly Emitter[];
  readonly copies: v.InferOutput<typeof SignRows>['copies'];
  readonly glyphLayout: v.InferOutput<typeof SignRows>['glyphLayout'];
  readonly textures: { readonly mono: Texture; readonly colour: Texture; readonly sdf: Texture };
  readonly geometry: (name: string) => BufferGeometry;
}

/** Existing rest-pool and KTX2 readers; all painting, packing and face construction are offline. */
export async function loadSignAtlas(tier: 'phone' | 'desktop', renderer: Renderer): Promise<BakedSigns> {
  const product = await loadFirstPartyProduct('nine-dragon-stack');
  const rows = v.parse(SignRows, JSON.parse(new TextDecoder().decode(await product.file(`signs/atlas-${tier}.json`)), layoutReviver));
  const libraries = await Promise.all(rows.pools.map(async pool => {
    const url = URL.createObjectURL(new Blob([Uint8Array.from(await product.file(pool.name))]));
    try {
      const channels = rows.channels.flatMap(row => {
        const parts = row.parts?.filter(part => pool.parts.includes(part));
        return parts?.length === 0 ? [] : [{ ...row, ...(parts === undefined ? {} : { parts }) }];
      });
      const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
        geometryPools: [{ url, parts: pool.parts, channels }] }, `Nine sign atlas ${tier}`);
      await library.preload(); return library;
    } finally { URL.revokeObjectURL(url); }
  }));
  const loader = detectKtx2Support(new KTX2Loader().setTranscoderPath(BASIS_PATH), renderer);
  const read = async (name: 'mono' | 'colour' | 'sdf'): Promise<Texture> => {
    const bytes = await product.file(name === 'sdf' ? `signs/glyphs-${tier}.ktx2` : `signs/atlas-${tier}-${name}.ktx2`);
    const texture = await new Promise<Texture>((resolve, reject) => { loader.parse(Uint8Array.from(bytes).buffer, resolve, reject); });
    texture.flipY = false; texture.generateMipmaps = true; texture.mipmaps = [];
    texture.minFilter = LinearMipmapLinearFilter; texture.magFilter = LinearFilter; texture.anisotropy = name === 'sdf' ? 4 : 8;
    texture.needsUpdate = true;
    gpuOnlyTexture(texture, 'Nine Dragon baked sign atlas (GPU only)');
    return texture;
  };
  let mono: Texture, colour: Texture, sdf: Texture;
  try { [mono, colour, sdf] = await Promise.all([read('mono'), read('colour'), read('sdf')]); }
  finally { loader.dispose(); }
  return { keys: rows.keys, glyphLayout: rows.glyphLayout, textures: { mono, colour, sdf },
    copies: rows.copies,
    neonLights: rows.neonLights.map(({ at, color, ...rest }) => ({ ...rest, at: new Vector3(...at), color: new Color(...color) })),
    lights: rows.lights.map(({ at, color, ...rest }) => ({ ...rest, at: new Vector3(...at), color: new Color(...color) })),
    geometry: name => {
      const index = rows.pools.findIndex(pool => pool.parts.includes(name));
      const geometry = libraries[index]?.geometry(name, name === 'world' ? { borrow: true } : undefined);
      if (geometry === null || geometry === undefined) throw new Error(`Nine baked sign has no ${name}`);
      return geometry;
    },
  };
}

/** Load exact prepared levels; middle levels retain the full cast's shared attribute buffers. */
export async function loadCastLods(target: Map<string, BufferGeometry>, key: string, base: BufferGeometry, levels: readonly (number | 'far')[], channels?: ModelGeometryPool['channels']): Promise<void> {
  await Promise.all(levels.map(async level => {
    const suffix = level === 'far' ? 'far' : `mid${level}`;
    target.set(`${key}:${suffix}`, castLod(base, await loadCast(`${key}-${suffix}`, channels), level !== 'far'));
  }));
}

/** Prepared indices share the native full-detail attributes; compact far levels own their packed attributes. */
export function castLod(base: BufferGeometry, prepared: BufferGeometry, middle: boolean): BufferGeometry {
  if (middle) {
    for (const [name, values] of Object.entries(base.attributes)) prepared.setAttribute(name, values);
    if (prepared.index === null) throw new Error('Prepared middle LOD has no index');
    prepared.setIndex(prepared.index.clone());
    prepared.boundingBox = null;
  }
  return prepared;
}

/** Native scene/geometry readers restore the offline window bases and channels. */
export async function loadFacadeWindows(material: Material): Promise<Object3D[]> {
  const product = await loadFirstPartyProduct('nine-dragon-stack');
  const { rows } = await product.json<GeometryBoot>('geometry/layout.json');
  return Promise.all(Array.from({ length: Math.ceil(rows.counts.windows / 4096) }, async (_, index) => {
    const bytes = Uint8Array.from(await product.file(`geometry/facade-windows-${index}.bin`));
    const count = Math.min(4096, rows.counts.windows - index * 4096);
    if (bytes.byteLength !== count * 26 * 4) throw new Error('Nine window instance packet differs');
    const channel = (offset: number, width: number): InstancedBufferAttribute => new InstancedBufferAttribute(new Float32Array(bytes.buffer, count * offset * 4, count * width), width);
    const quad = new PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);
    quad.setAttribute('aWin', channel(16, 4)); quad.setAttribute('aWall', channel(20, 3));
    const made = new InstancedMesh(quad, material, count); made.name = 'facade-windows';
    made.instanceMatrix = channel(0, 16); made.instanceColor = channel(23, 3);
    made.computeBoundingSphere(); made.computeBoundingBox();
    return made;
  }));
}
