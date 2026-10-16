/**
 * Pine Hollow's model context (E315 M2, src/engine/models/model.ts): one per running shard — its sky, its renderer, and the
 * `once` memo every Pine Hollow model shares (the loaded photoscans, TRELLIS props, crag kit). Keyed by the shard's Sky,
 * so a shard reloaded after a switch gets a fresh one (the engine's `sharedModelContext`).
 */
import { sharedModelContext, type ModelContext, type ModelRendererHost } from '@wildshard/engine/models/model';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

/** the context for this shard's sky (made on first ask; a host's renderer given later joins it, keeping what was loaded) */
export function pineModels(sky: Sky, host: ModelRendererHost | null = null): ModelContext {
  return sharedModelContext(sky, host);
}
