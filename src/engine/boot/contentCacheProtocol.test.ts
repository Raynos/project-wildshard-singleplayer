import { expect, test } from 'vitest';
import * as v from 'valibot';
import { CacheReplyEnvelopeSchema, CacheReplySchema, CacheValueSchemas, CONTENT_CACHE_WIRE_CAP } from './contentCacheProtocol';

test('operation schemas admit exactly the original reply shapes and operation rights', () => {
  const fetched = { fetched: Uint8Array.of(3), stored: true, cached: false, origin: 12, timing: null };
  const values = [null, false, true, Uint8Array.of(1), { bytes: 10, entries: 2 }, fetched];
  const rights = { get: [0, 3], has: [1, 2], holds: [1, 2], put: [1, 2], stats: [4], fetch: [5], flush: [0], pin: [0], release: [0] };
  for (const op of Object.keys(CacheValueSchemas) as (keyof typeof CacheValueSchemas)[]) {
    for (const [at, value] of values.entries()) {
      expect(v.safeParse(CacheReplySchema, { id: 1, ok: true, value }).success).toBe(true);
      expect(v.safeParse(CacheValueSchemas[op], value).success, `${op}/${at}`).toBe(rights[op].includes(at));
    }
  }
});

test('strict envelope and nested operation checks retain byte caps and refusal boundaries', () => {
  for (const value of [{ id: -1, ok: true, value: null }, { id: 1, ok: true, value: null, extra: true },
    { id: 1, ok: false, error: 'x'.repeat(2049) }, { id: 1, ok: false, error: 'refused', value: null }]) {
    expect(v.safeParse(CacheReplyEnvelopeSchema, value).success).toBe(false);
  }
  expect(v.safeParse(CacheReplyEnvelopeSchema, { id: 1, ok: false, error: 'x'.repeat(2048) }).success).toBe(true);
  expect(v.safeParse(CacheValueSchemas.get, new Uint8Array(CONTENT_CACHE_WIRE_CAP)).success).toBe(true);
  const large = new Uint8Array(CONTENT_CACHE_WIRE_CAP + 1);
  expect(v.safeParse(CacheValueSchemas.get, large).success).toBe(false);
  for (const value of [{ fetched: large, stored: true, cached: false, origin: 0, timing: null },
    { fetched: null, stored: true, cached: false, origin: 0, timing: { name: 'x', startTime: 0, responseEnd: 1, transferSize: -1, encodedBodySize: 1 } },
    { fetched: null, stored: true, cached: false, origin: 0, timing: null, extra: true }]) {
    expect(v.safeParse(CacheValueSchemas.fetch, value).success).toBe(false);
    expect(v.safeParse(CacheReplySchema, { id: 1, ok: true, value }).success).toBe(false);
  }
  expect(v.safeParse(CacheValueSchemas.stats, { bytes: 1, entries: 1, extra: true }).success).toBe(false);
});

test('checked fetch metadata is detached while its transferred body keeps identity', () => {
  const bytes = Uint8Array.of(1, 2), timing = { name: 'file', startTime: 1, responseEnd: 2, transferSize: 2, encodedBodySize: 2 };
  const input = { fetched: bytes, stored: true, cached: false, origin: 0, timing };
  const value = v.parse(CacheValueSchemas.fetch, input);
  expect(value).not.toBe(input); expect(value.fetched).toBe(bytes); expect(value.timing).not.toBe(timing);
  timing.transferSize = 99; input.stored = false;
  expect(value.stored).toBe(true); expect(value.timing?.transferSize).toBe(2);
});
