import * as v from 'valibot';
import { stillImageUrl } from './stillImage';

const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
/** Optional immutable SHARD SELECT content; images are local, charged library hashes, never author URLs. */
export const PresentationSchema = v.strictObject({
  biome: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  blurb: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  card: v.strictObject({ thumb: hash, portrait: hash, landscape: hash }),
});
/** Data-only card metadata accepted by the full shardfile schema. */
export type Presentation = v.InferOutput<typeof PresentationSchema>;
/** Resolve the three admitted image hashes once per distinct file, without fetching or installing a service. */
export function presentationCard(presentation: Presentation, assets: ReadonlyMap<string, Uint8Array>): Presentation['card'] {
  const urls = new Map<string, string>();
  const resolve = (ref: string): string => {
    const prior = urls.get(ref); if (prior !== undefined) return prior;
    const bytes = assets.get(ref); if (bytes === undefined) throw new Error('Presentation image is missing admitted bytes');
    const url = stillImageUrl(bytes); urls.set(ref, url); return url;
  };
  return { thumb: resolve(presentation.card.thumb), portrait: resolve(presentation.card.portrait), landscape: resolve(presentation.card.landscape) };
}
