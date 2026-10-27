import { handsPool } from './handsPool';

/** The product name of the held hands pool. */
export const HANDS_POOL_NAME = 'models/held/hands.glb';
const made = await handsPool();
type Rows = Awaited<ReturnType<typeof handsPool>>['rows'];
/** GR8: the held hands pool, built once per program (no scheduler job, no stored GLB); its rows name the pool by its
 *  product name. */
export const HANDS_POOL: { glb: Uint8Array; rows: Rows } = { glb: made.glb, rows: { ...made.rows, pool: { ...made.rows.pool, url: HANDS_POOL_NAME } } };
