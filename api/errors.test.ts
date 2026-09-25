// api/errors.ts — client error reports: open POST (capped, clamped, rate-limited), password-gated reads; Vercel Blob is mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn<(path: string, body: unknown, opts: unknown) => Promise<unknown>>(() => Promise.resolve({}));
const list = vi.fn(() => Promise.resolve({
  blobs: [
    { pathname: 'errors/2026-09-25T10-00-00.000Z-aaaaaaaa.json', uploadedAt: '2026-09-25T10:00:00Z', size: 10 },
    { pathname: 'errors/2026-09-25T11-00-00.000Z-bbbbbbbb.json', uploadedAt: '2026-09-25T11:00:00Z', size: 20 },
  ],
  hasMore: false,
}));
vi.mock('@vercel/blob', () => ({ put, list, get: vi.fn() }));

const { POST, GET, OPTIONS, cleanContext, errorRecord, errorRateLimited, resetErrorRateLimit, MAX_ERROR_BODY_BYTES, MAX_STACK_CHARS, ERROR_RATE_PER_MIN } = await import('./errors');

const PW = 'test-pass-42';
const post = (body: unknown, ip = '1.2.3.4'): Request =>
  new Request('https://x.test/api/errors', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'x-forwarded-for': ip, 'user-agent': 'iPhone' } });
const get = (q = '', pw: string | null = PW): Request => new Request(`https://x.test/api/errors${q}`, { headers: pw === null ? {} : { 'x-review-password': pw } });
const report = { system: 'crabs', message: 'TypeError: x is undefined', stack: 'at crab (Crabs.ts:1:1)', count: 3, fatal: false, disabled: true, sinceBootMs: 81234.6, context: { build: 'abc1234-x', shard: 'driftwood-isle', tier: 'phone', touch: true, url: 'https://x.test/?at=1,2,3', pos: [1.234, 2, 3], yaw: 0.5, pitch: 0, secret: 'dropped' } };

beforeEach(() => {
  resetErrorRateLimit();
  put.mockClear();
  vi.stubEnv('REVIEW_PASSWORD', PW);
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'blob-token');
});

describe('POST', () => {
  it('stores the report under errors/ as category error — no password needed, no IP kept', async () => {
    const res = await POST(post(report));
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    expect(put.mock.calls.map((c) => c[0])).toEqual([`errors/${id}.json`]);
    const rec = JSON.parse(String(put.mock.calls[0]?.[1])) as Record<string, unknown>;
    expect(rec).toMatchObject({
      id, category: 'error', note: '[crabs] TypeError: x is undefined', screenshot: null, ua: 'iPhone',
      error: { system: 'crabs', count: 3, fatal: false, disabled: true, sinceBootMs: 81235 },
      context: { shard: 'driftwood-isle', tier: 'phone', touch: true, pos: [1.23, 2, 3] },
    });
    expect(rec).not.toHaveProperty('ip');
    expect(rec['context']).not.toHaveProperty('secret'); // whitelisted fields only
  });

  it('refuses an empty message, bad json, an oversize body; clamps a long stack', async () => {
    expect((await POST(post({ ...report, message: '  ' }))).status).toBe(400);
    expect((await POST(post('{nope'))).status).toBe(400);
    expect((await POST(post({ ...report, stack: 'x'.repeat(MAX_ERROR_BODY_BYTES) }))).status).toBe(413);
    expect(put).not.toHaveBeenCalled();
    const rec = errorRecord({ message: 'm', stack: 's'.repeat(MAX_STACK_CHARS * 2) }, 'id', '');
    expect(rec?.['error']).toMatchObject({ stack: 's'.repeat(MAX_STACK_CHARS), system: 'window' });
  });

  it('answers 503 when the blob store is not configured', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', undefined);
    expect((await POST(post(report))).status).toBe(503);
  });

  it(`rate limit: ${ERROR_RATE_PER_MIN} a minute per IP`, async () => {
    for (let i = 0; i < ERROR_RATE_PER_MIN; i++) expect(errorRateLimited('a', 1000 + i)).toBe(false);
    expect(errorRateLimited('a', 2000)).toBe(true);
    expect(errorRateLimited('b', 2000)).toBe(false);
    resetErrorRateLimit();
    for (let i = 0; i < ERROR_RATE_PER_MIN; i++) await POST(post(report, '9.9.9.9'));
    expect((await POST(post(report, '9.9.9.9'))).status).toBe(429);
  });

  it('cleanContext survives junk', () => {
    expect(cleanContext(null)).toEqual({});
    expect(cleanContext({ pos: ['x', 1, Number.NaN, 4] })['pos']).toEqual([0, 1, 0]);
  });
});

describe('GET', () => {
  it('lists and counts only with the review password', async () => {
    expect((await GET(get('', null))).status).toBe(401);
    expect((await GET(get('', 'wrong'))).status).toBe(401);
    const all = (await (await GET(get())).json()) as { entries: { id: string }[] };
    expect(all.entries.map((e) => e.id)).toEqual(['2026-09-25T10-00-00.000Z-aaaaaaaa', '2026-09-25T11-00-00.000Z-bbbbbbbb']);
    const since = (await (await GET(get('?since=2026-09-25T10-00-00.000Z-aaaaaaaa&count=1'))).json()) as { count: number; newest: string };
    expect(since).toEqual({ count: 1, newest: '2026-09-25T11-00-00.000Z-bbbbbbbb' });
    expect((await GET(get('?id=../../x'))).status).toBe(400);
  });

  it('answers CORS only for the native shells', () => {
    expect(OPTIONS(new Request('https://x.test', { method: 'OPTIONS', headers: { origin: 'capacitor://localhost' } })).headers.get('access-control-allow-origin')).toBe('capacitor://localhost');
    expect(OPTIONS(new Request('https://x.test', { method: 'OPTIONS', headers: { origin: 'https://evil.test' } })).headers.get('access-control-allow-origin')).toBeNull();
  });
});
