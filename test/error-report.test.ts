// src/core/errorReport.ts (E133): dedupe, the per-session cap, the offline queue. Transport, storage and timers are injected.
import { describe, expect, it, vi } from 'vitest';
import { ErrorReporter, QUEUE_KEY, REPORTS_MAX, SESSION_KEY, keyOf, safeUrl, type ErrorPayload, type ReporterDeps, type SendResult } from '../src/core/errorReport';
import { MemoryStorage } from './setup';

const flush = async (): Promise<void> => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
interface Rig { r: ErrorReporter; sent: ErrorPayload[]; timers: (() => void)[]; session: MemoryStorage; local: MemoryStorage; result: { v: SendResult }; fire: () => Promise<void> }
function rig(over: Partial<ReporterDeps> = {}, session = new MemoryStorage(), local = new MemoryStorage()): Rig {
  const sent: ErrorPayload[] = [];
  const timers: (() => void)[] = [];
  const result = { v: 'ok' as SendResult };
  const r = new ErrorReporter({
    send: (p) => { if (result.v === 'ok') sent.push(p); return Promise.resolve(result.v); },
    context: () => ({ shard: 'driftwood-isle', pos: [1, 2, 3] }),
    session, local, now: () => 1234, later: (fn) => { timers.push(fn); },
    ...over,
  });
  return { r, sent, timers, session, local, result, fire: async () => { for (const t of timers.splice(0)) t(); await flush(); } };
}

describe('error reports', () => {
  it('nothing reported → nothing sent, nothing stored', async () => {
    const g = rig();
    await g.fire();
    expect(g.sent).toEqual([]);
    expect(g.session.getItem(SESSION_KEY)).toBeNull();
    expect(g.local.getItem(QUEUE_KEY)).toBeNull();
  });

  it('the same error folds into one report with a count; a switch-off on the way marks it disabled', async () => {
    const g = rig();
    const e = new Error('crab');
    const outs = [g.r.report('crabs', e), g.r.report('crabs', e), g.r.report('crabs', e, { disabled: true })];
    expect(g.sent).toEqual([]); // waits REPORT_DELAY_MS for the repeats
    await g.fire();
    expect(await Promise.all(outs)).toEqual(['sent', 'sent', 'sent']);
    expect(g.sent).toHaveLength(1);
    expect(g.sent[0]).toMatchObject({ system: 'crabs', message: 'Error: crab', count: 3, disabled: true, fatal: false, sinceBootMs: 1234, context: { shard: 'driftwood-isle', pos: [1, 2, 3] } });
    expect(await g.r.report('crabs', e)).toBe('dup'); // once per session
    expect(g.sent).toHaveLength(1);
  });

  it('a fatal error goes at once', async () => {
    const g = rig();
    const out = g.r.report('render', new Error('dead'), { fatal: true });
    expect(g.timers).toHaveLength(0);
    expect(await out).toBe('sent');
    expect(g.sent[0]?.fatal).toBe(true);
  });

  it(`at most ${REPORTS_MAX} reports a session — across a reload (sessionStorage)`, async () => {
    const session = new MemoryStorage();
    const g = rig({}, session);
    const first = Array.from({ length: REPORTS_MAX - 2 }, (_, i) => new Error(`e${i}`));
    for (const e of first) void g.r.report('s', e);
    await g.fire();
    const again = rig({}, session); // the page reloaded
    const outs = [];
    for (let i = 0; i < 5; i++) outs.push(again.r.report('s', new Error(`f${i}`)));
    await again.fire();
    expect(await Promise.all(outs)).toEqual(['sent', 'sent', 'dropped', 'dropped', 'dropped']);
    expect(g.sent.length + again.sent.length).toBe(REPORTS_MAX);
    expect(await again.r.report('s', first[0])).toBe('dup'); // the same message + stack, sent before the reload
  });

  it('offline: queued in localStorage, flushed when the network is back', async () => {
    const g = rig();
    g.result.v = 'retry';
    expect(await g.r.report('x', new Error('offline'), { fatal: true })).toBe('queued');
    expect(g.r.readQueue()).toHaveLength(1);
    expect(await g.r.flushQueue()).toBe(0); // still offline: stays
    expect(g.r.readQueue()).toHaveLength(1);
    g.result.v = 'ok';
    expect(await g.r.flushQueue()).toBe(1);
    expect(g.r.readQueue()).toEqual([]);
    expect(g.local.getItem(QUEUE_KEY)).toBeNull();
    expect(g.sent[0]?.message).toBe('Error: offline');
  });

  it('a network throw queues; a 4xx rejection is dropped, not retried', async () => {
    const g = rig({ send: () => Promise.reject(new Error('net')) });
    expect(await g.r.report('x', new Error('a'), { fatal: true })).toBe('queued');
    const h = rig();
    h.result.v = 'reject';
    expect(await h.r.report('x', new Error('b'), { fatal: true })).toBe('dropped');
    expect(h.r.readQueue()).toEqual([]);
  });

  it('a context that throws still sends the report', async () => {
    const g = rig({ context: () => { throw new Error('no player yet'); } });
    expect(await g.r.report('boot', new Error('early'), { fatal: true })).toBe('sent');
    expect(g.sent[0]?.context).toEqual({});
  });

  it('storage that throws (iOS private mode) never breaks reporting', async () => {
    const bad = new MemoryStorage();
    vi.spyOn(bad, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(bad, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const g = rig({}, bad, bad);
    g.result.v = 'retry';
    expect(await g.r.report('x', new Error('p'), { fatal: true })).toBe('queued');
  });

  it('keyOf is stable and message+stack sensitive; safeUrl drops secrets and the fragment', () => {
    expect(keyOf('a', 'b')).toBe(keyOf('a', 'b'));
    expect(keyOf('a', 'b')).not.toBe(keyOf('a', 'c'));
    expect(safeUrl('https://x.test/?chunk=driftwood-isle&token=abc&review_password=1&at=1,2,3#frag')).toBe('https://x.test/?chunk=driftwood-isle&at=1%2C2%2C3');
    expect(safeUrl('not a url')).toBe('');
  });
});
