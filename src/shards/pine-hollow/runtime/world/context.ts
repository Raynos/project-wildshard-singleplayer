/**
 * Pine Hollow's model context (E315 M2, src/engine/models/model.ts): one per running shard — its sky, its renderer, and the
 * `once` memo every Pine Hollow model shares (the loaded photoscans, TRELLIS props, crag kit). Keyed by the shard's Sky,
 * so a shard reloaded after a switch gets a fresh one (the engine's `sharedModelContext`).
 */
import { sharedModelContext, type ModelContext, type ModelRendererHost } from '@wildshard/engine/models/model';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type { NativeView } from '../productSections.generated.d.ts';


/** the context for this shard's sky (made on first ask; a host's renderer given later joins it, keeping what was loaded) */
export function pineModels(sky: Sky, host: ModelRendererHost | null = null): ModelContext {
  return sharedModelContext(sky, host);
}

let nativeView: NativeView | null = null;
/** The resident world and cold Explorer share the same admitted named file. */
export async function admitPineView(product: ShardProduct): Promise<void> {
  nativeView = await product.json<NativeView>('look/native-view.json');
}
export function pineView(): NativeView {
  if (nativeView === null) throw new Error('Pine native view rows are not admitted');
  return nativeView;
}
