import * as v from 'valibot';
import { SignAtlasSchema } from './sections';

function buildSignSourceRows(source: { readonly sources: unknown; readonly rows: unknown }): { sources: { name: string; kind: "json" | "glb" | "ktx2"; source: string; options: { decoded: number; gpu: number; triangles: number; draws: number; critical: boolean; dependencies: string[]; }; }[]; rows: { phone: { glyphLayout: { cell: number; fontPx: number; spread: number; skeletonSpread: number; }; keys: Record<string, string>; pools: { name: string; parts: string[]; }[]; channels: { name: string; source: string; width: number; parts?: string[]; }[]; lights: { at: [number, number, number]; color: [number, number, number]; w: number; h: number; power: number; spill: number; }[]; neonLights: { at: [number, number, number]; color: [number, number, number]; w: number; h: number; power: number; spill: number; }[]; copies: { neon: boolean; boxes: number[]; poses: { x: number; y: number; z: number; yaw: number; variant: string; params: Record<string, unknown>; }[]; }[]; }; desktop: { glyphLayout: { cell: number; fontPx: number; spread: number; skeletonSpread: number; }; keys: Record<string, string>; pools: { name: string; parts: string[]; }[]; channels: { name: string; source: string; width: number; parts?: string[]; }[]; lights: { at: [number, number, number]; color: [number, number, number]; w: number; h: number; power: number; spill: number; }[]; neonLights: { at: [number, number, number]; color: [number, number, number]; w: number; h: number; power: number; spill: number; }[]; copies: { neon: boolean; boxes: number[]; poses: { x: number; y: number; z: number; yaw: number; variant: string; params: Record<string, unknown>; }[]; }[]; }; }; libraries: { id: string; kind: string; publish: string; files: { file: string; tier: "phone" | "desktop"; parts: string[]; channels: { parts?: string[]; name: string; source: string; width: number; }[]; }[]; }[]; } {
const SIGN_ATLAS_SOURCES = v.parse(v.array(v.object({ name: v.string(), kind: v.picklist(['glb', 'ktx2', 'json']), source: v.string(),
  options: v.object({ decoded: v.number(), gpu: v.number(), triangles: v.number(), draws: v.number(), critical: v.boolean(), dependencies: v.array(v.string()) }) })), source.sources);
/** The same admitted metadata used by the offline product builder. */
const SIGN_ATLAS_ROWS = v.parse(v.object({ phone: SignAtlasSchema, desktop: SignAtlasSchema }),
  JSON.parse(JSON.stringify(source.rows), (_key, value: unknown) => value === '-0' ? -0 : value));
const tierFiles = (['phone', 'desktop'] as const).map(tier => {
  const rows = SIGN_ATLAS_ROWS[tier];
  return rows.pools.map(pool => ({ file: pool.name, tier, parts: pool.parts, channels: rows.channels.flatMap(row => {
    const parts = row.parts?.filter(part => pool.parts.includes(part));
    return parts?.length === 0 ? [] : [{ ...row, ...(parts === undefined ? {} : { parts }) }];
  }) }));
});
// Each source reader retains its original <= 100 parts; phone and desktop select the same named part set.
const SIGN_POOL_LIBRARIES = (tierFiles[0] ?? []).map((_file, index) => ({ id: `signs-${index}`, kind: 'pool', publish: 'signs',
  files: tierFiles.flatMap(files => { const file = files[index]; if (file === undefined) throw new Error('Nine sign tier pools differ'); return [file]; }) }));
return { sources: SIGN_ATLAS_SOURCES, rows: SIGN_ATLAS_ROWS, libraries: SIGN_POOL_LIBRARIES };
}

/** Same checked rows and pool identities, from this invocation's owned result. */
export function signSourceRows(source: { readonly sources: unknown; readonly rows: unknown }): ReturnType<typeof buildSignSourceRows> { return buildSignSourceRows(source); }
