// src/ui/review.ts (unlock, Quick note switch, send + offline queue) and the pure helpers of src/ui/Feedback.ts.
// review.ts reads storage once at module init, so each test imports a fresh copy; fetch is stubbed per test.
import { describe, expect, it, vi } from 'vitest';
import type * as ReviewModule from '../src/ui/review';
import { headingDeg, reproUrl } from '../src/ui/Feedback';

const KEY = 'ws.review.v1';
const QUEUE_KEY = 'ws.review.queue.v1';
function fresh(): Promise<typeof ReviewModule> {
  vi.resetModules();
  return import('../src/ui/review');
}
const reply = (status: number, body: unknown = {}): Response => Response.json(body, { status });
const bodyOf = (init: RequestInit | undefined): unknown => JSON.parse(typeof init?.body === 'string' ? init.body : 'null');
const note = (text: string): ReviewModule.NotePayload => ({ note: text, category: 'bug', context: { shard: 'driftwood-isle' }, screenshot: null });

describe('review unlock', () => {
  it('starts locked; a checked password unlocks, Quick note on by default, remembered across reloads', async () => {
    const r = await fresh();
    expect(r.reviewUnlocked()).toBe(false);
    expect(r.quickNote()).toBe(false);
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(reply(200, { ok: true })));
    vi.stubGlobal('fetch', fetch);
    expect(await r.unlockReview('  secret  ')).toBe('ok');
    expect(bodyOf(fetch.mock.calls[0]?.[1])).toEqual({ password: 'secret', check: true });
    expect(r.quickNote()).toBe(true);
    const again = await fresh();
    expect(again.reviewUnlocked()).toBe(true);
  });

  it('a wrong password stays locked; no network reads as offline', async () => {
    const r = await fresh();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(reply(401))));
    expect(await r.unlockReview('nope')).toBe('bad');
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    expect(await r.unlockReview('secret')).toBe('offline');
    expect(r.reviewUnlocked()).toBe(false);
  });

  it('the Quick note switch and LOCK notify listeners', async () => {
    localStorage.setItem(KEY, JSON.stringify({ password: 'secret', quick: true }));
    const r = await fresh();
    const fn = vi.fn<() => void>();
    r.onReview(fn);
    r.setQuickNote(false);
    expect(r.quickNote()).toBe(false);
    r.lockReview();
    expect(r.reviewUnlocked()).toBe(false);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('sendNote + the offline queue', () => {
  it('locked → nothing is sent', async () => {
    const r = await fresh();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await r.sendNote(note('x'))).toBe('locked');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sent → the id; offline → queued, then flushed oldest first when the network is back', async () => {
    localStorage.setItem(KEY, JSON.stringify({ password: 'secret', quick: true }));
    const r = await fresh();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(reply(200, { id: 'abc' }))));
    expect(await r.sendNote(note('first'))).toEqual({ id: 'abc' });
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    expect(await r.sendNote(note('a'))).toBe('queued');
    expect(await r.sendNote(note('b'))).toBe('queued');
    expect(r.queuedCount()).toBe(2);
    const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => { sent.push((bodyOf(init) as { note: string }).note); return Promise.resolve(reply(200, { id: 'x' })); }));
    expect(await r.flushQueue()).toBe(2);
    expect(sent).toEqual(['a', 'b']);
    expect(r.queuedCount()).toBe(0);
  });

  it('a 401 while sending locks review again (the password was changed)', async () => {
    localStorage.setItem(KEY, JSON.stringify({ password: 'old', quick: true }));
    const r = await fresh();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(reply(401))));
    expect(await r.sendNote(note('x'))).toBe('locked');
    expect(r.reviewUnlocked()).toBe(false);
  });

  it('keeps the newest QUEUE_MAX and drops screenshots when storage is full', async () => {
    const r = await fresh();
    r.writeQueue(Array.from({ length: r.QUEUE_MAX + 3 }, (_, i) => note(`n${i}`)));
    const q = r.readQueue();
    expect(q).toHaveLength(r.QUEUE_MAX);
    expect(q[0]?.note).toBe('n3');
    const big = { ...note('shot'), screenshot: 'data:image/jpeg;base64,AAAA' };
    const set = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => { throw new DOMException('full', 'QuotaExceededError'); });
    r.writeQueue([big]);
    expect(set).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')).toEqual([{ ...note('shot'), screenshot: null }]);
  });
});

describe('Feedback helpers', () => {
  it('headingDeg matches the HUD compass (yaw π = north)', () => {
    expect(headingDeg(Math.PI)).toBe(0);
    expect(headingDeg(Math.PI / 2)).toBe(90);
    expect(headingDeg(0)).toBe(180);
  });

  it('reproUrl puts you back on the spot', () => {
    const url = reproUrl('https://w.test', { shard: 'driftwood-isle', pos: [1.234, 2, -235.5], yaw: 3.14159, pitch: -0.1, weapon: 'sword' });
    expect(url).toBe('https://w.test/?chunk=driftwood-isle&at=1.23%2C2%2C-235.5%2C3.14%2C-0.1&weapon=sword&skipintro');
  });
});
