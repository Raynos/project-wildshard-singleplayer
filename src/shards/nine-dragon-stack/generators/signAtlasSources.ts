import * as v from 'valibot';
import { SignAtlasSchema } from './sections';
import { signAtlasBlobs } from './signAtlasOutput';

/** The original pools and channel rows, selected before the shared reader allocates geometry. */
export const SIGN_ATLAS_BLOBS = signAtlasBlobs();
const tierFiles = (['phone', 'desktop'] as const).map(tier => {
  const blob = SIGN_ATLAS_BLOBS.find(row => row.file.name === `signs/atlas-${tier}.json`);
  if (blob === undefined) throw new Error(`Missing Nine sign sources for ${tier}`);
  const rows = v.parse(SignAtlasSchema, JSON.parse(new TextDecoder().decode(blob.bytes), (_key, value: unknown) => value === '-0' ? -0 : value));
  return rows.pools.map(pool => ({ file: pool.name, tier, parts: pool.parts, channels: rows.channels.flatMap(row => {
    const parts = row.parts?.filter(part => pool.parts.includes(part));
    return parts?.length === 0 ? [] : [{ ...row, ...(parts === undefined ? {} : { parts }) }];
  }) }));
});
// Each source reader retains its original <= 100 parts; phone and desktop select the same named part set.
export const SIGN_POOL_LIBRARIES = (tierFiles[0] ?? []).map((_file, index) => ({ id: `signs-${index}`, kind: 'pool', publish: 'signs',
  files: tierFiles.flatMap(files => { const file = files[index]; if (file === undefined) throw new Error('Nine sign tier pools differ'); return [file]; }) }));
