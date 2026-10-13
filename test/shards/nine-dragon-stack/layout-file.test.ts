import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The test reads the generated build file the page fetches.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Native comparison proves every record byte without per-byte assertion overhead.
import { Buffer } from 'node:buffer';
import { decodeNineLayout } from '../../../src/shards/nine-dragon-stack/runtime/geometry';
import { layoutReviver } from '../../../src/shards/nine-dragon-stack/world/layoutBake';

describe('Nine layout build file (sp-o109)', () => {
  it('decodes in slices to exactly what one JSON.parse with the reviver reads', async () => {
    const bytes = new Uint8Array(readFileSync(new URL('../../../src/shards/nine-dragon-stack/data/layout.generated.json', import.meta.url)));
    let pauses = 0;
    const decoded = await decodeNineLayout(bytes, () => { pauses++; return Promise.resolve(); });
    const oracle: unknown = JSON.parse(new TextDecoder().decode(bytes), layoutReviver);
    if (typeof oracle !== 'object' || oracle === null || !('records' in oracle) || !Array.isArray(oracle.records) || !('rows' in oracle)) throw new Error('layout file shape');
    const records = Float64Array.from(oracle.records, (value: unknown) => typeof value === 'number' ? value : Number.NaN);
    expect(decoded.records.length).toBe(records.length);
    expect(Buffer.compare(
      Buffer.from(decoded.records.buffer, decoded.records.byteOffset, decoded.records.byteLength),
      Buffer.from(records.buffer, records.byteOffset, records.byteLength),
    )).toBe(0);
    expect(decoded.rows).toEqual(oracle.rows);
    expect(pauses).toBeGreaterThan(100);
  });
  it('refuses a truncated or altered file', async () => {
    const bytes = new Uint8Array(readFileSync(new URL('../../../src/shards/nine-dragon-stack/data/layout.generated.json', import.meta.url)));
    await expect(decodeNineLayout(bytes.subarray(0, 4096))).rejects.toThrow();
    const altered = Uint8Array.from(bytes); altered[20] = 0x78;
    await expect(decodeNineLayout(altered)).rejects.toThrow();
  });
});
