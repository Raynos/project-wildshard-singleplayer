import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { PlaneGeometry, InstancedBufferAttribute, InstancedMesh, type Material, type Object3D, type BufferGeometry, type Texture, Color, Float32BufferAttribute, Vector3 } from 'three';
import type { GeometryBoot, SignAtlas, CastChannels } from '../runtime/productSections.generated';
import type { Emitter } from '../runtime/looks/emitterCards';
import { createModelLibrary, type ModelGeometryPool } from '@wildshard/game/plugin/geometry';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import type { FixedRows } from './castTypes';
import { layoutReviver } from './layoutBake';

/** Adopt the exact prepared prop at its former load phase; the caller owns this geometry. */
export async function loadCast(name: string, applicationChannels?: ModelGeometryPool['channels']): Promise<BufferGeometry> {
  const declared = await (await loadFirstPartyProduct('nine-dragon-stack')).json<CastChannels>('geometry/cast-channels.json');
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

/** Recorded fixed additions; their source author and the geometry are generated together. */
export async function loadFixedRows(): Promise<FixedRows> {
  const bytes = await (await loadFirstPartyProduct('nine-dragon-stack')).file('geometry/fixed-kits.json');
  return JSON.parse(new TextDecoder().decode(bytes), layoutReviver) as FixedRows;
}

export interface BakedSigns {
  readonly keys: Readonly<Record<string, string>>;
  readonly lights: readonly Emitter[];
  readonly neonLights: readonly Emitter[];
  readonly copies: SignAtlas['copies'];
  readonly glyphLayout: SignAtlas['glyphLayout'];
  readonly textures: { readonly mono: Texture; readonly colour: Texture; readonly sdf: Texture };
  readonly geometry: (name: string) => BufferGeometry;
}

/** Existing rest-pool reader and product texture handles; painting, packing and face construction are offline. */
export async function loadSignAtlas(tier: 'phone' | 'desktop', scenes: SceneHandles): Promise<BakedSigns> {
  const product = await loadFirstPartyProduct('nine-dragon-stack');
  const rows = JSON.parse(new TextDecoder().decode(await product.file(`signs/atlas-${tier}.json`)), layoutReviver) as SignAtlas;
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
  const textures = { mono: scenes.texture('signs.mono'), colour: scenes.texture('signs.colour'), sdf: scenes.texture('signs.sdf') };
  return { keys: rows.keys, glyphLayout: rows.glyphLayout, textures,
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
