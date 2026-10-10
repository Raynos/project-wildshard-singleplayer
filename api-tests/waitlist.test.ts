// api/waitlist.ts — the marketing site's waitlist: email and cell parsing, the honeypot, the site's origins only, one
// file per email, the password-gated list; Vercel Blob is installed, not mocked (E422).
import { GET, OPTIONS, POST, parseCell, parseEmail } from '../api/waitlist';
import { rateLimited, resetRateLimit } from '../api/inbox';
import { useBlobStore } from '../api/_blobStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const stored = new Map<string, string>();
const put = vi.fn((path: string, body: unknown) => { stored.set(path, String(body)); return Promise.resolve({}); });
useBlobStore({
  put,
  list: vi.fn(() => Promise.resolve({ blobs: [...stored.keys()].map((pathname) => ({ pathname, uploadedAt: new Date(0), size: 1 })), hasMore: false })),
  get: vi.fn((path: string) => {
    const s = stored.get(path);
    return Promise.resolve(s === undefined ? null : { stream: new Response(s).body });
  }),
  del: vi.fn(() => Promise.resolve()),
});

const SITE = 'https://wildshard-site.vercel.app';
const post = (body: unknown, origin = SITE): Request =>
  new Request('https://x.test/api/waitlist', { method: 'POST', body: JSON.stringify(body), headers: { origin, 'x-forwarded-for': '1.2.3.4' } });

beforeEach(() => {
  resetRateLimit();
  stored.clear();
  put.mockClear();
  vi.stubEnv('REVIEW_PASSWORD', 'pw');
});

describe('parsing', () => {
  it('parseEmail trims, lower-cases and refuses non-emails', () => {
    expect(parseEmail('  Jake@Example.COM ')).toBe('jake@example.com');
    expect(parseEmail('nope')).toBeNull();
    expect(parseEmail('a@b')).toBeNull();
    expect(parseEmail(42)).toBeNull();
  });
  it("parseCell takes an empty cell of A1–E5, never a shard's or the centre", () => {
    expect(parseCell('d4')).toBe('D4');
    expect(parseCell('C3')).toBeNull();
    expect(parseCell('B2')).toBeNull();
    expect(parseCell('F1')).toBeNull();
    expect(parseCell(undefined)).toBeNull();
  });
});

describe('POST', () => {
  it('stores a signup and answers the site with CORS', async () => {
    const res = await POST(post({ email: 'a@b.co', build: 'build me a frozen fjord', cell: 'D4' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(SITE);
    expect(put).toHaveBeenCalledTimes(1);
    const [entry] = [...stored.values()].map((s): unknown => JSON.parse(s));
    expect(entry).toMatchObject({ email: 'a@b.co', build: 'build me a frozen fjord', cell: 'D4' });
  });
  it('a bad email is a 400 and stores nothing', async () => {
    expect((await POST(post({ email: 'nope' }))).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });
  it('the honeypot answers ok and stores nothing', async () => {
    expect((await POST(post({ email: 'a@b.co', trap: 'spam.example' }))).status).toBe(200);
    expect(put).not.toHaveBeenCalled();
  });
  it('another origin is refused and stores nothing (CORS alone would only hide the answer)', async () => {
    const res = await POST(post({ email: 'a@b.co' }, 'https://evil.example'));
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(put).not.toHaveBeenCalled();
    expect(OPTIONS(new Request('https://x.test/api/waitlist', { method: 'OPTIONS', headers: { origin: SITE } })).headers.get('access-control-allow-origin')).toBe(SITE);
  });
  it('an idea over 500 characters is a 400, not cut short', async () => {
    expect((await POST(post({ email: 'a@b.co', build: 'x'.repeat(501) }))).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });
  it('one file per email: signing up again replaces the earlier wish', async () => {
    await POST(post({ email: 'a@b.co', cell: 'A1' }));
    await POST(post({ email: 'A@b.co ', cell: 'E5' }));
    expect([...stored.values()].map((v): unknown => JSON.parse(v))).toMatchObject([{ email: 'a@b.co', cell: 'E5' }]);
    expect([...stored.keys()][0]).not.toContain('a@b.co');
  });
  it('rate-limits at 10 a minute per IP', async () => {
    for (let i = 0; i < 10; i++) expect((await POST(post({ email: `u${i}@b.co` }))).status).toBe(200);
    expect((await POST(post({ email: 'late@b.co' }))).status).toBe(429);
  });
  it('a full rate table forgets idle IPs, never a limited one', () => {
    const now = 1_000_000;
    for (let i = 0; i < 11; i++) rateLimited('9.9.9.9', now, 10);
    for (let i = 0; i < 600; i++) rateLimited(`10.0.${i >> 8}.${i & 255}`, now - 120_000, 10);
    expect(rateLimited('9.9.9.9', now + 1, 10)).toBe(true);
  });
});

describe('a plain form post (the site without its script)', () => {
  const form = (fields: Record<string, string>, referer = 'https://wildshard.io/'): Request =>
    new Request('https://x.test/api/waitlist', { method: 'POST', body: new URLSearchParams(fields).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded', referer, 'x-forwarded-for': '9.9.9.9' } });
  it('stores the signup and sends the browser back to #thanks', async () => {
    const res = await POST(form({ email: 'a@b.co', build: 'a fjord', cell: 'D4', website: '' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://wildshard.io/#thanks');
    expect([...stored.values()].map((v): unknown => JSON.parse(v))).toMatchObject([{ email: 'a@b.co', build: 'a fjord', cell: 'D4' }]);
  });
  it("a post from another site's form is refused", async () => {
    const res = await POST(new Request('https://x.test/api/waitlist', { method: 'POST', body: 'email=a%40b.co', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.example', 'x-forwarded-for': '9.9.9.8' } }));
    expect(res.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });
  it('a bad email goes back to #author and stores nothing; an unknown referer goes to the main site', async () => {
    const res = await POST(form({ email: 'nope' }, 'https://evil.example/'));
    expect(res.headers.get('location')).toBe('https://wildshard.io/#author');
    expect(put).not.toHaveBeenCalled();
  });
});

describe('GET', () => {
  it('counts each email once, with its newest signup', async () => {
    const entry = (id: string, cell: string): string => JSON.stringify({ id, email: 'same@b.co', build: 'x', cell, receivedAt: id });
    stored.set('waitlist/2026-10-10T01-00-00.000Z-aaaaaaaa.json', entry('2026-10-10T01-00-00.000Z-aaaaaaaa', 'A1'));
    stored.set('waitlist/2026-10-10T02-00-00.000Z-bbbbbbbb.json', entry('2026-10-10T02-00-00.000Z-bbbbbbbb', 'E5'));
    const res = await GET(new Request('https://x.test/api/waitlist', { headers: { 'x-review-password': 'pw', 'x-forwarded-for': '7.7.7.7' } }));
    const body: unknown = await res.json();
    expect(body).toEqual({ entries: [expect.objectContaining({ email: 'same@b.co', cell: 'E5' })] });
  });

  it('the admin site may read (GET with the password header), the site may only write', () => {
    const pre = (origin: string): Response => OPTIONS(new Request('https://x.test/api/waitlist', { method: 'OPTIONS', headers: { origin } }));
    const admin = pre('https://wildshard-admin.vercel.app');
    expect(admin.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS');
    expect(admin.headers.get('access-control-allow-headers')).toBe('x-review-password');
    expect(pre(SITE).headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
  });

  it('needs the review password, then lists every signup', async () => {
    await POST(post({ email: 'a@b.co', cell: 'B1' }));
    const req = (pw: string): Request => new Request('https://x.test/api/waitlist', { headers: { 'x-review-password': pw, 'x-forwarded-for': '5.6.7.8' } });
    expect((await GET(req('wrong'))).status).toBe(401);
    const res = await GET(req('pw'));
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(body).toMatchObject({ entries: [{ email: 'a@b.co', cell: 'B1' }] });
  });
});
