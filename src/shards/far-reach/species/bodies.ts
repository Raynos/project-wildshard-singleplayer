import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { skinnedModel, type SkinnedModel } from '@wildshard/sdk/skinnedModel';
import { SKY_CREATURES, SKY_CREATURE_RIGS, type SkyCreature, type SkyCreatureExtras } from '../data/creatures';
import { releaseDecodedOnUpload } from '../look/image';

/**
 * Sky Reach's creature bodies, baked offline (SHARD-PLATFORM M3: `generators/creatures.ts` → `rigs/<creature>.glb`, the
 * SDK's skinned-model bake): each is loaded once behind the loading screen and every spawn takes a copy, its bones, skin,
 * dims and (the Roc) painted map exactly as the generator processed them. A body that fails to load is a console.error
 * page fault; its species then stands in its code model, as headless always does.
 */
const models = new Map<SkyCreature, SkinnedModel>();
let loading: Promise<void> | null = null;

async function load(creature: SkyCreature): Promise<void> {
  const model = skinnedModel(SKY_CREATURE_RIGS[creature]);
  try {
    await model.load();
    for (const map of model.textures()) {
      // Memory saver: the decoded atlas goes at its upload (no CPU reader; every Roc shares this one texture)
      const atlas: unknown = map.image;
      if (typeof ImageBitmap !== 'undefined' && atlas instanceof ImageBitmap) releaseDecodedOnUpload(map, () => { atlas.close(); });
      retainCachedResources(map);
      cacheUntilDisposed(map, () => { if (models.get(creature) === model) { models.delete(creature); loading = null; } });
    }
    models.set(creature, model);
  } catch (e: unknown) { console.error(`[far-reach] the baked creature ${creature} did not load:`, e); }
}
/** Load every baked creature body once (a failed one is faulted). */
export function preloadSkyBodies(): Promise<void> {
  loading ??= Promise.all(SKY_CREATURES.filter((creature) => !models.has(creature)).map(load)).then(() => undefined);
  return loading;
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
/** The look numbers the generator wrote beside the skin (`data/creatures.ts` SkyCreatureExtras), or null. */
function extrasOf(value: unknown): SkyCreatureExtras | null {
  if (typeof value !== 'object' || value === null) return null;
  const dims: unknown = Reflect.get(value, 'dims'), jitter: unknown = Reflect.get(value, 'facetJitter'), light: unknown = Reflect.get(value, 'selfLight');
  if (typeof dims !== 'object' || dims === null) return null;
  const n = (key: string): number | null => { const v: unknown = Reflect.get(dims, key); return isNumber(v) ? v : null; };
  const bodyY = n('bodyY'), bodyHalfLen = n('bodyHalfLen'), bodyRadius = n('bodyRadius'), headRadius = n('headRadius'), legLen = n('legLen'), halfWidth = n('halfWidth');
  if (bodyY === null || bodyHalfLen === null || bodyRadius === null || headRadius === null || legLen === null || halfWidth === null) return null;
  return { dims: { bodyY, bodyHalfLen, bodyRadius, headRadius, legLen, feet: [], halfWidth }, ...(isNumber(jitter) ? { facetJitter: jitter } : {}), ...(isNumber(light) ? { selfLight: light } : {}) };
}
/** A copy of a baked creature body, as the species look's `build()` returns it, or null (not loaded: the code model stands in). */
export function skyBody(creature: SkyCreature): AnimalSpecies | null {
  const model = models.get(creature);
  if (model === undefined) return null;
  const asset = model.copy(), extras = extrasOf(asset.extras), map = asset.parts[0]?.map ?? null;
  if (extras === null) throw new Error(`[far-reach] the baked creature ${creature} has no dims`);
  return { bones: asset.bones.map((bone) => ({ name: bone.name, parent: bone.parent, pos: bone.pos })), furParts: [], eyeParts: [], hardParts: asset.parts.map((part) => part.geometry),
    dims: extras.dims, ...(map === null ? {} : { map }), ...(extras.facetJitter === undefined ? {} : { facetJitter: extras.facetJitter }),
    ...(extras.selfLight === undefined ? {} : { selfLight: extras.selfLight }) };
}
