import { beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn(() => Promise.resolve({}));
const del = vi.fn(() => Promise.resolve());
const list = vi.fn(() => Promise.resolve({ blobs: [] as { pathname: string; uploadedAt: Date }[], hasMore: false }));
const get = vi.fn<(path: string) => Promise<{ stream: ReadableStream<Uint8Array> } | null>>(() => Promise.resolve(null));
vi.mock('@vercel/blob', () => ({ put, del, list, get }));
const { GET, POST, cleanRecord, dailyDigest, buildRates, resetRateLimit } = await import('../api/telemetry');
const session = { kind: 'session', build: 'build', install: 'anonymous', end: 'clean', heartbeat: { session: 'one', shard: 'world', stage: 'play', fps: 30 } };
const request = (q = '', password: string | null = 'test-password') => new Request(`https://example.test/api/telemetry${q}`, { headers: password === null ? {} : { 'x-review-password': password } });
beforeEach(() => { vi.clearAllMocks(); resetRateLimit(); vi.stubEnv('REVIEW_PASSWORD', 'test-password'); vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token'); list.mockResolvedValue({ blobs: [], hasMore: false }); });
describe('telemetry API', () => {
  it('gates reads, including missing configuration, without blocking anonymous writes', async () => {
    expect((await GET(request('?rate=builds', null))).status).toBe(401);
    expect((await GET(request('?rate=builds', 'wrong'))).status).toBe(401);
    vi.stubEnv('REVIEW_PASSWORD', undefined); expect((await GET(request('?rate=builds'))).status).toBe(503);
    expect((await POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify(session) }))).status).toBe(200);
  });
  it('deletes expired telemetry on every write and stores only whitelisted fields', async () => {
    list.mockResolvedValue({ blobs: [{ pathname: 'telemetry/old/old.json', uploadedAt: new Date(0) }, { pathname: 'telemetry/today/new.json', uploadedAt: new Date() }], hasMore: false });
    await POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ ...session, email: 'discard', heartbeat: { ...session.heartbeat, url: 'discard' } }) }));
    expect(del).toHaveBeenCalledWith(['telemetry/old/old.json']);
    expect(cleanRecord({ ...session, email: 'discard' })).not.toHaveProperty('email');
  });
  it('computes rates with session deduplication and daily event counts/time medians server-side', async () => {
    const clean = cleanRecord(session, new Date('2026-10-01T01:00:00Z'));
    const crash = cleanRecord({ ...session, end: 'crash', heartbeat: { ...session.heartbeat, session: 'two' } });
    const analytics = cleanRecord({ kind: 'analytics', build: 'build', install: 'anonymous', events: [
      { name: 'death.cause', data: { shard: 'world', cause: 'fall', email: 'discard' } },
      { name: 'shard.time', data: { shard: 'world', seconds: 10 } }, { name: 'shard.time', data: { shard: 'world', seconds: 20 } },
    ] });
    if (!clean || !crash || !analytics) throw new Error('Invalid fixture');
    expect(buildRates([clean, clean, crash], 3)).toEqual([{ build: 'build', sessions: 2, crashFree: 0.5 }]);
    expect(dailyDigest([analytics])).toEqual({ counts: { 'death.cause': { 'world / fall': 1 } }, shardTime: { world: { samples: 2, median: 15 } } });
    list.mockResolvedValue({ blobs: [{ pathname: 'telemetry/2026-10-01/one.json', uploadedAt: new Date() }], hasMore: false });
    get.mockImplementation(() => Promise.resolve({ stream: Response.json(analytics).body as ReadableStream<Uint8Array> }));
    expect(await (await GET(request('?digest=2026-10-01'))).json()).toMatchObject({ day: '2026-10-01', shardTime: { world: { median: 15 } } });
    get.mockImplementation(() => Promise.resolve({ stream: Response.json(clean).body as ReadableStream<Uint8Array> }));
    expect(await (await GET(request('?rate=builds&n=3'))).json()).toEqual({ builds: [{ build: 'build', sessions: 1, crashFree: 1 }] });
  });
});
