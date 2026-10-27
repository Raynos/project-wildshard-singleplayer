import * as v from 'valibot';
import { expect, test } from 'vitest';
import { CacheCommandSchema, CacheReplyEnvelopeSchema, CacheValueSchemas, CONTENT_CACHE_WIRE_CAP, isCacheCommand, isCacheReplyEnvelope, isCacheValue, type CacheCommand } from '../src/engine/boot/contentCacheProtocol';

// js-heap H9: the written-out checks must give each strict schema's exact verdict, valid or broken, key by key
const hash = 'a'.repeat(64), bytes = new Uint8Array(4);
const odd: unknown[] = [undefined, null, true, 0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 2, CONTENT_CACHE_WIRE_CAP + 1, '', 'x', 'B'.repeat(64),
  hash, 'https://example.com/a', 'not a url', `https://e.com/${'p'.repeat(2048)}`, 'bytes', 'stored', [], [hash], ['bad'], Array.from({ length: 10_001 }, () => hash), {}, bytes,
  new Uint8Array(0), { bytes: 1, entries: 2 }];
/** every base, then each key removed, an extra key added, and each key set to every odd value */
function variants(base: Record<string, unknown>): unknown[] {
  const out: unknown[] = [base, { ...base, extra: 1 }];
  for (const key of Object.keys(base)) {
    const { [key]: _gone, ...rest } = base; out.push(rest);
    for (const value of odd) out.push({ ...base, [key]: value });
  }
  return out;
}
const commands: Record<string, unknown>[] = [
  { id: 1, op: 'get', hash }, { id: 1, op: 'has', hash, bytes: 5 }, { id: 1, op: 'holds', hash, bytes: 5 },
  { id: 1, op: 'put', hash, bytes }, { id: 1, op: 'put', hash, bytes, keep: true }, { id: 1, op: 'pin', lease: 2, hashes: [hash] },
  { id: 1, op: 'release', lease: 2 }, { id: 1, op: 'flush' }, { id: 1, op: 'stats' },
  { id: 1, op: 'fetch', url: 'https://e.com/a', hash, bytes: 5, reply: 'bytes' }, { id: 1, op: 'fetch', url: '/rel', hash, bytes: 5, reply: 'stored', keep: false, urlCache: true },
];

test('commands: the written-out check gives the schema verdict', () => {
  let checked = 0;
  for (const base of commands) for (const input of variants(base)) {
    expect(isCacheCommand(input), JSON.stringify(input, (_k, value: unknown) => value instanceof Uint8Array ? `u8[${value.length}]` : value)?.slice(0, 200)).toBe(v.safeParse(CacheCommandSchema, input).success);
    checked++;
  }
  for (const input of [null, 'get', [], { op: 'nope', id: 1 }, Object.assign(Object.create({ inherited: 1 }), { id: 1, op: 'flush' })]) {
    expect(isCacheCommand(input)).toBe(v.safeParse(CacheCommandSchema, input).success); checked++;
  }
  expect(checked).toBeGreaterThan(700);
});

test('reply envelopes and values: the written-out checks give the schema verdicts', () => {
  for (const input of [...variants({ id: 1, ok: true, value: null }), ...variants({ id: 1, ok: false, error: 'no' }), { id: 1, ok: false, error: 'e'.repeat(2049) }, { id: 1, ok: 'yes', value: 1 }, null, []]) {
    expect(isCacheReplyEnvelope(input)).toBe(v.safeParse(CacheReplyEnvelopeSchema, input).success);
  }
  const timing = { name: 'n', startTime: 1, responseEnd: 2, transferSize: 3, encodedBodySize: 4 };
  const values: unknown[] = [...odd, ...variants({ bytes: 1, entries: 2 }), ...variants({ fetched: null, stored: true, cached: false, origin: 1, timing: null }),
    ...variants({ fetched: bytes, stored: true, cached: false, origin: 1, timing }), ...variants(timing).map(t => ({ fetched: null, stored: true, cached: false, origin: 1, timing: t }))];
  for (const op of Object.keys(CacheValueSchemas) as CacheCommand['op'][]) for (const value of values) {
    expect(isCacheValue(op, value), op).toBe(v.safeParse(CacheValueSchemas[op], value).success);
  }
});
