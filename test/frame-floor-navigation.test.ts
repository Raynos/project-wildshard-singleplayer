// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the serialized page command in an isolated Node test realm.
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { FLOOR_GRID_TAP, handoffFloorGridNavigation } from '../scripts/frame-floor-navigation.mjs';

describe('pre-measurement title navigation', () => {
  it('submits one tap without polling an old-document envelope', async () => {
    const events: string[] = [];
    let token = 'title';
    await handoffFloorGridNavigation({
      evaluate: () => { events.push(`identity:${token}`); return Promise.resolve({ token }); },
      tapGrid: () => { events.push('tap'); return Promise.resolve(); },
      followed: () => { events.push('navigation'); token = 'grid'; return Promise.resolve(); },
    });
    expect(events).toEqual(['identity:title', 'tap', 'navigation', 'identity:grid']);
  });

  it('refuses a missing document handoff', async () => {
    await expect(handoffFloorGridNavigation({ evaluate: () => Promise.resolve({ token: 'title' }),
      tapGrid: () => Promise.resolve(), followed: () => Promise.resolve() })).rejects.toThrow('new document');
  });

  it('refuses malformed identity before submitting input', async () => {
    let taps = 0;
    await expect(handoffFloorGridNavigation({ evaluate: () => Promise.resolve(null),
      tapGrid: () => { taps++; return Promise.resolve(); }, followed: () => Promise.resolve() })).rejects.toThrow('document identity');
    expect(taps).toBe(0);
  });

  it('does not replay a failed tap or continue to sampling', async () => {
    let taps = 0, follows = 0;
    await expect(handoffFloorGridNavigation({ evaluate: () => Promise.resolve({ token: 'title' }),
      tapGrid: () => { taps++; return Promise.reject(new Error('Inspector target lost')); },
      followed: () => { follows++; return Promise.resolve(); } })).rejects.toThrow('Inspector target lost');
    expect(taps).toBe(1);
    expect(follows).toBe(0);
  });

  it('returns the real command before its delayed click', () => {
    const scheduled: (() => void)[] = [];
    let clicks = 0;
    const result: unknown = runInNewContext(FLOOR_GRID_TAP, {
      document: { querySelector: () => ({ click: () => { clicks++; } }) },
      setTimeout: (callback: () => void, delay: number) => {
        expect(delay).toBe(100); scheduled.push(callback);
      },
    });
    expect(result).toBe(true);
    expect(clicks).toBe(0);
    expect(scheduled).toHaveLength(1);
    scheduled[0]?.();
    expect(clicks).toBe(1);
  });
});
