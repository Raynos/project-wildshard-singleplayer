import { stillImageUrl } from './stillImage';
import type { Presentation } from '@wildshard/format/presentation';

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
