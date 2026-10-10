// api/waitlist.ts — the marketing site's waitlist: email and cell parsing, the honeypot, CORS for the site only, the
// password-gated list; Vercel Blob is installed, not mocked (E422).
import { GET, OPTIONS, POST, parseCell, parseEmail } from '../api/waitlist';
import { resetRateLimit } from '../api/inbox';
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
  it('parseCell takes A1–E5 but never the fixed centre', () => {
    expect(parseCell('d4')).toBe('D4');
    expect(parseCell('C3')).toBeNull();
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
    expect((await POST(post({ email: 'a@b.co', website: 'spam.example' }))).status).toBe(200);
    expect(put).not.toHaveBeenCalled();
  });
  it('another origin gets no CORS header', async () => {
    const res = await POST(post({ email: 'a@b.co' }, 'https://evil.example'));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(OPTIONS(new Request('https://x.test/api/waitlist', { method: 'OPTIONS', headers: { origin: SITE } })).headers.get('access-control-allow-origin')).toBe(SITE);
  });
  it('rate-limits at 10 a minute per IP', async () => {
    for (let i = 0; i < 10; i++) expect((await POST(post({ email: `u${i}@b.co` }))).status).toBe(200);
    expect((await POST(post({ email: 'late@b.co' }))).status).toBe(429);
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
  it('a bad email goes back to #author and stores nothing; an unknown referer goes to the main site', async () => {
    const res = await POST(form({ email: 'nope' }, 'https://evil.example/'));
    expect(res.headers.get('location')).toBe('https://wildshard.io/#author');
    expect(put).not.toHaveBeenCalled();
  });
});

describe('GET', () => {
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
