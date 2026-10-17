/**
 * Pine Hollow's model context (E315 M2, src/engine/models/model.ts): one per running shard — its sky, its renderer, and the
 * `once` memo every Pine Hollow model shares (the loaded photoscans, TRELLIS props, crag kit). Keyed by the shard's Sky,
 * so a shard reloaded after a switch gets a fresh one (the engine's `sharedModelContext`).
 */
import { sharedModelContext, type ModelContext, type ModelRendererHost } from '@wildshard/engine/models/model';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import * as v from 'valibot';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { NativeViewSchema } from '../sections';


/** the context for this shard's sky (made on first ask; a host's renderer given later joins it, keeping what was loaded) */
export function pineModels(sky: Sky, host: ModelRendererHost | null = null): ModelContext {
  return sharedModelContext(sky, host);
}

let nativeView: v.InferOutput<typeof NativeViewSchema> | null = null;
/** The resident world and cold Explorer share the same admitted named file. */
export async function admitPineView(product: ShardProduct): Promise<void> {
  nativeView = v.parse(NativeViewSchema, JSON.parse(new TextDecoder('utf-8', { fatal:true }).decode(await product.file('look/native-view.json'))));
}
export function pineView(): v.InferOutput<typeof NativeViewSchema> {
  if (nativeView === null) throw new Error('Pine native view rows are not admitted');
  return nativeView;
}
