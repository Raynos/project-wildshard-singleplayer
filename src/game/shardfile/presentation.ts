import type { Scope } from '@wildshard/engine/app/scope';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { stillImageObjectUrl, stillImageUrl } from './stillImage';
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


const imageOwners = new WeakMap<Scope, Map<string, Scope>>();

/** Replace this owner's per-identity image batch only after every admitted image resolves.
 * Shared card/map hashes use one detached Blob; failed construction preserves the prior batch. */
export function ownedPresentationImages(source: Pick<Shardfile, 'identity' | 'presentation' | 'map'>,
  assets: ReadonlyMap<string, Uint8Array>, owner: Scope): { card?: Presentation['card']; map?: string } {
  if (owner.disposed || owner.disposing) throw new Error('Image owner retired');
  const batches = imageOwners.get(owner) ?? new Map<string, Scope>();
  const scope = owner.child('manifest images'), urls = new Map<string, string>();
  const resolve = (ref: string): string => {
    const previous = urls.get(ref); if (previous !== undefined) return previous;
    const bytes = assets.get(ref); if (bytes === undefined) throw new Error('Presentation image is missing admitted bytes');
    const url = stillImageObjectUrl(bytes, scope); urls.set(ref, url); return url;
  };
  try {
    const authored = source.presentation?.card;
    const card = authored === undefined ? undefined : { thumb: resolve(authored.thumb), portrait: resolve(authored.portrait), landscape: resolve(authored.landscape) };
    const map = source.map === undefined ? undefined : resolve(source.map.image);
    const identity = source.identity.slug, previous = batches.get(identity);
    scope.onDispose(() => { if (batches.get(identity) === scope) batches.delete(identity); });
    batches.set(identity, scope); imageOwners.set(owner, batches);
    previous?.dispose();
    return { ...(card === undefined ? {} : { card }), ...(map === undefined ? {} : { map }) };
  } catch (error) { scope.dispose(); throw error; }
}
