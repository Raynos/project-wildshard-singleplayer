// api/inbox.ts — the review inbox's guards (password, rate limit, body caps, JPEG sniff); Vercel Blob is mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn<(path: string, body: unknown, opts: unknown) => Promise<unknown>>(() => Promise.resolve({}));
vi.mock('@vercel/blob', () => ({ put, list: vi.fn(), get: vi.fn() }));

const { POST, OPTIONS, clientIp, decodeScreenshot, newId, parseCategory, passwordOk, rateLimited, resetRateLimit, MAX_BODY_BYTES } = await import('./inbox');

const PW = 'test-pass-42';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]).toString('base64');
const post = (body: unknown, headers: Record<string, string> = {}): Request =>
  new Request('https://x.test/api/inbox', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'x-forwarded-for': '1.2.3.4', ...headers } });

beforeEach(() => {
  resetRateLimit();
  put.mockClear();
  vi.stubEnv('REVIEW_PASSWORD', PW);
});

describe('guards', () => {
  it('passwordOk: exact match only, and an unset password rejects everything', () => {
    expect(passwordOk(PW, PW)).toBe(true);
    expect(passwordOk('nope', PW)).toBe(false);
    expect(passwordOk(42, PW)).toBe(false);
    expect(passwordOk('', '')).toBe(false);
    expect(passwordOk(PW, '')).toBe(false);
  });

  it('rateLimited: 30 a minute per IP, then the window slides', () => {
    for (let i = 0; i < 30; i++) expect(rateLimited('a', 1000 + i)).toBe(false);
    expect(rateLimited('a', 2000)).toBe(true);
    expect(rateLimited('b', 2000)).toBe(false);
    expect(rateLimited('a', 2000 + 61_000)).toBe(false);
  });

  it('clientIp takes the first forwarded hop', () => {
    expect(clientIp(new Request('https://x.test', { headers: { 'x-forwarded-for': ' 9.9.9.9 , 10.0.0.1' } }))).toBe('9.9.9.9');
    expect(clientIp(new Request('https://x.test'))).toBe('unknown');
  });

  it('newId sorts by time and has an 8-hex tail', () => {
    expect(newId(new Date('2026-09-22T18:05:12.345Z'), () => '1a2b3c4d')).toBe('2026-09-22T18-05-12.345Z-1a2b3c4d');
  });

  it('decodeScreenshot keeps JPEGs only (data URL or bare base64)', () => {
    expect(decodeScreenshot(`data:image/jpeg;base64,${JPEG}`)?.[0]).toBe(0xff);
    expect(decodeScreenshot(JPEG)?.length).toBe(6);
    expect(decodeScreenshot(Buffer.from('PNG....').toString('base64'))).toBeNull();
    expect(decodeScreenshot(null)).toBeNull();
  });

  it('parseCategory falls back to bug', () => {
    expect(parseCategory('perf')).toBe('perf');
    expect(parseCategory('rant')).toBe('bug');
  });
});

describe('POST', () => {
  it('stores the note (+ jpg) and answers its id', async () => {
    const res = await POST(post({ password: PW, note: '  crab in the rock  ', category: 'art', context: { shard: 'driftwood-isle' }, screenshot: JPEG }));
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    expect(id).toMatch(/-[0-9a-f]{8}$/u);
    expect(put.mock.calls.map((c) => c[0])).toEqual([`inbox/${id}.json`, `inbox/${id}.jpg`]);
    const record = JSON.parse(String(put.mock.calls[0]?.[1])) as Record<string, unknown>;
    expect(record).toMatchObject({ note: 'crab in the rock', category: 'art', context: { shard: 'driftwood-isle' }, screenshot: `${id}.jpg`, ip: '1.2.3.4' });
  });

  it('check: true verifies the password without storing anything', async () => {
    expect((await POST(post({ password: PW, check: true }))).status).toBe(200);
    expect((await POST(post({ password: 'x', check: true }))).status).toBe(401);
    expect(put).not.toHaveBeenCalled();
  });

  it('refuses bad password, empty note, bad json, oversize bodies, and an unconfigured inbox', async () => {
    expect((await POST(post({ password: 'x', note: 'hi' }))).status).toBe(401);
    expect((await POST(post({ password: PW, note: '   ' }))).status).toBe(400);
    expect((await POST(post('{nope'))).status).toBe(400);
    expect((await POST(post({ password: PW, note: 'x'.repeat(MAX_BODY_BYTES) }))).status).toBe(413);
    vi.stubEnv('REVIEW_PASSWORD', undefined);
    expect((await POST(post({ password: PW, note: 'hi' }))).status).toBe(503);
    expect(put).not.toHaveBeenCalled();
  });

  it('answers CORS only for the native shells', () => {
    const native = OPTIONS(new Request('https://x.test', { method: 'OPTIONS', headers: { origin: 'capacitor://localhost' } }));
    expect(native.headers.get('access-control-allow-origin')).toBe('capacitor://localhost');
    const other = OPTIONS(new Request('https://x.test', { method: 'OPTIONS', headers: { origin: 'https://evil.test' } }));
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});
