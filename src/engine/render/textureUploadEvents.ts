import { Texture } from 'three';
import type { Renderer } from './renderer';

const listeners = new WeakMap<Texture, Set<(texture: Texture) => void>>();
const installed = new WeakSet();
const isTexture = (value: unknown): value is Texture => value instanceof Texture;

/** One notification after native upload completion. Never replaces Texture.onUpdate.
 * Unuploaded textures and their listeners remain weakly owned by the texture. */
export function onceTextureUploaded(texture: Texture, run: (texture: Texture) => void): void {
  let rows = listeners.get(texture);
  if (rows === undefined) { rows = new Set(); listeners.set(texture, rows); }
  rows.add(run);
}

export interface TextureUploadRenderer {
  readonly properties: Pick<Renderer['properties'], 'get'>;
  initTexture: Renderer['initTexture'];
  render: Renderer['render'];
}

/** Observe r186's completed texture/source versions after its original calls.
 * Explicit warm-up uploads and ordinary material draws use the same channel.
 * A failed upload, changed source or throwing native callback cannot release it. */
export function installTextureUploadEvents(renderer: TextureUploadRenderer): void {
  if (installed.has(renderer)) return;
  installed.add(renderer);
  const pending = new Set<WeakRef<Texture>>(), queued = new WeakMap<Texture, WeakRef<Texture>>();
  const get = renderer.properties.get.bind(renderer.properties);
  renderer.properties.get = object => {
    if (isTexture(object) && listeners.has(object) && !queued.has(object)) {
      const ref = new WeakRef(object); queued.set(object, ref); pending.add(ref);
    }
    return get(object);
  };
  const version = (object: object): unknown => {
    const row: unknown = get(object);
    return typeof row === 'object' && row !== null ? Reflect.get(row, '__version') : undefined;
  };
  const flush = (): void => {
    for (const ref of pending) {
      const texture = ref.deref();
      if (texture === undefined) { pending.delete(ref); continue; }
      if (version(texture) !== texture.version || version(texture.source) !== texture.source.version) continue;
      pending.delete(ref); queued.delete(texture);
      const rows = listeners.get(texture); listeners.delete(texture);
      if (rows !== undefined) for (const run of rows) run(texture);
    }
  };
  const init = renderer.initTexture.bind(renderer), draw = renderer.render.bind(renderer);
  renderer.initTexture = texture => { init(texture); flush(); };
  renderer.render = (...args) => { draw(...args); flush(); };
}
