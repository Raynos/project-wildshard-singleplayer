import * as v from 'valibot';
import type {SaveStore} from '@wildshard/engine/saves/store';
import type {TitleManifest} from '../shard/titleList';

/** A scheduling preference only; it cannot select a world or admit a file. */
export interface TitlePrefetchChoice {
  readonly read: () => string | null;
  readonly flow: () => 'client' | 'grid';
  readonly remember: (slug: string, flow?: 'client' | 'grid') => void;
}
const choices = new WeakMap<Pick<SaveStore, 'define'>, TitlePrefetchChoice>();
/** Define lazily at the composition root; importing this module installs no
 * save, listener, downloader or service. Blocked storage keeps its fallback. */
export function titlePrefetchChoice(store: Pick<SaveStore, 'define'>): TitlePrefetchChoice {
  const previous = choices.get(store);
  if (previous !== undefined) return previous;
  const slug = v.pipe(v.string(), v.maxLength(120), v.regex(/^[a-z0-9_-]+$/u));
  const schema = v.nullable(v.strictObject({slug, flow: v.picklist(['client', 'grid'])}));
  const slot = store.define({key: 'titlePrefetch', scope: 'device', version: 2, schema, initial: () => null,
    migrate: {1: (old: unknown) => typeof old === 'string' ? {slug: old, flow: 'client'} : null}});
  const choice: TitlePrefetchChoice = {read: () => slot.read()?.slug ?? null, flow: () => slot.read()?.flow ?? 'client',
    remember: (selected, flow = 'client'): void => {slot.write({slug: selected, flow});}};
  choices.set(store, choice);
  return choice;
}

/** The grid home goes first, followed by the last chosen compiled product.
 * Frozen LEGACY-only, hidden and unavailable metadata never seeds downloads. */
export function titlePrefetchTargets(home: string | undefined, last: string | null, rows: readonly TitleManifest[], developer: boolean): readonly string[] {
  const bySlug = new Map<string, TitleManifest>(rows.map(row => [row.slug, row]));
  return [...new Set([home, last])].filter((slug): slug is string => {
    if (typeof slug !== 'string') return false;
    const row = bySlug.get(slug);
    return row !== undefined && (row.shardfile !== undefined || row.gridShardfile !== undefined)
      && row.entries.shardfile && row.legacy !== true && (developer || row.status !== 'experimental' && row.status !== 'hidden');
  });
}
