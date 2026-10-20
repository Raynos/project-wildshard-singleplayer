import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { type BufferGeometry, type Texture, Color, Float32BufferAttribute, Vector3 } from 'three';
import type { SignAtlas } from '../runtime/productSections.generated';
import type { Emitter } from '../runtime/looks/emitterCards';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { layoutReviver } from './layoutBake';

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

export interface BakedSigns {
  readonly keys: Readonly<Record<string, string>>;
  readonly lights: readonly Emitter[];
  readonly neonLights: readonly Emitter[];
  readonly copies: SignAtlas['copies'];
  readonly glyphLayout: SignAtlas['glyphLayout'];
  readonly textures: { readonly mono: Texture; readonly colour: Texture; readonly sdf: Texture };
  readonly geometry: (name: string) => BufferGeometry;
}

/** Sign metadata references textures and mutable geometries owned by the shared scene host. */
export async function loadSignAtlas(tier: 'phone' | 'desktop', scenes: SceneHandles): Promise<BakedSigns> {
  const product = await loadFirstPartyProduct('nine-dragon-stack');
  const rows = JSON.parse(new TextDecoder().decode(await product.file(`signs/atlas-${tier}.json`)), layoutReviver) as SignAtlas;
  const textures = { mono: scenes.texture('signs.mono'), colour: scenes.texture('signs.colour'), sdf: scenes.texture('signs.sdf') };
  return { keys: rows.keys, glyphLayout: rows.glyphLayout, textures,
    copies: rows.copies,
    neonLights: rows.neonLights.map(({ at, color, ...rest }) => Object.assign(rest, { at: new Vector3(...at), color: new Color(...color) })),
    lights: rows.lights.map(({ at, color, ...rest }) => Object.assign(rest, { at: new Vector3(...at), color: new Color(...color) })),
    geometry: name => { const geometry = scenes.geometry(`signs.${name}`); return name === 'world' ? geometry : geometry.clone(); },
  };
}

/** Load exact prepared levels; middle levels retain the full cast's shared attribute buffers. */
export function loadCastLods(target: Map<string, BufferGeometry>, key: string, base: BufferGeometry, levels: readonly (number | 'far')[], scenes: SceneHandles): void {
  for (const level of levels) {
    const suffix = level === 'far' ? 'far' : `mid${level}`;
    target.set(`${key}:${suffix}`, castLod(base, scenes.geometry(`casts.${key}-${suffix}`), level !== 'far'));
  }
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
