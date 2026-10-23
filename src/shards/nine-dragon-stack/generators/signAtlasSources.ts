import * as v from 'valibot';
import { SignAtlasSchema } from './sections';
import source from '../data/signSources.generated.json' with { type: 'json' };

/** Binary source paths are read by the SDK after the declaration has loaded. */
export const SIGN_ATLAS_SOURCES = v.parse(v.array(v.object({ name: v.string(), kind: v.picklist(['glb', 'ktx2', 'json']), source: v.string(),
  options: v.object({ decoded: v.number(), gpu: v.number(), triangles: v.number(), draws: v.number(), critical: v.boolean(), dependencies: v.array(v.string()) }) })), source.sources);
/** The same admitted metadata used by the offline product builder. */
export const SIGN_ATLAS_ROWS = v.parse(v.object({ phone: SignAtlasSchema, desktop: SignAtlasSchema }),
  JSON.parse(JSON.stringify(source.rows), (_key, value: unknown) => value === '-0' ? -0 : value));
const tierFiles = (['phone', 'desktop'] as const).map(tier => {
  const rows = SIGN_ATLAS_ROWS[tier];
  return rows.pools.map(pool => ({ file: pool.name, tier, parts: pool.parts, channels: rows.channels.flatMap(row => {
    const parts = row.parts?.filter(part => pool.parts.includes(part));
    return parts?.length === 0 ? [] : [{ ...row, ...(parts === undefined ? {} : { parts }) }];
  }) }));
});
// Each source reader retains its original <= 100 parts; phone and desktop select the same named part set.
export const SIGN_POOL_LIBRARIES = (tierFiles[0] ?? []).map((_file, index) => ({ id: `signs-${index}`, kind: 'pool', publish: 'signs',
  files: tierFiles.flatMap(files => { const file = files[index]; if (file === undefined) throw new Error('Nine sign tier pools differ'); return [file]; }) }));
