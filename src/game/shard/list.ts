import type { ShardManifest } from './manifest';

// The shard list is the composition root's (src/shards.generated.ts, installed by src/shardList.ts; Node tools by
// scripts/bake-loader.mjs; E362 AG4): the game knows that shards exist, never which. One slot per page, so a test that
// resets its modules still sees it. No runtime imports: a Node tool installs it without loading the engine.
const SLOT = Symbol.for('game.shards');
const CONTENT_SLOT = Symbol.for('game.shardContentIdentities');
const isList = (v: unknown): v is readonly ShardManifest[] => Array.isArray(v);
/** Install original prepared manifests and their reviewed legacy identities. Save/instance slugs never change. */
export function installShards(list: readonly ShardManifest[], legacyContent?: Readonly<Record<string, string>>): void {
  const manifests = new Map<string, ShardManifest>(list.map(manifest => [manifest.slug, manifest]));
  const content = legacyContent ?? Object.fromEntries(list.flatMap(manifest => {
    const primary = legacyContentIdentity(manifest.slug);
    return primary === undefined || !manifests.has(primary) ? [] : [[manifest.slug, primary]];
  }));
  for (const [copy, primary] of Object.entries(content)) {
    if (copy === primary || manifests.get(copy)?.legacy !== true || manifests.get(primary) === undefined || manifests.get(primary)?.legacy === true) {
      throw new Error('Legacy content identity requires an inventoried copy and its installed primary');
    }
  }
  Reflect.set(globalThis, CONTENT_SLOT, Object.freeze({ ...content }));
  Reflect.set(globalThis, SLOT, list);
}
/** Declared content ids retain their inventoried primary namespace in frozen copies; ordinary ids and all save identities stay unchanged. */
export function shardContentIdentity(slug: string): string { return legacyContentIdentity(slug) ?? slug; }
/** The original content namespace of an exact registered copy, or undefined for an ordinary shard. */
export function legacyContentIdentity(slug: string): string | undefined {
  const table: unknown = Reflect.get(globalThis, CONTENT_SLOT);
  if (typeof table !== 'object' || table === null) return undefined;
  const primary: unknown = Object.hasOwn(table, slug) ? Reflect.get(table, slug) : undefined;
  return typeof primary === 'string' ? primary : undefined;
}
/** Original manifests prepared for this page; titleList retains complete data-only catalogue metadata. */
export function shards(): readonly ShardManifest[] {
  const list: unknown = Reflect.get(globalThis, SLOT);
  if (!isList(list)) throw new Error('No shard list installed: the composition root installs it (src/shardList.ts)');
  return list;
}
