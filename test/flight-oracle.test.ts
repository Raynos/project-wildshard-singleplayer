// oxlint-disable-next-line import/no-nodejs-modules -- The replay fixture is identified by its shipping source hash.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read committed captures to prove they are production policies, not handwritten oracles.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sources from './fixtures/flight-oracle/source.json';

describe('shipping flight policy capture', () => {
  it.each(sources)('$name preserves the captured shipping policy body byte for byte', row => {
    const fixture = readFileSync(`test/fixtures/flight-oracle/${row.name}.ts`, 'utf8');
    // G112 retires the production class; this body hash still identifies the original revision/blob.
    const body = fixture.slice(fixture.indexOf(row.start));
    expect(createHash('sha256').update(fixture).digest('hex')).toBe(row.fixtureSha256);
    expect(createHash('sha256').update(body).digest('hex')).toBe(row.bodySha256);
    expect(fixture.endsWith(body)).toBe(true);
  });
});
