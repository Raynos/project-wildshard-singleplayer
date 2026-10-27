// oxlint-disable-next-line import/no-nodejs-modules -- The cover's committed inputs feed its build-time construction.
import { readFileSync } from 'node:fs';
import { COVER_INPUTS, nalatiCoverBake, type NalatiCover } from '../../src/shards/nalati-grasslands/generators/coverBake.mjs';

/** The cover as the product builds it (GR6), over the committed inputs. */
const inputs = new Map(COVER_INPUTS.map(url => [url, new Uint8Array(readFileSync(`public${url}`))]));
export const nalatiCover: NalatiCover = await nalatiCoverBake(url => { const bytes = inputs.get(url); if (bytes === undefined) throw new Error(`Missing cover input ${url}`); return bytes; });

/** The same rows as the retired nalati-cover job wrote them (its public shape banks by URL, its own script as each model's
 *  file): the predecessor input the original dressing scene oracles were pinned over. */
// each row keeps its own key order (the pins are the retired job's exact bytes): the model file is set in place
const predecessorRow = (row: unknown): unknown => {
  const copy: unknown = structuredClone(row), model: unknown = typeof copy === 'object' && copy !== null ? Reflect.get(copy, 'model') : undefined;
  const file: unknown = typeof model === 'object' && model !== null ? Reflect.get(model, 'file') : undefined;
  if (typeof model !== 'object' || model === null || typeof file !== 'string') throw new Error('Cover row requires its model file');
  Reflect.set(model, 'file', file.replace('/coverBake.mjs', '/bake-cover.mjs'));
  return copy;
};
const tierRows = (tier: 'phone' | 'desktop'): unknown => ({ ...nalatiCover.rows[tier], catalogue: nalatiCover.rows[tier].catalogue.map(predecessorRow),
  packed: { ...nalatiCover.rows[tier].packed, bin: `/assets/nalati/baked/cover-${tier}.bin` } });
export const nalatiPredecessorCoverRows: unknown = { ...nalatiCover.rows, phone: tierRows('phone'), desktop: tierRows('desktop') };
