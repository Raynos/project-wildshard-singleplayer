import type policy from './pagePolicy.json';

/** Type-only JSON contract: ordered source groups for every render/texture mode. */
type Sources = Readonly<Record<'sky' | 'baked' | 'terrain' | 'trees' | 'physics' | 'cabins' | 'props' | 'art' | 'music' | 'sfx', readonly string[]>>;
interface Modes { readonly modes: Readonly<Record<'phone' | 'desktop', Readonly<Record<'img' | 'ktx2', Sources>>>> }
declare const rows: { readonly standalone: Modes; readonly grid: Modes; readonly policy: typeof policy };
export = rows;
