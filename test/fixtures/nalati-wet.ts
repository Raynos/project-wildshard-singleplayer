// oxlint-disable-next-line import/no-nodejs-modules -- Lend the unchanged registered native wet block to direct test owners.
import {readFileSync} from 'node:fs';

export const nalatiWetBlock={file:'data/geography-wet.bin',bytes:Uint8Array.from(readFileSync('src/shards/nalati-grasslands/data/geography-wet.bin'))};
/** Test-only predecessor transport; the independent full metadata and byte hashes remain pinned. */
export const originalNalatiWet=Buffer.from(nalatiWetBlock.bytes).toString('base64');
