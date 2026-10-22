// The existing shell, piece and window draws borrow their separately admitted graphs.
import { Color, Texture, Vector2, Vector3, Vector4, type Material, type IUniform } from 'three';
import { lentLook, hasLentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import { slugRuntimeProduct } from '@wildshard/game/shardfile/runtimeProduct';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import type { MaterialEntry } from '@wildshard/format/materials';
import type { Shared } from './style';
import metadata from '../boot/metadata.generated.json' with { type: 'json' };

export type Uniforms = Record<string, IUniform>;
const tuple2 = [0, 0], tuple3 = [0, 0, 0], tuple4 = [0, 0, 0, 0];
/** The graphs that read the world's shared uniforms, and the params the eye computes instead (data/lookBindings.json). */
const rows = metadata.looks.bindings, COMPUTED = new Set(rows.computed);
interface Binding { readonly id: string; readonly param: string; readonly source: string; readonly key: string }
const books = new WeakMap<Readonly<Uniforms>, { readonly bindings: readonly Binding[]; readonly textures: Map<string, Texture> }>();
function isTexture(value: unknown): value is Texture { return value instanceof Texture; }
function isNumbers(value: unknown): value is number[] { return Array.isArray(value) && value.every(v => typeof v === 'number'); }
/**
 * Every declared param of the shared graphs reads the shared uniform of its own name (`uWash`) or of `u` + its name
 * (`fogBase` ← `uFogBase`); `computed` holds the eye's own values. Uniform writes only.
 */
export function syncLooks(shared: Readonly<Uniforms>, computed: Readonly<Record<string, GraphLiteral>> = {}, catalogue: Readonly<Record<string, MaterialEntry>> | undefined = slugRuntimeProduct('nine-dragon-stack')?.source.look.materials): void {
  let book = books.get(shared);
  if (book === undefined) {
    if (catalogue === undefined) return;
    const bindings: Binding[] = [];
    for (const id of rows.graphs) {
      const material = catalogue[id];
      if (material === undefined) continue;
      if (material.family !== 'graph' || !('graph' in material)) throw new Error(`Nine look ${id} is not a graph`);
      for (const param of Object.keys(material.graph.params ?? {})) {
        const source = /^u[A-Z]/.test(param) ? param : `u${param.charAt(0).toUpperCase()}${param.slice(1)}`;
        if (source in shared || COMPUTED.has(param)) bindings.push({ id, param, source, key: `${id}:${param}` });
      }
    }
    book = { bindings, textures: new Map() };
    books.set(shared, book);
  }
  for (const { id, param, source, key } of book.bindings) {
    if (!hasLentLook(id)) continue;
    const fixed = computed[param];
    if (fixed !== undefined) { setLentParam(id, param, fixed); continue; }
    const value: unknown = shared[source]?.value;
    const numeric = typeof value === 'number' || isNumbers(value) ? value : value instanceof Color ? value.toArray(tuple3) : value instanceof Vector3 ? value.toArray(tuple3)
      : value instanceof Vector2 ? value.toArray(tuple2) : value instanceof Vector4 ? value.toArray(tuple4) : null;
    if (numeric !== null) setLentParam(id, param, numeric);
    else if (isTexture(value) && book.textures.get(key) !== value) { setLentTexture(id, param, value); book.textures.set(key, value); }
  }
}
export function facadeUniforms(shared: Shared): Uniforms { return { ...shared.u, uSky: { value: new Color(rows.facade.uSky) }, uFacadeWash: { value: new Color(rows.facade.uFacadeWash) } }; }
export function jiehuaMaterial(shared: Uniforms, opt: { shrink?: readonly [number, number] } = {}): Material {
  syncLooks(shared);
  const id = opt.shrink === undefined ? 'nine-facade' : 'nine-facade-small';
  if (opt.shrink !== undefined) setLentParam(id, 'shrink', opt.shrink);
  return lentLook(id);
}
