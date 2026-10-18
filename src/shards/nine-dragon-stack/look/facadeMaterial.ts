// The existing shell, piece and window draws borrow their separately admitted graphs.
import { Color, Texture, Vector2, Vector3, Vector4, type Material, type IUniform } from 'three';
import { lentLook, hasLentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import { slugRuntimeProduct } from '@wildshard/game/shardfile/runtimeProduct';
import type { MaterialEntry } from '@wildshard/format/materials';
import type { Shared } from './style';

export type Uniforms = Record<string, IUniform>;
const tuple2 = [0, 0], tuple3 = [0, 0, 0], tuple4 = [0, 0, 0, 0];
const textureBooks = new WeakMap<Readonly<Uniforms>, Map<string, Texture>>();
const paramBooks = new WeakMap<Readonly<Uniforms>, Map<string, string[]>>();
const IDS = ['nine-architecture', 'nine-architecture-cut', 'nine-facade', 'nine-facade-small', 'nine-windows', 'nine-halo'];
function isTexture(value: unknown): value is Texture { return value instanceof Texture; }
/** Uniform writes only. Existing shared handles still own day, paint, Explorer and light tuning. */
export function syncArchitecture(shared: Readonly<Uniforms>, catalogue: Readonly<Record<string, MaterialEntry>> | undefined = slugRuntimeProduct('nine-dragon-stack')?.source.look.materials): void {
  let textures = textureBooks.get(shared);
  if (textures === undefined) { textures = new Map(); textureBooks.set(shared, textures); }
  let bindings = paramBooks.get(shared);
  if (bindings === undefined) {
    bindings = new Map();
    if (catalogue === undefined) return;
    for (const id of IDS) {
      const material = catalogue[id];
      if (material?.family !== 'graph' || !('graph' in material)) throw new Error(`Missing architecture graph ${id}`);
      for (const name of Object.keys(material.graph.params ?? {})) {
        if (!name.startsWith('u')) continue;
        const ids = bindings.get(name) ?? []; ids.push(id); bindings.set(name, ids);
      }
    }
    paramBooks.set(shared, bindings);
  }
  for (const [name, ids] of bindings) {
    const value: unknown = shared[name]?.value;
    const numeric = typeof value === 'number' ? value : value instanceof Color ? value.toArray(tuple3) : value instanceof Vector3 ? value.toArray(tuple3)
      : value instanceof Vector2 ? value.toArray(tuple2) : value instanceof Vector4 ? value.toArray(tuple4) : null;
    for (const id of ids) {
      if (!hasLentLook(id)) continue;
      if (numeric !== null) setLentParam(id, name, numeric);
      else if (isTexture(value) && textures.get(`${id}:${name}`) !== value) { setLentTexture(id, name, value); textures.set(`${id}:${name}`, value); }
    }
  }
}
export function facadeUniforms(shared: Shared): Uniforms { return { ...shared.u, uSky: { value: new Color(0xbcc4d2) }, uFacadeWash: { value: new Color(0xe0e3ef) } }; }
export function jiehuaMaterial(shared: Uniforms, opt: { shrink?: readonly [number, number] } = {}): Material {
  syncArchitecture(shared);
  const id = opt.shrink === undefined ? 'nine-facade' : 'nine-facade-small';
  if (opt.shrink !== undefined) setLentParam(id, 'shrink', opt.shrink);
  return lentLook(id);
}
export function windowMaterial(shared: Uniforms): Material { syncArchitecture(shared); return lentLook('nine-windows'); }
