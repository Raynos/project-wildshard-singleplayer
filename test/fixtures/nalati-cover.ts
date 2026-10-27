// oxlint-disable-next-line import/no-nodejs-modules -- The cover's committed inputs feed its build-time construction.
import { readFileSync } from 'node:fs';
import { COVER_INPUTS, nalatiCoverBake, type NalatiCover } from '../../src/shards/nalati-grasslands/generators/coverBake.mjs';

/** The cover as the product builds it (GR6), over the committed inputs. */
const inputs = new Map(COVER_INPUTS.map(url => [url, new Uint8Array(readFileSync(`public${url}`))]));
export const nalatiCover: NalatiCover = await nalatiCoverBake(url => { const bytes = inputs.get(url); if (bytes === undefined) throw new Error(`Missing cover input ${url}`); return bytes; });
