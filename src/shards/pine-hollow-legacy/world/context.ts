/**
 * Pine Hollow's model context (E315 M2, src/engine/models/model.ts): one per running shard — its sky, its renderer, and the
 * `once` memo every Pine Hollow model shares (the loaded photoscans, TRELLIS props, crag kit). Keyed by the shard's Sky,
 * so a shard reloaded after a switch gets a fresh one.
 */
import { modelContext, type ModelContext } from '@wildshard/engine/models/model';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

const bySky = new WeakMap<Sky, ModelContext>();

/** the context for this shard's sky (made on first ask; a renderer given later joins it, keeping what was loaded) */
export function pineModels(sky: Sky, renderer: Renderer | null = null): ModelContext {
  let ctx = bySky.get(sky);
  if (ctx === undefined) ctx = modelContext(sky, renderer);
  else if (ctx.renderer === null && renderer !== null) ctx = { sky, renderer, once: ctx.once };
  bySky.set(sky, ctx);
  return ctx;
}
