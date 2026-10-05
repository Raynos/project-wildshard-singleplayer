// oxlint-disable-next-line import/no-nodejs-modules -- The replay oracle carries the hash of its shipping source body.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read committed source fixtures, never execute a handwritten policy oracle.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sources from './fixtures/grazer-oracle/source.json';

describe('shipping grazer policy capture', () => {
  it.each(sources)('$name preserves the captured shipping policy byte for byte', row => {
    const fixture = readFileSync(`test/fixtures/grazer-oracle/${row.name}.ts`, 'utf8');
    // G112 retires the production class; this body hash still identifies the original revision/blob.
    const body = fixture.slice(fixture.indexOf(row.start));
    expect(createHash('sha256').update(fixture).digest('hex')).toBe(row.fixtureSha256);
    expect(createHash('sha256').update(body).digest('hex')).toBe(row.bodySha256);
    expect(fixture.endsWith(body)).toBe(true);
  });
});
