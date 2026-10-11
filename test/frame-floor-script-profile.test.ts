import { describe, expect, it } from 'vitest';
import { startScriptProfile, type ScriptProfilePort } from '../scripts/frame-floor-script-profile.mjs';

function port(fail: string | null = null, complete = true): { value: ScriptProfilePort; calls: string[]; listeners: () => number } {
  const listeners = new Set<(value: unknown) => void>(), calls: string[] = [];
  return {
    calls, listeners: () => listeners.size,
    value: {
      on: (_method, receive) => { listeners.add(receive); return () => { listeners.delete(receive); }; },
      send: method => {
        calls.push(method);
        if (method === fail) return Promise.reject(new Error('Protocol refused'));
        if (method === 'ScriptProfiler.stopTracking' && complete) for (const receive of listeners) receive({ samples: { stackTraces: [{ timestamp: 0, stackFrames: [] }] } });
        return Promise.resolve({});
      },
    },
  };
}
describe('the bounded Safari travel sampling window', () => {
  it('keeps zero timestamps as untimed samples, handles the synchronous completion event and removes its listener', async () => {
    const p = port(), stop = await startScriptProfile(p.value);
    expect(p.listeners()).toBe(1);
    await expect(stop()).resolves.toEqual({ samples: { stackTraces: [{ timestamp: 0, stackFrames: [] }] } });
    expect(p.calls).toEqual(['ScriptProfiler.startTracking', 'ScriptProfiler.stopTracking']);
    expect(p.listeners()).toBe(0);
  });
  it.each(['ScriptProfiler.startTracking', 'ScriptProfiler.stopTracking'])('cleans up a refused %s', async method => {
    const p = port(method);
    if (method.endsWith('startTracking')) await expect(startScriptProfile(p.value)).rejects.toThrow('Protocol refused');
    else { const stop = await startScriptProfile(p.value); await expect(stop()).rejects.toThrow('Protocol refused'); }
    expect(p.listeners()).toBe(0);
  });
  it('fails boundedly when the completion event is missing, rather than publishing an empty profile', async () => {
    const p = port(null, false), stop = await startScriptProfile(p.value, 1);
    await expect(stop()).rejects.toThrow('did not complete');
    expect(p.listeners()).toBe(0);
  });
});
