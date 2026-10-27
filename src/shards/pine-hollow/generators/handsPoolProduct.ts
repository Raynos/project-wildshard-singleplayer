import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { handsPool } from './handsPool';

const made = await handsPool();
type Rows = Awaited<ReturnType<typeof handsPool>>['rows'];
/** GR8: the held hands pool, built once per program (no scheduler job, no stored GLB). Its rows name the pool by the
 *  URL its bytes' SHA-256 gives, the retired job's public path, which stays the blob's URL alias. */
export const HANDS_POOL: { glb: Uint8Array; rows: Rows } = {
  glb: made.glb, rows: { ...made.rows, pool: { ...made.rows.pool, url: `/assets/pine-hollow/baked/${hashImmutableBytes(made.glb)}.glb` } },
};
