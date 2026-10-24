/** Offline inventories, preserving authored order and repeated URLs. */
type Sources = Readonly<Record<'sky' | 'baked' | 'terrain' | 'trees' | 'physics' | 'cabins' | 'props' | 'art' | 'music' | 'sfx', readonly string[]>>;
interface Mode { readonly modes: Readonly<Record<'phone' | 'desktop', Readonly<Record<'img' | 'ktx2', Sources>>>> }
declare const rows: { readonly shard: Mode; readonly grid: Mode; readonly bakedUnreadPrefixes: readonly string[] };
// oxlint-disable-next-line import/no-default-export -- JSON modules expose a default payload; this is a type-only declaration.
export default rows;
