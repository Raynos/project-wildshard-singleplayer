// src/ui/Settings.ts — reads storage once at module init, so each test imports a fresh copy of the module.
import { describe, expect, it, vi } from 'vitest';
import type * as SettingsModule from '../src/ui/Settings';

const STORE = 'ws.settings.v1';
function fresh(): Promise<typeof SettingsModule> {
  vi.resetModules();
  return import('../src/ui/Settings');
}

describe('Settings', () => {
  it('defaults: aim assist + tracers on, volume 0.8, music 0.7', async () => {
    const s = await fresh();
    expect(s.getSetting('aimAssist')).toBe(true);
    expect(s.getSetting('tracers')).toBe(true);
    expect(s.getNumber('volume')).toBe(0.8);
    expect(s.getNumber('music')).toBe(0.7);
  });

  it('loads saved values and ignores wrongly-typed ones', async () => {
    localStorage.setItem(STORE, JSON.stringify({ aimAssist: false, tracers: 'no', volume: 0.25, music: '1' }));
    const s = await fresh();
    expect(s.getSetting('aimAssist')).toBe(false);
    expect(s.getSetting('tracers')).toBe(true);
    expect(s.getNumber('volume')).toBe(0.25);
    expect(s.getNumber('music')).toBe(0.7);
  });

  it('falls back to defaults on corrupt JSON or a throwing storage', async () => {
    localStorage.setItem(STORE, '{{');
    expect((await fresh()).getNumber('volume')).toBe(0.8);
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect((await fresh()).getSetting('aimAssist')).toBe(true);
  });

  it('setSetting persists and notifies subscribers once per real change', async () => {
    const s = await fresh();
    const fn = vi.fn<(v: boolean) => void>();
    s.onSetting('tracers', fn);
    s.setSetting('tracers', false);
    s.setSetting('tracers', false); // unchanged: no second call
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(false);
    expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ tracers: false, aimAssist: true, volume: 0.8 });
    expect((await fresh()).getSetting('tracers')).toBe(false);
  });

  it('subscribers are per key and can unsubscribe', async () => {
    const s = await fresh();
    const aim = vi.fn<(v: boolean) => void>(), tracers = vi.fn<(v: boolean) => void>();
    const off = s.onSetting('aimAssist', aim);
    s.onSetting('tracers', tracers);
    s.setSetting('aimAssist', false);
    off();
    s.setSetting('aimAssist', true);
    expect(aim).toHaveBeenCalledTimes(1);
    expect(tracers).not.toHaveBeenCalled();
  });

  it('setNumber clamps to 0..1 and notifies with the clamped value', async () => {
    const s = await fresh();
    const fn = vi.fn<(v: number) => void>();
    const off = s.onNumber('music', fn);
    s.setNumber('music', 1.7);
    expect(s.getNumber('music')).toBe(1);
    s.setNumber('music', -3);
    expect(s.getNumber('music')).toBe(0);
    s.setNumber('music', -1); // still 0: no notification
    expect(fn.mock.calls).toEqual([[1], [0]]);
    off();
    s.setNumber('music', 0.5);
    expect(fn).toHaveBeenCalledTimes(2);
    expect((await fresh()).getNumber('music')).toBe(0.5);
  });

  it('keeps the in-memory value when storage throws on write', async () => {
    const s = await fresh();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    s.setNumber('volume', 0.3);
    expect(s.getNumber('volume')).toBe(0.3);
  });

  it('musicStyle: piano by default, persisted, validated, notifies once per change', async () => {
    const s = await fresh();
    expect(s.getMusicStyle()).toBe('piano');
    const fn = vi.fn<(v: string) => void>();
    s.onMusicStyle(fn);
    s.setMusicStyle('folk');
    s.setMusicStyle('folk');
    expect(fn.mock.calls).toEqual([['folk']]);
    expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ musicStyle: 'folk', volume: 0.8 });
    expect((await fresh()).getMusicStyle()).toBe('folk');
    localStorage.setItem(STORE, JSON.stringify({ musicStyle: 'dubstep' }));
    expect((await fresh()).getMusicStyle()).toBe('piano');
  });

  it('sfxSet: moss by default, persisted beside musicStyle, ?sfx= overrides without persisting', async () => {
    const s = await fresh();
    expect(s.getSfxSet()).toBe('moss');
    s.setSfxSet('ezaudio');
    expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ sfxSet: 'ezaudio', musicStyle: 'piano' });
    vi.stubGlobal('location', new URL('http://localhost:5173/?sfx=synth'));
    try {
      const t = await fresh();
      expect(t.getSfxSet()).toBe('synth');
      t.setNumber('volume', 0.5);
      expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ sfxSet: 'ezaudio' });
    } finally { vi.stubGlobal('location', new URL('http://localhost:5173/')); }
  });

  it('?music=<style> overrides the saved style without persisting it', async () => {
    localStorage.setItem(STORE, JSON.stringify({ musicStyle: 'orchestral' }));
    vi.stubGlobal('location', new URL('http://localhost:5173/?music=synth'));
    try {
      const s = await fresh();
      expect(s.getMusicStyle()).toBe('synth');
      s.setNumber('volume', 0.4); // an unrelated write keeps the saved pick
      expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ musicStyle: 'orchestral' });
      s.setMusicStyle('folk');
      expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ musicStyle: 'folk' });
    } finally { vi.stubGlobal('location', new URL('http://localhost:5173/')); }
  });
});
